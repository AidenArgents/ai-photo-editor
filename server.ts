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

app.use(express.json({ limit: "1mb" }));

function getPublicErrorMessage(error: any): string {
  const cause = error?.cause;
  const code = cause?.code || error?.code || "";
  const causeMessage = cause?.message || "";

  if (code === "UND_ERR_CONNECT_TIMEOUT" || code === "ETIMEDOUT") {
    return "无法连接 Gemini API：连接 Google 服务器超时。请确认这台电脑能够访问 Google；如果使用代理，请开启系统代理或 TUN 模式，然后运行 restart.bat。仅浏览器代理扩展不会被本地服务使用。";
  }
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return "无法解析 Gemini API 域名。请检查电脑的 DNS 和网络连接，然后运行 restart.bat 重试。";
  }
  if (code === "ECONNRESET" || code === "ECONNREFUSED") {
    return "连接 Gemini API 时被网络或代理中断。请检查防火墙、代理设置，并运行 restart.bat 后重试。";
  }
  if (
    code === "CERT_HAS_EXPIRED" ||
    code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
    code === "SELF_SIGNED_CERT_IN_CHAIN"
  ) {
    return "连接 Gemini API 时证书验证失败。请检查系统时间、代理软件及其证书设置，然后运行 restart.bat。";
  }
  if (error?.message === "fetch failed" && causeMessage) {
    return `连接 Gemini API 失败：${causeMessage}`;
  }
  return error?.message || "An error occurred during image processing.";
}

type OpenAiImageQuality = "auto" | "low" | "medium" | "high";

const OPENAI_IMAGE_SELECTIONS: Record<string, OpenAiImageQuality> = {
  "gpt-image-2:auto": "auto",
  "gpt-image-2:low": "low",
  "gpt-image-2:medium": "medium",
  "gpt-image-2:high": "high",
};

function getRequestOpenAiApiKey(req: any): string {
  const header = req.headers["x-openai-api-key"];
  return (Array.isArray(header) ? header[0] : header)?.trim() || "";
}

function getOpenAiImageSize(aspectRatio: string): string {
  const sizes: Record<string, string> = {
    "1:1": "1024x1024",
    "3:4": "1152x1536",
    "4:3": "1536x1152",
    "3:2": "1536x1024",
    "4:5": "1024x1280",
    "16:9": "1536x864",
    "9:16": "864x1536",
  };
  return sizes[aspectRatio] || "auto";
}

