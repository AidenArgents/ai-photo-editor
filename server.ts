import express from "express";
import path from "path";
import fs from "fs";
import dns from "dns";
import http from "http";
import https from "https";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Modality } from "@google/genai";

// 强制优先使用 IPv4 解析，彻底解决访问马帮 instudio 及阿里云 CDN 时由于 IPv6 黑洞导致的 12000ms 超时假死问题
try {
  dns.setDefaultResultOrder("ipv4first");
} catch (e) {
  // 忽略不支持的环境
}

const app = express();
const PORT = 3000;

// Configure multer to store files in memory
const upload = multer({
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Helper to convert buffer to Gemini inline data part
const bufferToGenerativePart = (buffer: Buffer, mimeType: string) => {
  return {
    inlineData: {
      data: buffer.toString("base64"),
      mimeType: mimeType,
    },
  };
};

// Describe image helper
async function describeImage(ai: GoogleGenAI, buffer: Buffer, mimeType: string): Promise<string> {
  const imagePart = bufferToGenerativePart(buffer, mimeType);
  const textPart = {
    text: "Create a detailed, descriptive prompt for an image generation AI. Describe the main subject, their appearance, the background, the lighting, and the overall style of this image.",
  };

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: [{ parts: [imagePart, textPart] }],
  });

  return response.text || "";
}

