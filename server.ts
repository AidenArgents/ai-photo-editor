import express from "express";
import { DEFAULT_PROMPT_OPTIMIZER_SYSTEM } from "./components/editor/promptSettings";
import path from "path";
import fs from "fs";
import dns from "dns";
import http from "http";
import https from "https";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { setGlobalDispatcher, EnvHttpProxyAgent } from "undici";

// 强制优先使用 IPv4 解析，彻底解决访问马帮 instudio 及阿里云 CDN 时由于 IPv6 黑洞导致的 12000ms 超时假死问题
try {
  dns.setDefaultResultOrder("ipv4first");
} catch (e) {
  // 忽略不支持的环境
}

// 让 Node 的 fetch（Gemini / OpenAI / 图片代理）自动读取启动时设置的
// HTTP_PROXY / HTTPS_PROXY / NO_PROXY 环境变量（由 services/server-control.ps1
// 从 Windows 系统代理导入）。未设置代理环境变量时 EnvHttpProxyAgent 直接直连，
// 不影响无代理场景。
try {
  const proxyAgent = new EnvHttpProxyAgent();
  setGlobalDispatcher(proxyAgent);
  const proxyTarget = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || "";
  console.log(
    proxyTarget
      ? `Server: Node fetch will use proxy: ${proxyTarget}`
      : "Server: No HTTP proxy detected, Node fetch uses direct connection."
  );
} catch (e) {
  console.warn("Server: Failed to initialize proxy agent, using direct connection.", e);
}

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "1mb" }));

function getPublicErrorMessage(error: any): string {
  const cause = error?.cause;
  const code = cause?.code || error?.code || "";
  const causeMessage = cause?.message || "";

  if (code === "UND_ERR_CONNECT_TIMEOUT" || code === "ETIMEDOUT") {
    return "无法连接 Gemini API：连接 Google 服务器超时。请确认这台电脑能够访问 Google；如果使用代理，请开启系统代理或 TUN 模式，然后运行 重启.bat。仅浏览器代理扩展不会被本地服务使用。";
  }
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return "无法解析 Gemini API 域名。请检查电脑的 DNS 和网络连接，然后运行 重启.bat 重试。";
  }
  if (code === "ECONNRESET" || code === "ECONNREFUSED") {
    return "连接 Gemini API 时被网络或代理中断。请检查防火墙、代理设置，并运行 重启.bat 后重试。";
  }
  if (
    code === "CERT_HAS_EXPIRED" ||
    code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
    code === "SELF_SIGNED_CERT_IN_CHAIN"
  ) {
    return "连接 Gemini API 时证书验证失败。请检查系统时间、代理软件及其证书设置，然后运行 重启.bat。";
  }
  if (error?.message === "fetch failed" && causeMessage) {
    return `连接 Gemini API 失败：${causeMessage}`;
  }
  return error?.message || "An error occurred during image processing.";
}

type OpenAiImageQuality = "auto" | "low" | "medium" | "high" | "xhigh" | "max";

const OPENAI_IMAGE_SELECTIONS: Record<string, { model: string; quality: OpenAiImageQuality }> = {
  "gpt-image-2:auto": { model: "gpt-image-2", quality: "auto" },
  "gpt-image-2:low": { model: "gpt-image-2", quality: "low" },
  "gpt-image-2:medium": { model: "gpt-image-2", quality: "medium" },
  "gpt-image-2:high": { model: "gpt-image-2", quality: "high" },
  "gpt-image-2.5-sunburst:auto": { model: "gpt-image-2.5-sunburst", quality: "auto" },
  "gpt-image-2.5-sunburst:low": { model: "gpt-image-2.5-sunburst", quality: "low" },
  "gpt-image-2.5-sunburst:medium": { model: "gpt-image-2.5-sunburst", quality: "medium" },
  "gpt-image-2.5-sunburst:high": { model: "gpt-image-2.5-sunburst", quality: "high" },
  "gpt-image-2.5-sunburst:xhigh": { model: "gpt-image-2.5-sunburst", quality: "xhigh" },
  "gpt-image-2.5-sunburst:max": { model: "gpt-image-2.5-sunburst", quality: "max" },
  "gpt-image-2.5-flare:auto": { model: "gpt-image-2.5-flare", quality: "auto" },
  "gpt-image-2.5-flare:low": { model: "gpt-image-2.5-flare", quality: "low" },
  "gpt-image-2.5-flare:medium": { model: "gpt-image-2.5-flare", quality: "medium" },
  "gpt-image-2.5-flare:high": { model: "gpt-image-2.5-flare", quality: "high" },
  "gpt-image-2.5-flare:xhigh": { model: "gpt-image-2.5-flare", quality: "xhigh" },
  "gpt-image-2.5-flare:max": { model: "gpt-image-2.5-flare", quality: "max" },
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
  model: string;
  imageFiles: any[];
  secondaryImageFile?: any;
  prompt: string;
  quality: OpenAiImageQuality;
  aspectRatio: string;
}): Promise<string> {
  const form = new FormData();
  form.append("model", options.model);
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
      signal: AbortSignal.timeout(180_000),
    });
  } catch (error: any) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw new Error(
        "OpenAI 图片请求超过 180 秒未返回。可检查网络及服务状态；超时不代表服务端一定未生成，请勿连续重复提交。"
      );
    }
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

// Product originals and editable prompts are sent directly to the image model.

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
  { displayName: string }