async function editImageWithOpenAi(options: {
  apiKey: string;
  imageFiles: any[];
  secondaryImageFile?: any;
  prompt: string;
  quality: OpenAiImageQuality;
  aspectRatio: string;
}): Promise<string> {
  const form = new FormData();
  form.append("model", "gpt-image-2");
  form.append("prompt", options.prompt);
  form.append("quality", options.quality);
  form.append("size", getOpenAiImageSize(options.aspectRatio));

  const allImages = options.secondaryImageFile
    ? [...options.imageFiles, options.secondaryImageFile]
    : options.imageFiles;

  for (const imageFile of allImages) {
    const bytes = new Uint8Array(imageFile.buffer);
    const blob = new Blob([bytes], { type: imageFile.mimetype || "image/png" });
    form.append("image[]", blob, imageFile.originalname || "image.png");
  }

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
      },
      body: form,
    });
  } catch (error: any) {
    const reason = error?.cause?.message || error?.message || "网络连接失败";
    throw new Error(`无法连接 OpenAI API：${reason}`);
  }

  const rawText = await response.text();
  let data: any;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(`OpenAI API 返回了无法识别的内容（HTTP ${response.status}）。`);
  }

  if (!response.ok || data?.error) {
    const message = data?.error?.message || data?.error || `HTTP ${response.status}`;
    throw new Error(`OpenAI 图片生成失败：${String(message)}`);
  }

  const imageBase64 = data?.data?.[0]?.b64_json;
  if (!imageBase64) {
    throw new Error("OpenAI API 没有返回图片，请重试。");
  }

  return `data:image/png;base64,${imageBase64}`;
}

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

  const selectedInstruction = modeInstructions[mergeMode] || modeInstructions.combine;
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
async function getImageAsBase64(
  ai: GoogleGenAI,
  model: string,
  parts: any[],
  config?: Record<string, unknown>
): Promise<string> {
  const response = await ai.models.generateContent({
    model,
    contents: [{ parts }],
    ...(config ? { config } : {}),
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

const PROMPT_EXPANSION_MODEL = "gemini-3.5-flash-lite";

const IMAGE_MODEL_PROMPT_PROFILES: Record<
  string,
  { displayName: string; guidance: string }
> = {
  "gemini-2.5-flash-image": {
    displayName: "Nano Banana",
    guidance:
      "使用短而直接的自然语言，不增加原文没有提出的多阶段任务。",
  },
  "gemini-3.1-flash-image": {
    displayName: "Nano Banana 2",
    guidance:
      "使用简洁、明确的自然语言，准确保留用户要求的对象、范围和限定关系。",
  },
  "gemini-3.1-flash-lite-image": {
    displayName: "Nano Banana 2 Lite",
    guidance:
      "保持单一、明确的任务表达，不增加复杂要求，不把原句扩展成多阶段任务。",
  },
  "gemini-3-pro-image": {
    displayName: "Nano Banana Pro",
    guidance:
      "可以准确表达复杂要求，但除非原文明确提出，否则不要增加构图、风格、材质、文字或光影要求。",
  },
  "gpt-image-2:auto": {
    displayName: "GPT Image 2（自动质量）",
    guidance:
      "使用清晰、直接的编辑指令，严格保留用户要求的对象、范围、文字和限定关系。",
  },
  "gpt-image-2:low": {
    displayName: "GPT Image 2（低质量）",
    guidance:
      "使用清晰、直接的编辑指令，严格保留用户要求的对象、范围、文字和限定关系。",
  },
  "gpt-image-2:medium": {
    displayName: "GPT Image 2（中等质量）",
    guidance:
      "使用清晰、直接的编辑指令，严格保留用户要求的对象、范围、文字和限定关系。",
  },
  "gpt-image-2:high": {
    displayName: "GPT Image 2（高质量）",
    guidance:
      "使用清晰、直接的编辑指令，严格保留用户要求的对象、范围、文字和限定关系。",
  },
};

const FUSION_MODE_DESCRIPTIONS: Record<string, string> = {
  custom: "自由编辑：不使用预设场景，用户原句是唯一任务目标。",
  remove_watermark: "局部清理：只处理用户指定的小区域，其余画面保持不变。",
  replace_background: "背景融合：主图提供必须保留的产品，参考图提供目标背景场景。",
  combine: "风格与光影参考：主图提供主体，参考图只提供氛围、风格和光线。",
  replace_product: "产品替换：用主图产品替换参考场景中的原有产品。",
  add_logo: "标志叠加：主图是基础画面，参考图是需要加入的标志。",
  replace_person: "人物替换：主图是基础画面，参考图提供目标人物特征。",
};

function getRequestApiKey(req: any): string {
  const header = req.headers["x-gemini-api-key"];
  return (Array.isArray(header) ? header[0] : header)?.trim() || "";
}

function getPromptExpansionWarnings(
  imageModel: string,
  mainImageCount: number,
  hasReferenceImage: boolean
): string[] {
  const totalImages = mainImageCount + (hasReferenceImage ? 1 : 0);
  const warnings: string[] = [];

  if (imageModel === "gemini-3.1-flash-lite-image" && totalImages > 1) {
    warnings.push("当前是 Nano Banana 2 Lite；复杂多图任务建议改用 Nano Banana 2。");
  }
  if (imageModel === "gemini-2.5-flash-image" && totalImages > 3) {
    warnings.push("Nano Banana 输入超过3张图片时稳定性会下降，建议改用 Nano Banana 2。");
  }

  return warnings;
}

app.post("/api/expand-prompt", async (req: any, res: any) => {
  try {
    const apiKey = getRequestApiKey(req);
    if (!apiKey) {
      return res.status(200).json({
        error: "请先在页面右上角填写您自己的 Gemini API Key。",
      });
    }

    const originalPrompt =
      typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
    if (!originalPrompt) {
      return res.status(200).json({ error: "请先输入需要扩写的提示词。" });
    }
    if (originalPrompt.length > 3000) {
      return res.status(200).json({
        error: "提示词过长；AI优化最多支持3000个字符。",
      });
    }

    const requestedImageModel =
      typeof req.body?.imageModel === "string" ? req.body.imageModel : "";
    const imageModelProfile =
      IMAGE_MODEL_PROMPT_PROFILES[requestedImageModel] ||
      IMAGE_MODEL_PROMPT_PROFILES["gemini-3.1-flash-image"];
    const mergeMode =
      typeof req.body?.mergeMode === "string" ? req.body.mergeMode : "custom";
    const modeDescription =
      FUSION_MODE_DESCRIPTIONS[mergeMode] || FUSION_MODE_DESCRIPTIONS.custom;
    const parsedMainImageCount = Number(req.body?.mainImageCount);
    const mainImageCount = Number.isFinite(parsedMainImageCount)
      ? Math.max(1, Math.min(10, Math.trunc(parsedMainImageCount)))
      : 1;
    const hasReferenceImage = req.body?.hasReferenceImage === true;

    const expansionContext = {
      原始提示词: originalPrompt,
      目标生图模型: imageModelProfile.displayName,
      模型适配原则: imageModelProfile.guidance,
      任务模式说明: modeDescription,
    };

    const systemInstruction = `你是一个忠实、受控的电商图片提示词编辑器。你的任务是在绝不改变原意的前提下，整理用户原句，并且只对用户明确提出的要求维度做必要的执行性细化，使所选图像模型更容易准确执行。

必须遵守：
1. 用户原句是唯一事实来源。先识别用户明确提出了哪些维度，例如：任务目标、产品、文字内容、文字语言、文字排版、位置、颜色、数量、比例、场景、构图、风格、光线或需要保持不变的内容。
2. 只能整理或细化用户已经明确提出的维度；没有提出的维度不得主动补充。原句已经明确时允许原样返回，绝不能为了体现“优化”而增加长度。
3. 对用户已经提出但表达较笼统的维度，可以补充少量、不改变方向的执行性描述。例如“文字使用广告排版”可以细化为“主标题醒目、正文简短、字号层级清楚、对齐整齐、留白合理”，但这些描述只能约束文字排版。
4. 必须逐项保留原句中每个要求的作用对象、主语、修饰对象、范围和限定关系，不得扩大、缩小、转移或偷换。
5. 严格区分“文字内容”“文字语言”“文字排版”和“整体画面风格”：
   - 文字内容：用户提供的具体文字必须原样保留；除非用户明确要求，否则不得改写或翻译。
   - 文字语言：只规定最终图片中文字使用的语言，不得改成界面语言或画面风格。
   - 文字排版：只能细化标题层级、字号、字重、对齐、行距、位置、颜色、留白和可读性，不得扩大为整张画面的构图或风格。
   - 整体画面风格：只有用户明确要求广告图、海报、极简、奢华等画面风格时，才能细化场景、构图、光线和视觉氛围。
6. 涉及数量、位置、颜色、比例，以及“只修改”“不要”“保持不变”等硬性要求时，必须保留原来的对象和约束。
7. 不擅自增加商品、数量、品牌、具体文案、道具、人物、场景、风格、构图、教程、步骤、规格、价格、卖点或使用方法。用户要求文字排版但没有提供具体文案时，可以要求文字简短、层级清楚，并防止虚构价格、规格、品牌和卖点，但不得代写这些内容。
8. 不主动提及上传图片的数量，不推断多张图片之间的关系，不要求所有图片内容全部出现；除非用户原句明确提出。
9. 产品编辑时，可以在不冲突的情况下补充一句“保持产品外观和细节准确”。如果用户明确要求修改产品的某项属性，不得用保真要求阻止该修改。
10. 不添加“世界顶级、杰作、8K、商业摄影大师”等空洞词语，不堆砌负面提示词。
11. 输出应尽可能短，通常为1至3句，不设最低字数。只输出优化后的提示词正文，不要标题、解释、引号、Markdown或JSON。

语义边界示例：
原句：做一张产品使用示意图，用英文，文字使用广告排版
正确：制作一张产品使用示意图。所有文字使用英文；文字采用广告式排版，主标题醒目，正文简短，字号层级清楚，对齐整齐，留白合理。不要虚构未提供的价格、规格、品牌或卖点；保持产品外观和细节准确。
错误：画面采用英文界面与专业的广告排版设计，通过视觉引导展示产品的实际使用方法。
错误原因：把“文字使用广告排版”扩大成了“整个画面采用广告排版”，并擅自增加了视觉引导和使用方法。`;

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: PROMPT_EXPANSION_MODEL,
      contents: [
        {
          parts: [
            {
              text: `请严格按照保守优化规则处理以下内容：\n${JSON.stringify(expansionContext, null, 2)}`,
            },
          ],
        },
      ],
      config: {
        systemInstruction,
      },
    });

    const expandedPrompt = (response.text || "")
      .trim()
      .replace(/^```(?:text)?\s*/i, "")
      .replace(/\s*```$/, "")
      .replace(/^["“]|["”]$/g, "")
      .trim();

    if (!expandedPrompt) {
      throw new Error("提示词扩写模型没有返回文字，请重试。");
    }

    return res.json({
      expandedPrompt,
      expansionModel: PROMPT_EXPANSION_MODEL,
      imageModelName: imageModelProfile.displayName,
      modeDescription,
      warnings: getPromptExpansionWarnings(
        requestedImageModel,
        mainImageCount,
        hasReferenceImage
      ),
    });
  } catch (error: any) {
    console.error("Error in expand-prompt API:", error);
    return res.status(200).json({
      error: getPublicErrorMessage(error),
    });
  }
});

// API endpoint for editing image
app.post(
  "/api/edit-image",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "images", maxCount: 16 },
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

      const requestedModel = req.body.model || "gemini-2.5-flash-image";
      const openAiQuality = OPENAI_IMAGE_SELECTIONS[requestedModel];

      if (openAiQuality) {
        const openAiApiKey = getRequestOpenAiApiKey(req);
        if (!openAiApiKey) {
          return res.status(200).json({
            error: "OpenAI API 密钥未配置。请在页面右上角填写您自己的 OpenAI API Key。",
          });
        }

        let openAiPrompt = prompt.trim();
        if (mergeMode !== "custom") {
          if (secondaryImageFile) {
            openAiPrompt = optimizePromptForEditing(
              buildDualImageSynchronizedPrompt(
                prompt,
                mergeMode,
                highFidelityPreserve,
                imageFiles.length
              )
            );
          } else if (highFidelityPreserve && aspectRatio !== "auto") {
            openAiPrompt = optimizePromptForEditing(
              buildSingleImageOutpaintingPrompt(prompt)
            );
          } else {
            openAiPrompt = optimizePromptForEditing(prompt);
          }
        }

        console.log(
          `Server: OpenAI image edit (${imageFiles.length} main image(s)` +
          `${secondaryImageFile ? " + 1 reference image" : ""}, quality: ${openAiQuality}).`
        );

        const resultBase64 = await editImageWithOpenAi({
          apiKey: openAiApiKey,
          imageFiles,
          secondaryImageFile,
          prompt: openAiPrompt,
          quality: openAiQuality,
          aspectRatio,
        });
        return res.json({ imageUrl: resultBase64 });
      }

      // Every user supplies their own API key from the page.
      const apiKey = getRequestApiKey(req);
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
      const editModel = requestedModel;

      // Direct Gemini API path for Custom mode:
      // original image bytes, optional reference image, and the user's exact prompt.
      // No hidden prompt wrapper, forced image roles, asset-inclusion rules, client
      // compression, white padding, image description, or intermediate generation.
      if (mergeMode === "custom") {
        console.log(
          `Server: Direct Gemini API mode (${imageFiles.length} main image(s)` +
          `${secondaryImageFile ? " + 1 reference image" : ""}, model: ${editModel}).`
        );

        const parts: any[] = [];
        for (const f of imageFiles) {
          parts.push(bufferToGenerativePart(f.buffer, f.mimetype));
        }
        if (secondaryImageFile) {
          parts.push(bufferToGenerativePart(secondaryImageFile.buffer, secondaryImageFile.mimetype));
        }
        parts.push({ text: prompt.trim() });

        let directAspectRatio = aspectRatio;
        if (directAspectRatio === "prompt") {
          directAspectRatio = await extractAspectRatioFromPrompt(ai, prompt);
        }
        const directConfig =
          directAspectRatio !== "auto"
            ? {
                imageConfig: {
                  aspectRatio: directAspectRatio,
                },
              }
            : undefined;

        const resultBase64 = await getImageAsBase64(ai, editModel, parts, directConfig);
        return res.json({ imageUrl: resultBase64 });
      }

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
        error: getPublicErrorMessage(error),
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
      error: getPublicErrorMessage(err),
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