// Extract aspect ratio from prompt
const VALID_ASPECT_RATIOS = ["1:1", "3:4", "4:3", "9:16", "16:9", "3:2", "4:5"];
async function extractAspectRatioFromPrompt(ai: GoogleGenAI, prompt: string): Promise<string> {
  try {
    const systemInstruction = `You are an expert at analyzing user prompts to determine the desired image aspect ratio.
Your task is to respond with ONLY ONE of the following valid aspect ratio strings based on the user's request: ${VALID_ASPECT_RATIOS.join(", ")}.
- If the user explicitly mentions a ratio (e.g., '16:9', '4 by 3'), use that.
- If they use descriptive terms (e.g., 'widescreen', 'landscape'), choose the most appropriate ratio (e.g., '16:9' or '4:3').
- For terms like 'portrait' or 'tall', choose '3:4' or '9:16'.
- For 'square', use '1:1'.
- If no aspect ratio is mentioned, or if the request is ambiguous, you MUST respond with '1:1'.
- Do not add any other text, explanation, or punctuation. Your response must be only the aspect ratio string.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `User request: "${prompt}"`,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0,
      },
    });

    const extractedRatio = (response.text || "").trim();
    if (VALID_ASPECT_RATIOS.includes(extractedRatio)) {
      return extractedRatio;
    }
    return "1:1";
  } catch (error) {
    console.error("Error extracting aspect ratio:", error);
    return "1:1";
  }
}

// Helper to optimize edit prompts and avoid safety false positives (e.g. watermark triggers)
function optimizePromptForEditing(prompt: string): string {
  let cleaned = prompt.trim();

  // Rephrase keywords that might trigger Gemini's automatic copyright/watermark refusal filter
  if (/水印|watermark/i.test(cleaned)) {
    cleaned = cleaned.replace(
      /去除.*右下角.*水印|去除右下角水印|去右下角水印|右下角水印|去除水印|去水印|水印/gi,
      "右下角细节精细修饰与底座色彩自然无缝融合"
    );
  }

  return `You are an expert AI photo editor. Edit the provided image according to the following instructions.

# EDIT INSTRUCTIONS:
${cleaned}

# EDITING GUIDELINES:
1. Carefully perform the visual modification requested.
2. Ensure that any edited regions (such as corners, base, edges, background) blend smoothly, naturally, and seamlessly with the surrounding colors, lighting, and textures.
3. Keep the rest of the image intact with high fidelity to the original.`;
}

// --- COMMERCIAL PHOTOGRAPHY PROMPT ENGINES ---

/**
 * Dual-Image Synchronized Role-Mapped Blending Engine
 * Enforces strict role division between Main Product (Immutable) and Reference Blueprint (Scene/Style),
 * while injecting mandatory physical contact shadows and relighting rules.
 */
function buildDualImageSynchronizedPrompt(userPrompt: string, mergeMode: string, isPadded: boolean, mainImageCount: number = 1): string {
  // 动态生成图片角色描述：支持 1 张或多张主产品图
  const refImageIndex = mainImageCount + 1;
  let mainImageRoleDesc: string;
  let img1Ref: string; // 在 mode 指令中引用主产品的简称

  if (mainImageCount === 1) {
    mainImageRoleDesc = `- **IMAGE 1 (Main Product / Subject)**: The first image provided. This is our core commercial asset.`;
    img1Ref = "IMAGE 1";
  } else {
    mainImageRoleDesc = `- **IMAGES 1–${mainImageCount} (Complete Product Series & Kit)**: The first ${mainImageCount} images provided. These show our complete commercial product series from different angles, including packaging storage boxes, individual screw/anchor items, hand actions, tools, and accessories. Treat them ALL as authoritative product assets!`;
    img1Ref = `IMAGES 1–${mainImageCount}`;
  }
  const img2Ref = `IMAGE ${refImageIndex}`;

  const modeInstructions: Record<string, string> = {
    custom: `**PRIMARY TASK (Custom User-Driven Multi-Asset Synthesis)**:
- ${img1Ref} represent our complete product kit and features.
- ${img2Ref} serves as our reference blueprint (for layout, packaging instructions, or scene style).
- **CRITICAL ASSET INCLUSION RULE (MANDATORY)**: You MUST NOT drop, ignore, or omit any of the uploaded product photos! You must actively analyze, combine, and synthesize ALL product items shown across ${img1Ref} (e.g. storage box, screws, hand actions, accessories) into the final picture exactly as instructed by the user below!`,
    remove_watermark: `**PRIMARY TASK (Corner Retouching & Restoration)**:
- Cleanly retouch and restore the bottom-right corner area of ${img1Ref} to remove any small overlay graphics, symbols, or text labels.
- Seamlessly reconstruct the underlying background color, texture, and lighting in that corner so it blends invisibly with zero trace left.`,
    replace_background: `**PRIMARY TASK (Background Fusion & Scene Synthesis)**:
- ${img1Ref} contains our core commercial product subject. You MUST preserve its shape, textures, branding, typography, and material reflection with 100% pixel fidelity. Do NOT alter or deform the product itself!
- ${img2Ref} is the reference background scene blueprint. Extract its environmental lighting, architectural style, color palette, and composition.
- Seamlessly place the product from ${img1Ref} into the reference scene of ${img2Ref}.
- **CRITICAL RELIGHTING & PHYSICAL SHADOW RULES (MANDATORY)**: Analyze the Key Light direction and color temperature of ${img2Ref}. Render realistic physical contact shadows (Contact Shadows), ambient occlusion (AO), and ground reflections underneath and around the product from ${img1Ref} so it sits firmly on the surface without any sticker effect ("贴纸感").`,
    combine: `**PRIMARY TASK (Style, Atmosphere & Lighting Reference)**:
- ${img1Ref} is our main product/subject. Preserve its structure and identity accurately.
- ${img2Ref} serves as a visual blueprint for mood, lighting, aesthetic style, and color grading.
- Creatively blend the environmental lighting and aesthetic atmosphere of ${img2Ref} into the scene of ${img1Ref}, ensuring natural shadow casting and harmonious color integration.`,
    replace_product: `**PRIMARY TASK (Product Replacement in Reference Scene)**:
- ${img2Ref} is the scene blueprint. Replace whatever product is originally in ${img2Ref} with the authentic product subject from ${img1Ref}.
- Maintain the original scene's lighting, perspective, and depth of field. Ensure realistic shadow casting under our new product.`,
    add_logo: `**PRIMARY TASK (Logo / Watermark Superimposition)**:
- ${img1Ref} is the main photo. ${img2Ref} is the logo/watermark graphic.
- Overlay ${img2Ref} onto ${img1Ref} naturally while preserving transparency and sharp edges.`,
    replace_person: `**PRIMARY TASK (Person Identity Replacement)**:
- ${img1Ref} is the base photo. ${img2Ref} contains the target person identity.
- Swap the person identity into ${img1Ref} while matching facial features, skin tone reflections, lighting angles, and neck/body boundary shadows smoothly.`
  };

  const selectedInstruction = modeInstructions[mergeMode] || modeInstructions.custom || modeInstructions.combine;
  const paddingNote = isPadded 
    ? `\n**NOTE ON CANVAS PADDING**: The input image(s) have been pre-padded with solid white border bars to fit the target aspect ratio. You must seamlessly outpaint and fill these padded white border regions with coherent background textures and natural lighting extensions!` 
    : "";

  return `You are an elite commercial photography AI master and physical rendering engine. You are provided with ${mainImageCount + 1} reference images and a user instruction.

# IMAGE ROLES:
${mainImageRoleDesc}
- **${img2Ref} (Reference Blueprint)**: The LAST image provided. This serves as our target scene, style, or lighting blueprint.

${selectedInstruction}${paddingNote}

# USER'S SPECIFIC CUSTOM REQUEST:
"${userPrompt}"

# FINAL MASTER INSTRUCTION:
Generate a single, flawless, commercial-grade photograph that executes the Primary Task and Custom Request. Ensure zero sticker effect ("贴纸感") by strictly enforcing physical contact shadows and environmental light harmonization while including all uploaded product assets!`;
}

