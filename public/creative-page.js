/* Shared controller for the four business pages. Page-specific UI/data remain in their HTML. */
(function () {
  'use strict';
  const core = window.PhotoCreative;
  const mode = PROMPT_MODE;
  const el = id => document.getElementById(id);
  const value = id => el(id)?.value || '';
  const copy = data => JSON.parse(JSON.stringify(data));
  let busy = false;
  let promptDna = '';
  let promptPlanSignature = '';
  let fbaPreparedSignature = '';
  let imageRun = null;
  let geminiWebConversationKey = (typeof window !== 'undefined' && typeof window.geminiWebConversationKey === 'string' && window.geminiWebConversationKey)
    ? window.geminiWebConversationKey
    : mode + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  function context() {
    return {
      mode, spu: value('pSku'), info: value('iInfo'),
      marketCode: mode === 'fba' ? 'US' : value('iMkt2'), market: gMarket(),
      lang: gLang(), model: gModel(), aspectRatio: value('iAR'), style: value('iStyle'),
      platform: mode === 'fba' ? 'amazon' : value('creativePlatform') || 'neutral',
      surface: value('creativeSurface') || 'auto', category: value('creativeCategory') || 'general',
      brand: value('creativeBrand'), productLock: value('creativeProductLock'),
      productSignature: mode === 'fba' ? '' : core.fingerprint([prodImgData, refImgData]),
      tasks: mode === 'fba' ? parsedTasks.map(t => ({ id: t.task_id, name: t.name, requirement: t.concept, ratio: t.aspect_ratio })) : undefined,
      schemeOptions: mode === 'taotu' ? null : { useA: el('useA')?.checked, useB: el('useB')?.checked, countA: value('cntA'), countB: value('cntB'), selectedTasks: mode === 'fba' && typeof vcTaskSelected !== 'undefined' ? [...vcTaskSelected] : undefined },
      settingsSignature: core.fingerprint(CUR_PROMPTS),
    };
  }
  const flow = core.mount(mode, () => CUR_PROMPTS, context);
  flow.update();
  function error(message) {
    const warning = el('vW') || el('vW1'); warning?.classList.remove('hid');
    const target = el('vM') || el('vM1'); if (target) target.textContent = message;
  }
  function clearError() { (el('vW') || el('vW1'))?.classList.add('hid'); }
  async function exclusive(action) {
    if (busy) { error('当前任务仍在运行，请等待本次请求结束后再发起新任务。'); return; }
    busy = true;
    try { clearError(); return await action(); }
    catch (cause) { error(cause.message || '任务失败'); }
    finally { busy = false; flow.update(); }
  }
  const originals = () => [prodImgData && { dataUrl: prodImgData, role: 'PRODUCT SOURCE' }, refImgData && { dataUrl: refImgData, role: 'STYLE/SCENE REFERENCE' }].filter(Boolean);
  function dna() {
    const raw = value('creativeDna');
    return raw.trim() ? core.parseMap(raw, '视觉DNA') : {};
  }
  function showDna(result) { if (el('creativeDna')) el('creativeDna').value = JSON.stringify(result, null, 2); }
  function options(stage, token, settings, images, input, schema) {
    const key = value('aKey').trim(); if (!key) throw new Error('请先填写用于方案和提示词的 Gemini API Key');
    return { apiKey: token.apiKey || key, model: token.textModel || value('txtMdl'), mode, stage, settings, context: token.context, images, input, schema, isCurrent: () => flow.current(token) };
  }

  async function generateSchemes(overrideStyle) {
    const shouldAuto = !!el('autoMode')?.checked;
    let ready = false;
    await exclusive(async () => {
      if (mode !== 'fba' && !prodImgData) throw new Error('请上传产品图片');
      if (mode === 'fba' && !parsedTasks.length) throw new Error('请先导入或填写作图任务');
      if (overrideStyle) el('iStyle').value = overrideStyle;
      const token = flow.begin(); token.textModel = value('txtMdl'); token.apiKey = value('aKey').trim();
      const settings = copy(CUR_PROMPTS), imagesSnapshot = originals();
      const btn = el('genConBtn'); btn.disabled = true; btn.textContent = '⏳ 按本次产品与市场生成方案…';
      try {
        if (mode === 'taotu') {
          const result = await core.requestText(options('scheme', token, settings, imagesSnapshot, { purpose: '9张图的完整方案，第一张主图；每个槽位一个明确任务', knowledge: core.knowledge(KB, settings) }, core.schemeSchema(mode, 9)));
          flow.assert(token);
          const fallbackIcons = ['🧴', '✨', '🌿', '📦', '💧', '🌸', '🔍', '🎯', '👑'];
          SLOTS = result.slots.map((slot, index) => {
            const rawI = (slot.i || '').trim();
            const isEmoji = rawI && rawI.length <= 4 && !/[a-zA-Z0-9\u4e00-\u9fa5]/.test(rawI);
            return { id: index + 1, ...slot, i: isEmoji ? rawI : (fallbackIcons[index] || '🎨') };
          });
          concepts = result.concepts.map((item, index) => ({ ...SLOTS[index], concept: item.concept, ok: false }));
          recStyles = result.styles; activeStyle = token.context.style;
          clearStep3(); clearStep4(); renderStyleRec(); renderCC(); showDna(result.dna); flow.accept(token, result.dna);
        } else if (mode === 'fba') {
          const tasks = getSelectedFbaTasks();
          if (!tasks.length) throw new Error('请至少选择一个原始任务');
          const count = normalizePerTaskCount(value('cntA'));
          const item = core.object(['icon', 'name', 'type_label', 'design_plan']);
          item.properties.task_index = { type: 'integer' }; item.properties.variant_index = { type: 'integer' }; item.required.push('task_index', 'variant_index');
          const schema = { type: 'object', properties: { dna: core.object(['palette', 'materials', 'lighting', 'typography', 'copyVoice', 'variation']), variants: core.array(item, tasks.length * count) }, required: ['dna', 'variants'], additionalProperties: false };
          const result = await core.requestText(options('scheme', token, settings, imagesSnapshot, { tasks: tasks.map((task, index) => ({ task_index: index + 1, task_id: task.task_id, name: task.name, requirement: task.concept, ratio: task.aspect_ratio })), variantsPerTask: count, total: tasks.length * count, indexContract: 'task_index从1开始；每个任务的variant_index必须恰为1到variantsPerTask，不得重复或漏项', knowledge: core.knowledge(KB, settings) }, schema));
          const pairs = new Set(result.variants.map(v => v.task_index + ':' + v.variant_index));
          if (pairs.size !== tasks.length * count || result.variants.some(v => v.task_index < 1 || v.task_index > tasks.length || v.variant_index < 1 || v.variant_index > count)) throw new Error('方案任务编号重复、遗漏或越界，未覆盖现有方案');
          flow.assert(token);
          vcPlanA = normalizeTaskVariants(tasks, count, result.variants); vcPlanB = [];
          vcSelected = new Set(vcPlanA.map((_, index) => String(index)));
          clearStep3(); clearStep4(); renderVCPlan(vcPlanA); showDna(result.dna); flow.accept(token, result.dna);
        } else {
          const useA = !!el('useA')?.checked, useB = !!el('useB')?.checked;
          if (!useA && !useB) throw new Error('请至少勾选方案A或方案B');
          const results = {};
          for (const plan of ['a', 'b']) {
            if (plan === 'a' && !useA || plan === 'b' && !useB) { results[plan] = null; continue; }
            const count = Math.max(1, Math.min(16, Number(value(plan === 'a' ? 'cntA' : 'cntB')) || 4));
            btn.textContent = `⏳ 生成方案${plan.toUpperCase()}…`;
            results[plan] = await core.requestText(options('scheme', token, settings, imagesSnapshot, { count, approach: plan === 'a' ? '参考知识库，形成不同视觉方向' : '不受知识库限制，形成不同视觉方向', sharedDna: results.a?.dna, knowledge: plan === 'a' ? core.knowledge(KB, settings) : [] }, core.schemeSchema(mode, count)));
          }
          flow.assert(token);
          const sanitizeVariants = (list) => (list || []).map((v, i) => {
            const rawI = (v.icon || '').trim();
            const isEmoji = rawI && rawI.length <= 4 && !/[a-zA-Z0-9\u4e00-\u9fa5]/.test(rawI);
            return { ...v, icon: isEmoji ? rawI : (['🎨', '✨', '🧴', '💡', '🏷️', '💎'][i % 6]) };
          });
          vcPlanA = sanitizeVariants(results.a?.variants); vcPlanB = sanitizeVariants(results.b?.variants); vcSelected.clear();
          clearStep3(); clearStep4();
          renderVCPlan('a', vcPlanA); renderVCPlan('b', vcPlanB); vcUpdateSelBar();
          const visualDna = (results.a || results.b).dna; showDna(visualDna); flow.accept(token, visualDna);
        }
        geminiWebConversationKey = mode + '_' + token.key + '_' + token.serial;
        try { if (typeof window !== 'undefined') window.geminiWebConversationKey = geminiWebConversationKey; } catch (_) {}
        scrollToBlock('step2'); ready = true;
      } finally { btn.disabled = false; btn.textContent = mode === 'taotu' ? '🎨 生成9图设计理念' : '✨ 生成设计方案'; }
    });
    if (ready && shouldAuto) {
      if (mode === 'taotu') okAll(); else if (mode !== 'fba') vcSelectAll();
      if (mode === 'fba') await genPromptsFromVC(); else await generatePrompts(true);
    }
  }
  function getSelectedFbaTasks() {
    return parsedTasks.filter(task => typeof vcTaskSelected === 'undefined' || vcTaskSelected.has(String(task.task_id))).map(task => ({ ...task, display_task_index: parsedTasks.indexOf(task) + 1 }));
  }
  async function generatePrompts(auto = false) {
    let ready = false;
    await exclusive(async () => {
      const token = { ...flow.requireScheme(), textModel: value('txtMdl'), apiKey: value('aKey').trim() };
      if (mode === 'taotu') saveConcepts();
      let selected;
      if (mode === 'taotu') {
        if (concepts.some(item => !item.ok)) throw new Error('请先确认全部方案');
        selected = concepts.map(item => ({ id: item.id, t: item.t, s: item.s, d: item.d, i: item.i, concept: item.concept }));
      } else {
        selected = [...vcSelected].map(key => {
          const [plan, index] = key.split('-'); const item = (plan === 'a' ? vcPlanA : vcPlanB)[Number(index)];
          return item && { t: item.name, s: item.type_label, d: item.concept, i: item.icon, concept: item.concept };
        }).filter(Boolean).map((item, index) => ({ id: index + 1, ...item }));
      }
      if (!selected.length) throw new Error('请先选择方案');
      const visualDna = dna(), settings = copy(CUR_PROMPTS), input = { dna: visualDna, confirmedSchemes: copy(selected), count: selected.length };
      const planSignature = currentPlanSignature();
      const btn = el('tpBtn'); btn.disabled = true;
      try {
        const promptItemSchema = {
          type: 'object',
          properties: {
            en: { type: 'string', minLength: 1, description: 'English image-generation prompt for the corresponding confirmed scheme. Visual requirements come from the editable rules for the current business mode.' },
            zh: { type: 'string', minLength: 1, description: '与英文内容对应的中文出图提示词；视觉要求以当前业务页面的可编辑规则为准。' }
          },
          required: ['en', 'zh'],
          additionalProperties: false
        };
        const result = await core.requestText(options('prompt', token, settings, originals(), input, core.array(promptItemSchema, selected.length)));
        flow.assert(token);
        if (planSignature !== currentPlanSignature()) throw new Error('方案内容或选择已变化，请重新生成提示词');
        if (core.fingerprint(dna()) !== core.fingerprint(visualDna)) throw new Error('视觉DNA已变化，请重新生成提示词');
        prompts = selected.map((item, index) => ({ ...item, enFull: result[index].en, zhFull: result[index].zh }));
        SLOTS = selected.map(({id,t,s,d,i})=>({id,t,s,d,i}));
        images = prompts.map(() => ({ status: 'pending', url: null, error: null }));
        promptDna = core.fingerprint(visualDna); promptPlanSignature = planSignature; flow.acceptPrompts(); renderPrompts(); ckApi(); scrollToBlock('step3'); ready = true;
      } finally { btn.disabled = false; btn.textContent = '⚡ 生成提示词'; }
    });
    if (ready && (auto || el('autoMode')?.checked)) await generateImages();
  }
  function fbaItemSignature(item) { return core.fingerprint([context(), item.prodImgs, item.prodImg, item.refImg, item.d, item.aspect_ratio, dna()]); }
  function markFbaManual(index, text) {
    const item = prompts[index]; if (!item) return;
    const changed = item.zhFull !== text;
    item.zhFull = text; item.prompt_status = text.trim() ? 'manual' : 'pending';
    item.__creativeSignature = fbaItemSignature(item);
    if (changed && images[index]?.status === 'done') images[index] = { status: 'pending', url: null, error: null };
    updatePromptReadyState();
  }
  function assertFbaPrepared() {
    flow.requireScheme();
    if (!fbaPreparedSignature || fbaPreparedSignature !== currentPlanSignature()) throw new Error('候选方案或选择已变化，请重新确认并配置第三步');
  }
  async function generateFbaPrompt(item, currentBatch = () => true, batchOptions = {}) {
    assertFbaPrepared();
    const signature = fbaItemSignature(item);
    const ctx = context(), settings = copy(CUR_PROMPTS);
    const products = normalizeProductImages(item.prodImgs, item.prodImg);
    if (!products.length) throw new Error('当前任务缺少产品资料图');
    const sources = products.map(dataUrl => ({ dataUrl, role: 'PRODUCT SOURCE' }));
    if (item.refImg) sources.push({ dataUrl: item.refImg, role: 'TARGET TEMPLATE REFERENCE' });
    const result = await core.requestText({ apiKey: batchOptions.apiKey || value('aKey').trim(), model: batchOptions.model || value('txtMdl'), mode, stage: 'prompt', settings, context: ctx, images: sources, input: { dna: dna(), task: item.task_name, confirmedScheme: item.d, aspectRatio: resolveAspectRatio(item.aspect_ratio, value('iAR')) }, schema: core.array(core.object(['zh']), 1), isCurrent: () => signature === fbaItemSignature(item) && currentBatch() && fbaPreparedSignature === currentPlanSignature() });
    item.__creativeSignature = signature;
    return result[0].zh;
  }
  async function generateFbaPrompts() {
    let ready = false;
    await exclusive(async () => {
      assertFbaPrepared(); syncPromptEdits();
      if (!value('aKey').trim()) throw new Error('请先填写 API Key');
      if (!prompts.length || prompts.some(item => !normalizeProductImages(item.prodImgs,item.prodImg).length)) throw new Error('请先为全部任务上传产品资料图');
      const batch = prompts, signature = core.fingerprint(batch.map(fbaItemSignature));
      const batchOptions = {apiKey:value('aKey').trim(),model:value('txtMdl')};
      const isCurrent = () => prompts === batch && signature === core.fingerprint(batch.map(fbaItemSignature));
      for (let index = 0; index < batch.length; index++) {
        if (!isCurrent()) throw new Error('任务资料已变化，后续提示词未提交，请重新生成');
        syncPromptEdits(); const item = batch[index], previousText = item.zhFull || '';
        item.prompt_status = 'loading'; item.prompt_error = ''; renderPrompts();
        try {
          const result = await generateFbaPrompt(item,isCurrent,batchOptions);
          syncPromptEdits();
          if (item.zhFull !== previousText) throw new Error('等待期间提示词已人工修改，保留人工内容；请重新确认后再出图');
          item.zhFull = result; item.prompt_status = 'ready';
        } catch (cause) {
          syncPromptEdits(); item.prompt_status = 'error'; item.prompt_error = cause.message;
          renderPrompts(); throw cause;
        }
        renderPrompts();
      }
      images = batch.map(() => ({status:'pending',url:null,error:null}));
      updatePromptReadyState(); ready = true;
    });
    if (ready && el('autoMode')?.checked) await generateImages();
  }
  function currentPlanSignature() {
    return core.fingerprint(mode === 'taotu' ? concepts.map((item,index) => [item.ok, el('ccE'+index)?.value ?? item.concept]) : mode === 'fba' ? [vcPlanA.map(item=>[item.task_id,item.variant_index,item.name,item.concept]),[...vcSelected]] : [vcPlanA,vcPlanB,[...vcSelected]]);
  }
  function assertImageReady() {
    if (mode === 'fba') {
      assertFbaPrepared();
      if (!prompts.length || prompts.some(item => !['ready','manual'].includes(item.prompt_status) || !item.zhFull?.trim() || item.__creativeSignature !== fbaItemSignature(item))) throw new Error('图片、方案或视觉DNA已变化，请先完成全部任务的提示词生成／更新');
      return;
    }
    flow.requirePrompts();
    if (promptPlanSignature !== currentPlanSignature()) throw new Error('方案内容或选择已变化，请重新生成提示词');
    if (promptDna !== core.fingerprint(dna())) throw new Error('视觉DNA已修改，请重新生成提示词');
  }
  let takeoverPromise = null;

  function refreshImageButton() {
    const button = el('gBtn');
    if (!button || !prompts.length) return;
    const remaining = prompts.filter((_, index) => images[index]?.status !== 'done').length;
    if (imageRun) {
      button.textContent = `⏳ 正在出图...（剩余${remaining}张 · 点击重新出图）`;
      button.disabled = false;
      return;
    }
    button.disabled = false;
    button.textContent = remaining > 0 && remaining < prompts.length
      ? `🖼️ 继续生成缺失图片（${remaining}张）`
      : remaining === 0 ? '🔄 使用当前模型重新生成全部图片' : '🖼️ 一键生成全部图片';
  }
  async function generateImages(singleIndex) {
    while (takeoverPromise) {
      await takeoverPromise.catch(() => undefined);
    }
    // A second click is an intentional takeover: stop the old web task, keep
    // its completed images, then continue with the currently selected channel.
    if (imageRun) {
      const oldRun = imageRun;
      oldRun.controller.abort();
      takeoverPromise = oldRun.promise.catch(() => undefined);
      await takeoverPromise;
      takeoverPromise = null;
    }
    const controller = new AbortController();
    const run = { controller, promise: null };
    const promise = exclusive(async () => {
      assertImageReady();
      const allDone = prompts.length > 0 && prompts.every((_, index) => images[index]?.status === 'done');
      const indices = Number.isInteger(singleIndex)
        ? [singleIndex]
        : prompts.map((_, index) => index).filter(index => allDone || images[index]?.status !== 'done');
      if (!indices.length) { refreshImageButton(); scrollToBlock('step4'); return; }
      const sourceKey = flow.key(), model = value('aMdl'), apiKey = value('aKey').trim();
      const requests = indices.map((index, i) => ({ index, prompt: getActivePrompt(index), task: Object.assign(copy(prompts[index]), { __restoreEditor: i === indices.length - 1, __signal: controller.signal }) }));
      scrollToBlock('step4');
      refreshImageButton();
      for (const request of requests) {
        if (controller.signal.aborted) { const stopped = new Error('旧的出图流程已停止，当前操作将按现有方案继续'); stopped.name = 'AbortError'; throw stopped; }
        if (sourceKey !== flow.key()) throw new Error('任务资料已变化，尚未发送的图片已暂停；已有结果保留');
        images[request.index] = { status: 'loading' }; renderIG(); refreshImageButton();
        try {
          const url = await generateImage(apiKey, model, request.prompt, request.task);
          if (sourceKey !== flow.key()) throw new Error('任务资料在出图时变化；返回图片未写入新任务，可在网页原会话查看');
          images[request.index] = { status: 'done', url };
        } catch (cause) {
          if (controller.signal.aborted || cause?.name === 'AbortError') {
            images[request.index] = { status: 'pending', url: null, error: null };
            renderIG(); refreshImageButton();
            throw cause;
          }
          console.error(`图${request.index + 1} 出图失败:`, cause);
          images[request.index] = { status: 'error', error: cause.message };
          if (/VERSION|\[PROVIDER\]|任务资料/.test(cause.message)) {
            renderIG();
            throw new Error(cause.message + '；后续图片未提交，修复后可重试。');
          }
        }
        renderIG(); refreshImageButton();
        if (requests.length > 1 && !controller.signal.aborted && typeof setTimeout !== 'undefined') {
          await new Promise(resolve => {
            const timer = setTimeout(resolve, 1500);
            controller.signal.addEventListener('abort', () => {
              clearTimeout(timer);
              resolve();
            }, { once: true });
          });
        }
      }
    });
    run.promise = promise;
    imageRun = run;
    refreshImageButton();
    try { return await promise; }
    finally { if (imageRun === run) imageRun = null; refreshImageButton(); }
  }
  async function generateImage(apiKey, model, prompt, task = {}) {
    const ctx = context(), settings = copy(CUR_PROMPTS);
    let sources, ratio;
    if (task.__sources) { sources = task.__sources; ratio = task.__ratio; }
    else if (mode === 'fba') {
      sources = normalizeProductImages(task.prodImgs, task.prodImg).map(dataUrl => ({ dataUrl, role: 'PRODUCT SOURCE' }));
      if (task.refImg) sources.push({ dataUrl: task.refImg, role: 'TARGET TEMPLATE REFERENCE' });
      ratio = normalizeImageAspectRatio(resolveAspectRatio(task.aspect_ratio, value('iAR') || 'task'));
    } else { sources = originals(); ratio = value('iAR') || 'auto'; }
    if (!sources.length || (!task.__edit && !sources.some(item => item.role === 'PRODUCT SOURCE'))) throw new Error('缺少产品原图，未发起作图');
    const parts = await core.imageParts(sources);
    const refNote = sources.some(item => item.role.includes('REFERENCE')) ? settings.referenceRules : '';
    const prodApp = ctx.productLock ? `Product appearance constraint: ${ctx.productLock}.` : '';
    const body = task.__edit ? settings.editRules : settings.imggen.replaceAll('{refNote}', refNote).replaceAll('{prodAppearance}', prodApp).replaceAll('{arNote}', '');
    const ratioText = ratio === 'auto' ? '保持第一张产品原图的画幅比例与方向。' : '最终输出画幅：' + ratio + '。';
    const roles = sources.map((item,index) => `IMAGE ${index+1}: ${item.role}`).join('\n');
    const instruction = ratioText + '\n\n' + roles + '\n\n' + body + '\n\n## 本次任务\n' + prompt;
    const trace = core.record({ stage: 'image', model, provider: model === 'chatgpt-web' ? 'chatgpt' : model === 'gemini-web' ? 'gemini' : 'api', context: ctx, prompt: instruction, images: sources.map((item, index) => ({ index: index + 1, role: item.role })), parameters: { aspectRatio: ratio } });
    try {
      if (model === 'chatgpt-web' || model === 'gemini-web') {
        const bridge = model === 'chatgpt-web' ? window.IantoChatGPTWeb : window.IantoGeminiWeb;
        if (!bridge) throw new Error('对应网页作图桥接未加载');
        const webImages = parts.filter(p => p.inlineData).map((part, index) => ({ dataUrl: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`, role: sources[index].role === 'PRODUCT SOURCE' ? 'product' : 'reference', name: `${String(index + 1).padStart(2, '0')}-${sources[index].role === 'PRODUCT SOURCE' ? 'product' : 'reference'}` }));
        const webOptions = { prompt: instruction, images: webImages, aspectRatio: ratio, conversationKey: geminiWebConversationKey + '_' + core.fingerprint(ctx), taskLabel: mode, restoreEditor: !!task.__restoreEditor, signal: task.__signal };
        let lastError;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const result = await bridge.generate(webOptions);
            trace.status = 'success'; return result;
          } catch (error) {
            lastError = error;
            if (error?.name === 'AbortError' || /VERSION|\[PROVIDER\]/.test(error?.message || '')) throw error;
            const recoverable = /PROVIDER_TAB_CLOSED|PROVIDER_BUSY|ACTIVATE_|无法连接|未接受|message port|Receiving end|找不到.*(?:Gemini|ChatGPT)|标签页/i.test(error?.message || '');
            if (!recoverable || attempt === 3) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        }
        throw lastError;
      }
      if (isOpenAiImageModel(model)) {
        const imageData = parts.filter(p => p.inlineData).map(p => p.inlineData);
        // Existing multipart adapter expects PNG; preserve its proven conversion path.
        const converted = await Promise.all(imageData.map(data => cleanImageData(`data:${data.mimeType};base64,${data.data}`)));
        const referenceIndex = sources.findIndex(item => item.role.includes('REFERENCE'));
        const result = await callOpenAiImageApi(model, instruction, ratio, referenceIndex < 0 ? converted : converted.filter((_,index)=>index!==referenceIndex), referenceIndex < 0 ? null : converted[referenceIndex], task.__signal);
        trace.status = 'success'; return result;
      }
      if (model.startsWith('imagen')) throw new Error('此模型不支持产品参考图；为避免改错商品，请使用支持图片输入的出图模型');
      parts.push({ text: instruction });
      const config = { responseModalities: ['TEXT', 'IMAGE'], ...(ratio !== 'auto' ? { imageConfig: { aspectRatio: ratio } } : {}) };
      trace.parameters = config;
      const timeoutSignal = AbortSignal.timeout(90000);
      let requestSignal = timeoutSignal;
      if (task.__signal) {
        requestSignal = typeof AbortSignal.any === 'function'
          ? AbortSignal.any([task.__signal, timeoutSignal])
          : task.__signal;
      }
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, { method: 'POST', signal: requestSignal, headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }, body: JSON.stringify({ contents: [{ parts }], generationConfig: config }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'API ' + response.status);
      const result = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData;
      if (!result) throw new Error('模型未返回图片：' + (data.candidates?.[0]?.finishReason || data.promptFeedback?.blockReason || '请查看本次请求'));
      trace.status = 'success'; return `data:${result.mimeType};base64,${result.data}`;
    } catch (cause) { trace.status = 'error'; trace.error = cause.message; throw cause; }
  }
  async function runEdit() {
    return exclusive(async () => {
      const prompt = value('mPmt').trim(); if (!prompt) throw new Error('请输入编辑指令');
      const btn = el('mEBtn'), target = el('mRes'), index = editIdx;
      const products = mode === 'fba' ? [...miniProdImgs] : miniProdImg ? [miniProdImg] : [];
      const currentImage = el('mImg').src; if (!currentImage) throw new Error('缺少当前图片');
      const sources = products.map(dataUrl=>({dataUrl,role:'PRODUCT SOURCE'}));
      sources.push({dataUrl:currentImage,role:'CURRENT IMAGE TO EDIT'});
      if (miniRefImg) sources.push({dataUrl:miniRefImg,role:'STYLE/SCENE REFERENCE'});
      const ratio = mode === 'fba' ? normalizeMiniAspectRatio(value('mAspectRatio') || miniAspectRatio) : value('iAR') || 'auto';
      btn.disabled=true; target.textContent='正在编辑…';
      try {
        const url = await generateImage(value('aKey').trim(),value('aMdl'),prompt,{__edit:true,__sources:sources,__ratio:ratio});
        if (index !== editIdx || currentImage !== el('mImg').src) throw new Error('编辑对象已切换，结果没有应用到另一张图');
        editResult=url;
        const image = document.createElement('img');image.src=url;image.style.cssText='max-width:100%;max-height:100%;object-fit:contain';target.replaceChildren(image);
        for(const id of ['mABtn','mUseBtn','mDlResBtn'])el(id)?.classList.remove('hid');
      } catch(cause) { target.textContent='编辑失败：'+cause.message; }
      finally { btn.disabled=false;btn.textContent='✨ AI编辑'; }
    });
  }
  window.PhotoCreativePage = Object.freeze({ genConcepts: generateSchemes, genPrompts: generatePrompts, startGen: () => generateImages(), stopGen: async () => { if (imageRun) { imageRun.controller.abort(); await imageRun.promise.catch(() => undefined); } }, retry: index => generateImages(index), callGemini: generateImage, runEdit, generatePromptForItem: generateFbaPrompt, generatePromptsWithMedia: generateFbaPrompts, markFbaManual, bindFbaPreparation: () => { fbaPreparedSignature = currentPlanSignature(); }, requireScheme: () => { if (busy) throw new Error('当前任务仍在运行，请等待结束后再确认方案'); return flow.requireScheme(); }, context, flow });
})();