> = {
  "gemini-2.5-flash-image": {
    displayName: "Nano Banana",
  },
  "gemini-3.1-flash-image": {
    displayName: "Nano Banana 2",
  },
  "gemini-3.1-flash-lite-image": {
    displayName: "Nano Banana 2 Lite",
  },
  "gemini-3-pro-image": {
    displayName: "Nano Banana Pro",
  },
  "gpt-image-2:auto": {
    displayName: "GPT Image 2（自动质量）",
  },
  "gpt-image-2:low": {
    displayName: "GPT Image 2（低质量）",
  },
  "gpt-image-2:medium": {
    displayName: "GPT Image 2（中等质量）",
  },
  "gpt-image-2:high": {
    displayName: "GPT Image 2（高质量）",
  },
  "gpt-image-2.5-sunburst:auto": {
    displayName: "GPT Image 2.5 Sunburst（自动质量）",
  },
  "gpt-image-2.5-sunburst:low": {
    displayName: "GPT Image 2.5 Sunburst（低质量）",
  },
  "gpt-image-2.5-sunburst:medium": {
    displayName: "GPT Image 2.5 Sunburst（中等质量）",
  },
  "gpt-image-2.5-sunburst:high": {
    displayName: "GPT Image 2.5 Sunburst（高质量）",
  },
  "gpt-image-2.5-sunburst:xhigh": {
    displayName: "GPT Image 2.5 Sunburst（超高质量）",
  },
  "gpt-image-2.5-sunburst:max": {
    displayName: "GPT Image 2.5 Sunburst（最高质量）",
  },
  "gpt-image-2.5-flare:auto": {
    displayName: "GPT Image 2.5 Flare（自动质量）",
  },
  "gpt-image-2.5-flare:low": {
    displayName: "GPT Image 2.5 Flare（低质量）",
  },
  "gpt-image-2.5-flare:medium": {
    displayName: "GPT Image 2.5 Flare（中等质量）",
  },
  "gpt-image-2.5-flare:high": {
    displayName: "GPT Image 2.5 Flare（高质量）",
  },
  "gpt-image-2.5-flare:xhigh": {
    displayName: "GPT Image 2.5 Flare（超高质量）",
  },
  "gpt-image-2.5-flare:max": {
    displayName: "GPT Image 2.5 Flare（最高质量）",
  },
};

function getRequestApiKey(req: any): string {
  const header = req.headers["x-gemini-api-key"];
  return (Array.isArray(header) ? header[0] : header)?.trim() || "";
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
    const expansionContext = {
      原始提示词: originalPrompt,
      目标生图模型: imageModelProfile.displayName,
      用户选择的模式: mergeMode,
    };

    const requestedSystemInstruction =
      typeof req.body?.promptOptimizerSystem === 'string'
        ? req.body.promptOptimizerSystem.trim()
        : '';
    const systemInstruction =
      requestedSystemInstruction && requestedSystemInstruction.length <= 12000
        ? requestedSystemInstruction
        : DEFAULT_PROMPT_OPTIMIZER_SYSTEM;
    if (requestedSystemInstruction.length > 12000) throw new Error('自定义优化规则过长（最多12000字符），未使用隐藏默认规则替代');
    const requestText = JSON.stringify(expansionContext, null, 2);

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: PROMPT_EXPANSION_MODEL,
      contents: [
        {
          parts: [
            {
              text: requestText,
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
      request: { stage:'prompt-optimizer',model:PROMPT_EXPANSION_MODEL,system:systemInstruction,contents:[{text:requestText}] },
      expansionModel: PROMPT_EXPANSION_MODEL,
      imageModelName: imageModelProfile.displayName,
      modeDescription: mergeMode,
      warnings: [],
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
      const imageFiles = req.files?.["images"] || (req.files?.["image"] ? [req.files["image"][0]] : []);
      const secondaryImageFile = req.files?.["secondaryImage"]?.[0];
      if (!imageFiles.length) return res.status(400).json({ error: "Main image is required." });
      if (typeof prompt !== "string" || !prompt.trim()) return res.status(400).json({ error: "Prompt is required." });
      const requestedModel = req.body.model || "gemini-2.5-flash-image";
      const openAiSelection = OPENAI_IMAGE_SELECTIONS[requestedModel];
      const imageMetadata = [...imageFiles, ...(secondaryImageFile ? [secondaryImageFile] : [])].map((file:any,index:number)=>({index:index+1,name:file.originalname,mimeType:file.mimetype,bytes:file.size}));
      const request = { stage:"image-api", revision:"2026-09-04.1", model:requestedModel, prompt:prompt.trim(), images:imageMetadata, parameters:{} as Record<string,unknown> };
      if (openAiSelection) {
        const apiKey=getRequestOpenAiApiKey(req);
        if(!apiKey) return res.status(400).json({error:"请填写 OpenAI API Key"});
        request.parameters={model:openAiSelection.model,quality:openAiSelection.quality,size:getOpenAiImageSize(aspectRatio)};
        const imageUrl=await editImageWithOpenAi({apiKey,model:openAiSelection.model,imageFiles,secondaryImageFile,prompt:prompt.trim(),quality:openAiSelection.quality,aspectRatio});
        return res.json({imageUrl,request});
      }
      const apiKey=getRequestApiKey(req);
      if(!apiKey) return res.status(400).json({error:"请填写 Gemini API Key"});
      const ai=new GoogleGenAI({apiKey,httpOptions:{timeout:180000}});
      const parts=imageFiles.map((file:any)=>bufferToGenerativePart(file.buffer,file.mimetype));
      if(secondaryImageFile)parts.push(bufferToGenerativePart(secondaryImageFile.buffer,secondaryImageFile.mimetype));
      parts.push({text:prompt.trim()});
      // "prompt" leaves the choice to the image model; no second AI call guesses a ratio.
      const config=aspectRatio!=="auto" && aspectRatio!=="prompt" ? {imageConfig:{aspectRatio}} : undefined;
      request.parameters=config||{};
      const imageUrl=await getImageAsBase64(ai,requestedModel,parts,config);
      return res.json({imageUrl,request});
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