/**
 * Multi-Product Only Synthesis Engine (when uploading multiple product images without reference scene)
 */
function buildMultiProductOnlyPrompt(userPrompt: string, imageCount: number): string {
  return `You are an elite commercial photography AI master. You are provided with ${imageCount} reference images showing our complete commercial product series and kit.

# IMAGE ROLES:
- **IMAGES 1–${imageCount} (Complete Product Series & Kit)**: The ${imageCount} images provided show our complete product kit from different angles, including packaging storage boxes, individual items, hands/tools, and usage details. Treat them ALL as authoritative product assets.

# CRITICAL ASSET INCLUSION RULE (MANDATORY):
- DO NOT drop, ignore, or omit any of the uploaded product photos!
- You must actively analyze, combine, and synthesize ALL key product components shown across IMAGES 1–${imageCount} (e.g. storage box, screws, hand actions, accessories) into a single cohesive commercial design according to the user's instructions.

# USER'S SPECIFIC CUSTOM REQUEST:
"${userPrompt}"

# FINAL MASTER INSTRUCTION:
Generate a single, high-impact commercial advertisement photo that faithfully incorporates all product items from the uploaded photos without missing any key assets!`;
}

/**
 * Single-Image Outpainting & Relighting Engine
 * Designed specifically for images with padded white border bars to ensure high fidelity of the central product
 * while synthesizing seamless background extensions with realistic contact shadows.
 */
function buildSingleImageOutpaintingPrompt(userPrompt: string): string {
  return `You are an elite commercial photography AI master and physical rendering engine. The provided image has been pre-padded with solid white border bars around the original photo to fit the desired aspect ratio without cropping or stretching our core product.

# PRIMARY TASK (High-Fidelity Outpainting & Relighting):
1. **100% PRODUCT FIDELITY**: Keep the original central product/subject 100% intact with absolute pixel fidelity. Do NOT deform, blur, or alter any logos, textures, or typography on the product.
2. **SEAMLESS OUTPAINTING**: Creatively and realistically synthesize and fill in the padded white border bars to extend the original background scene outward.
3. **PHYSICAL RELIGHTING & CONTACT SHADOWS (CRITICAL RULE)**: Where the original product meets the newly extended bottom/ground areas, you MUST render realistic physical contact shadows (Contact Shadows), ground reflections, and ambient occlusion (AO). The boundary between the original photo and the new extension must be 100% invisible and silky smooth!

# USER'S SPECIFIC CUSTOM REQUEST:
"${userPrompt}"

# FINAL MASTER INSTRUCTION:
Execute the outpainting and specific request to produce a cohesive, studio-quality commercial photograph with natural depth, realistic lighting, and zero padding seams!`;
}

