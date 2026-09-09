(function () {
  'use strict';

  const FALLBACK_MODEL = 'gemini-3.5-flash-lite';

  async function readApiError(response) {
    let detail = '';
    try {
      const payload = await response.clone().json();
      detail = payload?.error?.message || payload?.message || '';
    } catch (_) {
      try {
        detail = await response.clone().text();
      } catch (_) {}
    }

    detail = String(detail || '').replace(/\s+/g, ' ').trim();
    return detail ? `API ${response.status}：${detail.slice(0, 220)}` : `API ${response.status}`;
  }

  async function request(apiKey, model, body) {
    return fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        signal: AbortSignal.timeout(180000),
        body: JSON.stringify(body),
      }
    );
  }

  function syncSelectedModel(model) {
    const select = document.getElementById('txtMdl');
    if (!select || !Array.from(select.options).some((option) => option.value === model)) return;

    select.value = model;
    try {
      if (typeof window.saveSettings === 'function') window.saveSettings();
    } catch (_) {}
  }

  async function generateContent(apiKey, selectedModel, body) {
    // The caller owns an immutable job snapshot. Never replace it with a later UI selection.
    const model = String(selectedModel || '').trim() || FALLBACK_MODEL;
    let response = await request(apiKey, model, body);

    if (response.status === 404 && model !== FALLBACK_MODEL) {
      const fallbackResponse = await request(apiKey, FALLBACK_MODEL, body);
      if (fallbackResponse.ok) {
        // Do not change the user's selection while another task may be using it.
        console.warn(`[Gemini Text] ${model} 对当前 API Key 不可用，已切换为 ${FALLBACK_MODEL}。`);
        return { ...await fallbackResponse.json(), _effectiveModel: FALLBACK_MODEL };
      }

      throw new Error(await readApiError(fallbackResponse));
    }

    if (!response.ok) throw new Error(await readApiError(response));
    return { ...await response.json(), _effectiveModel: model };
  }

  window.GeminiTextApi = Object.freeze({
    fallbackModel: FALLBACK_MODEL,
    generateContent,
  });
})();
