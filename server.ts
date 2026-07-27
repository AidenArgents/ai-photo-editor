import express from "express";
import path from "path";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Modality } from "@google/genai";

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
function buildDualImageSynchronizedPrompt(userPrompt: string, mergeMode: string, isPadded: boolean): string {
  const modeInstructions: Record<string, string> = {
    replace_background: `**PRIMARY TASK (Background Fusion & Scene Synthesis)**:
- IMAGE 1 contains our core commercial product subject. You MUST preserve its shape, textures, branding, typography, and material reflection with 100% pixel fidelity. Do NOT alter or deform the product itself!
- IMAGE 2 is the reference background scene blueprint. Extract its environmental lighting, architectural style, color palette, and composition.
- Seamlessly place the product from IMAGE 1 into the reference scene of IMAGE 2.
- **CRITICAL RELIGHTING & PHYSICAL SHADOW RULES (MANDATORY)**: Analyze the Key Light direction and color temperature of IMAGE 2. Render realistic physical contact shadows (Contact Shadows), ambient occlusion (AO), and ground reflections underneath and around the product from IMAGE 1 so it sits firmly on the surface without any sticker effect ("贴纸感").`,
    combine: `**PRIMARY TASK (Style, Atmosphere & Lighting Reference)**:
- IMAGE 1 is our main product/subject. Preserve its structure and identity accurately.
- IMAGE 2 serves as a visual blueprint for mood, lighting, aesthetic style, and color grading.
- Creatively blend the environmental lighting and aesthetic atmosphere of IMAGE 2 into the scene of IMAGE 1, ensuring natural shadow casting and harmonious color integration.`,
    replace_product: `**PRIMARY TASK (Product Replacement in Reference Scene)**:
- IMAGE 2 is the scene blueprint. Replace whatever product is originally in IMAGE 2 with the authentic product subject from IMAGE 1.
- Maintain the original scene's lighting, perspective, and depth of field. Ensure realistic shadow casting under our new product.`,
    add_logo: `**PRIMARY TASK (Logo / Watermark Superimposition)**:
- IMAGE 1 is the main photo. IMAGE 2 is the logo/watermark graphic.
- Overlay IMAGE 2 onto IMAGE 1 naturally while preserving transparency and sharp edges.`,
    replace_person: `**PRIMARY TASK (Person Identity Replacement)**:
- IMAGE 1 is the base photo. IMAGE 2 contains the target person identity.
- Swap the person identity into IMAGE 1 while matching facial features, skin tone reflections, lighting angles, and neck/body boundary shadows smoothly.`
  };

  const selectedInstruction = modeInstructions[mergeMode] || modeInstructions.combine;
  const paddingNote = isPadded 
    ? `\n**NOTE ON CANVAS PADDING**: The input image(s) have been pre-padded with solid white border bars to fit the target aspect ratio. You must seamlessly outpaint and fill these padded white border regions with coherent background textures and natural lighting extensions!` 
    : "";

  return `You are an elite commercial photography AI master and physical rendering engine. You are provided with TWO reference images and a user instruction.

# IMAGE ROLES:
- **IMAGE 1 (Main Product / Subject)**: The first image provided. This is our core commercial asset.
- **IMAGE 2 (Reference Blueprint)**: The second image provided. This serves as our target scene, style, or lighting blueprint.

${selectedInstruction}${paddingNote}

# USER'S SPECIFIC CUSTOM REQUEST:
"${userPrompt}"

# FINAL MASTER INSTRUCTION:
Generate a single, flawless, commercial-grade photograph that executes the Primary Task and Custom Request. Ensure zero sticker effect ("贴纸感") by strictly enforcing physical contact shadows and environmental light harmonization!`;
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
    { name: "secondaryImage", maxCount: 1 },
  ]),
  async (req: any, res: any) => {
    try {
      const prompt = req.body.prompt;
      const aspectRatio = req.body.aspectRatio || "auto";
      const highFidelityPreserve = req.body.highFidelityPreserve === "true";
      const mergeMode = req.body.mergeMode || "combine";

      const imageFile = req.files?.["image"]?.[0];
      const secondaryImageFile = req.files?.["secondaryImage"]?.[0];

      if (!imageFile) {
        return res.status(400).json({ error: "Main image is required." });
      }

      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required." });
      }

      // Retrieve custom API key from request headers or default to server key
      const customApiKey = req.headers["x-gemini-api-key"];
      const apiKey = customApiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(200).json({
          error: "Gemini API 密钥未配置。请在页面右上角的 API Key 输入框中粘贴您的个人 Gemini API 密钥，或者在服务器端配置 GEMINI_API_KEY 环境变量。",
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
      const editModel = req.body.model || "gemini-3.1-flash-lite-image";

      // Path 1: Auto / Original Aspect Ratio
      if (aspectRatio === "auto") {
        console.log("Server: Processing auto aspect-ratio image edit...");
        const imagePart = bufferToGenerativePart(imageFile.buffer, imageFile.mimetype);
        const parts: any[] = [imagePart];

        if (secondaryImageFile) {
          console.log(`Server: Applying Dual-Image Synchronized Engine (Mode: ${mergeMode})...`);
          parts.push(bufferToGenerativePart(secondaryImageFile.buffer, secondaryImageFile.mimetype));
          const dualPrompt = buildDualImageSynchronizedPrompt(prompt, mergeMode, false);
          parts.push({ text: optimizePromptForEditing(dualPrompt) });
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
        console.log("Server: Processing high fidelity preserve image edit...");
        const imagePart = bufferToGenerativePart(imageFile.buffer, imageFile.mimetype);
        const parts: any[] = [imagePart];

        if (secondaryImageFile) {
          console.log(`Server: Applying Dual-Image Synchronized Engine with Padding (Mode: ${mergeMode})...`);
          parts.push(bufferToGenerativePart(secondaryImageFile.buffer, secondaryImageFile.mimetype));
          const dualPrompt = buildDualImageSynchronizedPrompt(prompt, mergeMode, true);
          parts.push({ text: optimizePromptForEditing(dualPrompt) });
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