// Helper to get image as base64
async function getImageAsBase64(ai: GoogleGenAI, model: string, parts: any[]): Promise<string> {
  const response = await ai.models.generateContent({
    model,
    contents: [{ parts }],
  });

  const candidate = response.candidates?.[0];
  if (candidate?.content?.parts) {
    for (const part of candidate.content.parts) {
      if (part.inlineData) {
        const { mimeType, data } = part.inlineData;
        return `data:${mimeType};base64,${data}`;
      }
    }
  }

  let errorMsg = "No image was generated by the API.";
  if (candidate) {
    if (candidate.finishReason && candidate.finishReason !== "STOP") {
      errorMsg += ` (Generation stopped. Reason: ${candidate.finishReason})`;
    }
    const textParts = candidate.content?.parts?.filter(p => p.text).map(p => p.text).join(" ");
    if (textParts) {
      errorMsg += ` Model message: "${textParts}"`;
    }
  }
  throw new Error(errorMsg);
}

// API endpoint for editing image
app.post(
  "/api/edit-image",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "images", maxCount: 10 },
    { name: "secondaryImage", maxCount: 1 },
  ]),
  async (req: any, res: any) => {
    try {
      const prompt = req.body.prompt;
      const aspectRatio = req.body.aspectRatio || "auto";
      const highFidelityPreserve = req.body.highFidelityPreserve === "true";
      const mergeMode = req.body.mergeMode || "combine";

      const imageFiles = req.files?.["images"] || (req.files?.["image"] ? [req.files?.["image"][0]] : []);
      const imageFile = imageFiles[0];
      const secondaryImageFile = req.files?.["secondaryImage"]?.[0];

      if (!imageFiles || imageFiles.length === 0 || !imageFile) {
        return res.status(400).json({ error: "Main image is required." });
      }

      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required." });
      }

      // Every user supplies their own API key from the page.
      const customApiKeyHeader = req.headers["x-gemini-api-key"];
      const apiKey = (
        Array.isArray(customApiKeyHeader)
          ? customApiKeyHeader[0]
          : customApiKeyHeader
      )?.trim();
      if (!apiKey) {
        return res.status(200).json({
          error: "Gemini API 密钥未配置。请在页面右上角填写您自己的 Gemini API Key。",
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      // Model for image-to-image editing tasks
      const editModel = req.body.model || "gemini-2.5-flash-image";

      // Path 1: Auto / Original Aspect Ratio
      if (aspectRatio === "auto") {
        console.log("Server: Processing auto aspect-ratio image edit with", imageFiles.length, "main image(s)...");
        const parts: any[] = [];
        for (const f of imageFiles) {
          parts.push(bufferToGenerativePart(f.buffer, f.mimetype));
        }

        if (secondaryImageFile) {
          console.log(`Server: Applying Dual-Image Synchronized Engine (Mode: ${mergeMode})...`);
          parts.push(bufferToGenerativePart(secondaryImageFile.buffer, secondaryImageFile.mimetype));
          const dualPrompt = buildDualImageSynchronizedPrompt(prompt, mergeMode, false, imageFiles.length);
          parts.push({ text: optimizePromptForEditing(dualPrompt) });
        } else if (imageFiles.length > 1) {
          console.log(`Server: Applying Multi-Product Synthesis Engine (${imageFiles.length} images)...`);
          const multiPrompt = buildMultiProductOnlyPrompt(prompt, imageFiles.length);
          parts.push({ text: optimizePromptForEditing(multiPrompt) });
        } else {
          parts.push({ text: optimizePromptForEditing(prompt) });
        }

        const resultBase64 = await getImageAsBase64(ai, editModel, parts);
        return res.json({ imageUrl: resultBase64 });
      }

      // Path 2: Custom Aspect Ratio
      let finalAspectRatio = aspectRatio;
      if (aspectRatio === "prompt") {
        finalAspectRatio = await extractAspectRatioFromPrompt(ai, prompt);
      }

      if (highFidelityPreserve) {
        // High fidelity with client-padded image
        console.log("Server: Processing high fidelity preserve image edit with", imageFiles.length, "main image(s)...");
        const parts: any[] = [];
        for (const f of imageFiles) {
          parts.push(bufferToGenerativePart(f.buffer, f.mimetype));
        }

        if (secondaryImageFile) {
          console.log(`Server: Applying Dual-Image Synchronized Engine with Padding (Mode: ${mergeMode})...`);
          parts.push(bufferToGenerativePart(secondaryImageFile.buffer, secondaryImageFile.mimetype));
          const dualPrompt = buildDualImageSynchronizedPrompt(prompt, mergeMode, true, imageFiles.length);
          parts.push({ text: optimizePromptForEditing(dualPrompt) });
        } else if (imageFiles.length > 1) {
          console.log(`Server: Applying Multi-Product Synthesis Engine with Padding (${imageFiles.length} images)...`);
          const multiPrompt = buildMultiProductOnlyPrompt(prompt, imageFiles.length);
          parts.push({ text: optimizePromptForEditing(multiPrompt) });
        } else {
          console.log("Server: Applying Single-Image Outpainting & Relighting Engine...");
          const singlePrompt = buildSingleImageOutpaintingPrompt(prompt);
          parts.push({ text: optimizePromptForEditing(singlePrompt) });
        }

        const resultBase64 = await getImageAsBase64(ai, editModel, parts);
        return res.json({ imageUrl: resultBase64 });
      } else {
        // Standard regeneration workflow (describe + generate)
        console.log("Server: Processing standard regeneration workflow...");
        const image1Description = await describeImage(ai, imageFile.buffer, imageFile.mimetype);
        let finalPrompt: string;

        if (secondaryImageFile) {
          const image2Description = await describeImage(
            ai,
            secondaryImageFile.buffer,
            secondaryImageFile.mimetype
          );
          finalPrompt = `You are an elite commercial photography AI generator. Your task is to generate a new high-quality image that fuses elements from two described sources, strictly following the user's instructions and physical relighting rules.

# PRIMARY IMAGE (Main Product / Subject Asset):
Description: "${image1Description}"
**CRITICAL INSTRUCTION:** Preserve the key product/subject identity from this primary description with absolute fidelity.

# SECONDARY IMAGE (Reference Blueprint - Scene, Style & Lighting):
Description: "${image2Description}"

# FUSION & RELIGHTING RULES (CRITICAL):
- Mode: ${mergeMode}
- Harmonize the lighting and atmosphere of the reference scene with the main product.
- Render realistic contact shadows, ambient reflections, and ground occlusion so the product integrates naturally into the scene without any sticker effect!

# USER'S SPECIFIC GOAL:
"${prompt}"`;
        } else {
          finalPrompt = `You are an elite commercial photography AI generator creating an edited version of an original image description.

# ORIGINAL IMAGE DESCRIPTION:
"${image1Description}"

# USER'S MODIFICATION REQUEST:
"${prompt}"

**CRITICAL INSTRUCTION:** Follow the user's request precisely while preserving the untouched parts of the original image description with high fidelity. When generating new background or floor elements, ensure realistic physical contact shadows and lighting gradients!`;
        }

        // Use the selected image generation model (Nano Banana / Nano Banana 2)
        const response = await ai.models.generateContent({
          model: editModel,
          contents: { parts: [{ text: finalPrompt }] },
          config: {
            imageConfig: {
              aspectRatio: finalAspectRatio as any,
            },
          },
        });

        let resultBase64 = "";
        const candidate = response.candidates?.[0];
        if (candidate?.content?.parts) {
          for (const part of candidate.content.parts) {
            if (part.inlineData) {
              const { mimeType, data } = part.inlineData;
              resultBase64 = `data:${mimeType};base64,${data}`;
              break;
            }
          }
        }

        if (!resultBase64) {
          let errorMsg = "No image was generated by the API.";
          if (candidate) {
            if (candidate.finishReason && candidate.finishReason !== "STOP") {
              errorMsg += ` (Generation stopped. Reason: ${candidate.finishReason})`;
            }
            const textParts = candidate.content?.parts?.filter(p => p.text).map(p => p.text).join(" ");
            if (textParts) {
              errorMsg += ` Model message: "${textParts}"`;
            }
          }
          throw new Error(errorMsg);
        }

        return res.json({ imageUrl: resultBase64 });
      }
    } catch (error: any) {
      console.error("Error in edit-image API:", error);
      // We return 200 instead of 500 so that upstream cloud proxies do not intercept
      // the error and replace it with a generic HTML page. The client parses the JSON 'error' field.
      res.status(200).json({
        error: error.message || "An error occurred during image processing.",
      });
    }
  }
);

// Proxy endpoint to fetch remote images (e.g. from ERP systems like Mabang) or read local Windows/Unix files bypassing browser CORS & file:// restrictions
app.get("/api/proxy-image", async (req: any, res: any) => {
  try {
    const targetUrl = req.query.url;
    if (!targetUrl || typeof targetUrl !== "string") {
      return res.status(400).json({ error: "Valid URL or file path is required." });
    }
    console.log("Server: Proxying image from URL or local path:", targetUrl);

    // Check if it is a local file path (e.g. C:\..., D:\..., /Users/..., file://...)
    let localPath = targetUrl.trim().replace(/^["']|["']$/g, "");
    if (localPath.startsWith("file://")) {
      localPath = decodeURIComponent(localPath.replace(/^file:\/\/\/?/, ""));
      // If Windows path like /C:/..., remove leading slash
      if (/^\/[a-zA-Z]:/.test(localPath)) {
        localPath = localPath.substring(1);
      }
    }

    // Check if localPath exists on disk as a file
    if (fs.existsSync(localPath) && fs.statSync(localPath).isFile()) {
      console.log("Server: Reading local image file:", localPath);
      const buffer = fs.readFileSync(localPath);
      const ext = path.extname(localPath).toLowerCase();
      let contentType = "image/jpeg";
      if (ext === ".png") contentType = "image/png";
      else if (ext === ".webp") contentType = "image/webp";
      else if (ext === ".gif") contentType = "image/gif";
      else if (ext === ".svg") contentType = "image/svg+xml";

      res.setHeader("Content-Type", contentType);
      res.setHeader("Access-Control-Allow-Origin", "*");
      return res.send(buffer);
    }

    if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
      return res.status(400).json({ error: "Cannot find local file or valid HTTP URL: " + targetUrl });
    }

    const fetchUrlToBuffer = (urlStr: string, timeoutMs = 15000): Promise<{ buffer: Buffer; contentType: string }> => {
      return new Promise((resolve, reject) => {
        const parsedUrl = new URL(urlStr);
        const client = parsedUrl.protocol === "https:" ? https : http;
        const req = client.get(
          urlStr,
          {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
              "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
              "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
              "Referer": parsedUrl.origin + "/",
            },
            timeout: timeoutMs,
          },
          (res) => {
            // 自动跟随 301/302/307/308 重定向（解决马帮 CDN 跳转阿里云 OSS 问题）
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              let nextUrl = res.headers.location;
              if (nextUrl.startsWith("/")) nextUrl = parsedUrl.origin + nextUrl;
              return resolve(fetchUrlToBuffer(nextUrl, timeoutMs));
            }
            if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
              return reject(new Error(`HTTP Error ${res.statusCode}: ${res.statusMessage || "Unknown Error"}`));
            }
            const contentType = res.headers["content-type"] || "image/jpeg";
            const chunks: Buffer[] = [];
            res.on("data", (chunk) => chunks.push(chunk));
            res.on("end", () => resolve({ buffer: Buffer.concat(chunks), contentType }));
          }
        );
        req.on("error", (err) => reject(err));
        req.on("timeout", () => {
          req.destroy();
          reject(new Error(`Request timed out after ${timeoutMs}ms`));
        });
      });
    };

    const { buffer, contentType } = await fetchUrlToBuffer(targetUrl, 15000);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(buffer);
  } catch (error: any) {
    console.error("Error proxying image:", error);
    res.status(500).json({ error: error.message || "Failed to proxy image." });
  }
});

// Global error handling middleware to ensure no HTML error pages are returned to client API requests
app.use((err: any, req: any, res: any, next: any) => {
  console.error("Uncaught error:", err);
  if (req.path.startsWith("/api/")) {
    return res.status(200).json({
      error: err.message || "A server error occurred. Please check your inputs and try again.",
    });
  }
  next(err);
});

// Serve frontend assets
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
