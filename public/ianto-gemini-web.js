(function () {
  'use strict';

  const CLIENT_ID = 'ai-photo-editor-gemini-web';
  const PROTOCOL_VERSION = 2;
  const CLIENT_BUILD = '2026-09-08.4';
  const PING_REQUEST = 'REQUEST_IANTO_GEMINI_WEB_PING';
  const PING_RESPONSE = 'RESPONSE_IANTO_GEMINI_WEB_PING';
  const JOB_REQUEST = 'REQUEST_GEMINI_WEB_IMAGE';
  const JOB_RESPONSE = 'RESPONSE_GEMINI_WEB_IMAGE';
  const JOB_PROGRESS = 'PROGRESS_GEMINI_WEB_IMAGE';
  const JOB_CANCEL = 'CANCEL_GEMINI_WEB_IMAGE';
  const MAX_TOTAL_IMAGE_BYTES = 48 * 1024 * 1024;
  // Ianto 内部最多等待“上一张结束 12 分钟 + 当前生成 12 分钟”；外层多留一分钟用于回传。
  const WEB_JOB_TIMEOUT_MS = 26 * 60 * 1000;
  const pending = new Map();

  function makeId(prefix) {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
      return prefix + '_' + globalThis.crypto.randomUUID();
    }
    return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  }

  function abortError() {
    const error = new Error('网页作图已由新的操作接管');
    error.name = 'AbortError';
    return error;
  }

  function estimateDataUrlBytes(dataUrl) {
    const comma = dataUrl.indexOf(',');
    if (comma < 0) return 0;
    return Math.ceil((dataUrl.length - comma - 1) * 0.75);
  }

  function imageExtensionFromDataUrl(dataUrl) {
    const match = /^data:image\/([^;,]+)/i.exec(String(dataUrl || ''));
    const subtype = (match?.[1] || 'png').toLowerCase();
    if (subtype === 'jpeg' || subtype === 'jpg') return 'jpg';
    if (subtype === 'webp') return 'webp';
    if (subtype === 'gif') return 'gif';
    return 'png';
  }

  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.onerror = function () { reject(new Error('远程图片转换失败')); };
      reader.readAsDataURL(blob);
    });
  }

  async function ensureImageDataUrl(value) {
    let source = String(value || '').trim();
    if (source.startsWith('//')) source = 'https:' + source;
    if (source.startsWith('data:image/')) return source;
    if (!/^https?:\/\//i.test(source)) throw new Error('图片不是有效的本地数据或网络地址');
    const response = await fetch('/api/proxy-image?url=' + encodeURIComponent(source));
    if (!response.ok) throw new Error('远程图片下载失败（HTTP ' + response.status + '）');
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) throw new Error('远程地址返回的内容不是图片');
    const dataUrl = await blobToDataUrl(blob);
    if (!dataUrl.startsWith('data:image/')) throw new Error('远程图片转换失败');
    return dataUrl;
  }

  function normalizeImageName(item, index) {
    const extension = imageExtensionFromDataUrl(item.dataUrl);
    const fallback = String(index + 1).padStart(2, '0') + '-' + (item.role || 'image');
    const supplied = String(item.name || fallback).trim();
    const stem = supplied.replace(/\.[a-z0-9]+$/i, '') || fallback;
    return stem + '.' + extension;
  }

  function normalizeAspectRatioPrompt(prompt, aspectRatio) {
    const ratio = String(aspectRatio || 'auto');
    const ratioValue = '(?:1\\s*[:：x×]\\s*1|3\\s*[:：x×]\\s*4|4\\s*[:：x×]\\s*3|3\\s*[:：x×]\\s*2|2\\s*[:：x×]\\s*3|4\\s*[:：x×]\\s*5|5\\s*[:：x×]\\s*4|16\\s*[:：x×]\\s*9|9\\s*[:：x×]\\s*16)';
    const patterns = [
      // 只清理具有明确“画幅/宽高比”语义的表达，避免把配色比例、
      // 产品比例、正方形构图或 vertical composition 等内容误删。
      new RegExp('\\b(?:(?:output|final(?:\\s+image)?|image|canvas)\\s+)?aspect\\s*ratio\\s*(?:of|is|=|:|-)?\\s*' + ratioValue, 'gi'),
      new RegExp('\\b(?:vertical|horizontal|portrait|landscape|square)\\s*(?:image\\s+)?(?:format|orientation|aspect\\s*ratio)?\\s*(?:in|at|of|=|:|-)?\\s*' + ratioValue, 'gi'),
      new RegExp(ratioValue + '\\s*(?:aspect\\s*ratio|image\\s*format|canvas\\s*format)', 'gi'),
      new RegExp('\\b(?:vertical|horizontal|portrait|landscape|square)\\s+(?:image\\s+)?(?:aspect\\s*ratio|format|orientation)\\b', 'gi'),
      new RegExp('(?:输出|最终(?:图片|图像|成图)?|图片|图像|画面|画布|成图)?(?:宽高比|画幅比例|输出比例)\\s*(?:为|是|=|:|：|-)?\\s*' + ratioValue, 'gi'),
      new RegExp('(?:竖版|横版|竖屏|横屏|正方形)(?:画幅|格式|方向)?\\s*(?:为|是|=|:|：|-)?\\s*' + ratioValue, 'gi'),
      new RegExp(ratioValue + '\\s*(?:宽高比|画幅比例|输出比例|画幅格式)', 'gi')
    ];

    let cleaned = String(prompt || '').trim();
    patterns.forEach(function (pattern) {
      cleaned = cleaned.replace(pattern, ' ');
    });
    cleaned = cleaned
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\s+([,，.;；])/g, '$1')
      .replace(/([,，;；])\s*([,，;；])/g, '$1')
      .replace(/[,，;；]\./g, '.')
      .replace(/^[,，.;；\s]+|[,，;；\s]+$/g, '')
      .trim();

    const instruction = ratio === 'auto'
      ? 'OUTPUT ASPECT RATIO — HIGHEST PRIORITY: Preserve the same aspect ratio and orientation as the first uploaded product image. This replaces conflicting canvas-format wording elsewhere in this request.'
      : `OUTPUT ASPECT RATIO — HIGHEST PRIORITY: Generate the final image in exactly ${ratio}. This replaces conflicting canvas-format wording elsewhere in this request.`;
    return instruction + (cleaned ? '\n\n' + cleaned : '');
  }

  function settle(requestId, detail) {
    const entry = pending.get(requestId);
    if (!entry) return;
    pending.delete(requestId);
    clearTimeout(entry.timer);
    entry.cleanup?.();
    if (detail && detail.success) entry.resolve(detail);
    else entry.reject(new Error(detail?.error || 'Ianto 未能完成网页作图任务'));
  }

  document.addEventListener(PING_RESPONSE, function (event) {
    const detail = event.detail || {};
    settle(detail.requestId, detail);
  });

  document.addEventListener(JOB_RESPONSE, function (event) {
    const detail = event.detail || {};
    settle(detail.requestId || detail.jobId, detail);
  });

  document.addEventListener(JOB_PROGRESS, function (event) {
    const detail = event.detail || {};
    const requestId = detail.requestId || detail.jobId;
    if (!requestId || !pending.has(requestId)) return;
    const element = document.getElementById('geminiWebStatus');
    if (!element || !detail.status) return;
    element.textContent = detail.status;
    element.style.color = detail.type === 'success' ? '#059669' : detail.type === 'error' ? '#dc2626' : '#2563eb';
  });

  function request(eventName, payload, timeoutMs, signal) {
    const requestId = payload.requestId || makeId('gmw');
    return new Promise(function (resolve, reject) {
      if (signal?.aborted) {
        reject(abortError());
        return;
      }
      const timer = setTimeout(function () {
        const entry = pending.get(requestId);
        pending.delete(requestId);
        entry?.cleanup?.();
        reject(new Error('等待 Ianto 超时。请确认插件已安装、已启用，并刷新本页面后重试'));
      }, timeoutMs);
      const onAbort = function () {
        const entry = pending.get(requestId);
        if (!entry) return;
        pending.delete(requestId);
        clearTimeout(timer);
        document.dispatchEvent(new CustomEvent(JOB_CANCEL, { detail: { client: CLIENT_ID, jobId: requestId } }));
        reject(abortError());
      };
      if (signal) signal.addEventListener('abort', onAbort, { once: true });
      pending.set(requestId, { resolve, reject, timer, cleanup: () => signal?.removeEventListener('abort', onAbort) });
      document.dispatchEvent(new CustomEvent(eventName, {
        detail: Object.assign({}, payload, { client: CLIENT_ID, requestId })
      }));
    });
  }

  async function ping() {
    const result = await request(PING_REQUEST, { protocolVersion: PROTOCOL_VERSION, clientBuild: CLIENT_BUILD }, 5000);
    if (result.protocolVersion !== PROTOCOL_VERSION || result.bridgeBuild !== CLIENT_BUILD || result.backgroundBuild !== CLIENT_BUILD) {
      throw new Error('[VERSION_MISMATCH] 网页=' + CLIENT_BUILD + '，桥接=' + (result.bridgeBuild || 'legacy') + '，后台=' + (result.backgroundBuild || result.version || 'unknown') + '。需加载配套 Ianto 2.6.9；刷新网页不会重载插件后台。');
    }
    return result;
  }

  async function updateConnectionStatus() {
    const element = document.getElementById('geminiWebStatus');
    if (!element) return;
    element.textContent = '正在检测 Ianto...';
    element.style.color = '';
    try {
      const result = await ping();
      element.textContent = `Ianto ${result.version || ''} 已连接，可自动使用 Gemini / ChatGPT 网页`.replace(/\s+/g, ' ').trim();
      element.style.color = '#059669';
    } catch (error) {
      element.textContent = error?.message?.includes('VERSION_MISMATCH') ? error.message : 'Ianto 连接检测失败：' + error.message;
      element.style.color = '#dc2626';
      element.title = error?.message || '';
    }
  }

  async function generate(options) {
    const prompt = String(options?.prompt || '').trim();
    if (!prompt) throw new Error('没有可发送给网页的提示词');
    if (options?.signal?.aborted) throw abortError();
    const compatibility = await ping();
    if (options?.signal?.aborted) throw abortError();

    const sourceImages = (Array.isArray(options?.images) ? options.images : [])
      .filter(function (item) { return item && typeof item.dataUrl === 'string' && item.dataUrl.trim(); });
    const resolvedImages = await Promise.all(sourceImages.map(async function (item, index) {
      try {
        return Object.assign({}, item, { dataUrl: await ensureImageDataUrl(item.dataUrl) });
      } catch (error) {
        throw new Error(`第 ${index + 1} 张图片读取失败：${error?.message || '未知错误'}`);
      }
    }));
    const images = resolvedImages
      .filter(function (item) { return item.dataUrl.startsWith('data:image/'); })
      .map(function (item, index) {
        const normalized = {
          dataUrl: item.dataUrl,
          role: item.role || (index === 0 ? 'product' : 'reference'),
          name: ''
        };
        normalized.name = normalizeImageName(normalized, index);
        return normalized;
      });
    if (!images.length) throw new Error('至少需要一张产品图片');

    const totalBytes = images.reduce(function (sum, item) { return sum + estimateDataUrlBytes(item.dataUrl); }, 0);
    if (totalBytes > MAX_TOTAL_IMAGE_BYTES) {
      throw new Error('待上传图片合计超过 48MB，请缩小图片后重试');
    }

    const provider = options?.provider === 'chatgpt' ? 'chatgpt' : 'gemini';
    if (!compatibility.providers.includes(provider)) throw new Error('[PROVIDER] Ianto 后台未声明支持 ' + provider);
    const aspectRatio = options?.aspectRatio || 'auto';
    const normalized = normalizeAspectRatioPrompt(prompt, aspectRatio);
    const finalPrompt = provider === 'chatgpt' && !/\$imagegen\b/i.test(normalized) ? normalized + '\n\n$imagegen' : normalized;
    const trace = globalThis.PhotoCreative?.record({ stage: 'web-submit', provider, prompt: finalPrompt, compatibility, parameters: { aspectRatio }, images: images.map(({role,name},index)=>({index:index+1,role,name})) });
    let result;
    try { result = await request(JOB_REQUEST, {
      prompt: finalPrompt,
      protocolVersion: PROTOCOL_VERSION,
      clientBuild: CLIENT_BUILD,
      images,
      provider,
      aspectRatio,
      conversationKey: String(options?.conversationKey || 'default'),
      taskLabel: String(options?.taskLabel || 'AI Photo Editor'),
      restoreEditor: !!options?.restoreEditor
    }, WEB_JOB_TIMEOUT_MS, options?.signal); }
    catch (error) { if (trace) {trace.status='error';trace.error=error.message;} throw error; }

    if (!result.imageDataUrl || !result.imageDataUrl.startsWith('data:image/')) {
      throw new Error(provider + ' 网页已完成任务，但 Ianto 没有收到有效图片');
    }
    if (trace) trace.status = 'success';
    return result.imageDataUrl;
  }

  const generateWithProvider = (provider) => (options) => generate(Object.assign({}, options, { provider }));
  globalThis.IantoWebImage = Object.freeze({ ping, generate, refreshStatus: updateConnectionStatus, clientId: CLIENT_ID });
  globalThis.IantoGeminiWeb = Object.freeze({ ping, generate: generateWithProvider('gemini'), refreshStatus: updateConnectionStatus, clientId: CLIENT_ID });
  globalThis.IantoChatGPTWeb = Object.freeze({ ping, generate: generateWithProvider('chatgpt'), refreshStatus: updateConnectionStatus, clientId: CLIENT_ID });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', updateConnectionStatus, { once: true });
  else updateConnectionStatus();

  let lastStatusElement = null;
  const statusObserver = new MutationObserver(function () {
    const element = document.getElementById('geminiWebStatus');
    if (element && element !== lastStatusElement) {
      lastStatusElement = element;
      updateConnectionStatus();
    }
  });
  statusObserver.observe(document.documentElement, { childList: true, subtree: true });
})();
