(function () {
  'use strict';
  const REVISION = '2026-09-08.4';
  const clone = value => JSON.parse(JSON.stringify(value));
  const object = properties => ({ type: 'object', properties: Object.fromEntries(properties.map(key => [key, { type: 'string', minLength: 1 }])), required: properties, additionalProperties: false });
  const array = (items, count) => ({ type: 'array', items, ...(count == null ? {} : { minItems: count, maxItems: count }) });
  const marketProfiles = {
    MX: 'Mexican e-commerce: bold vibrant colors, expressive typography, aspirational but approachable, prominent pricing and trust badges',
    BR: 'Brazilian e-commerce: tropical warm colors, diverse models, sensual yet natural beauty, bold discounts, social proof, fun energetic vibe',
    ID: 'Indonesian e-commerce: clean pastel backgrounds, hijab-friendly options, Shopee/Tokopedia style, flash sale banners, halal certification, soft feminine colors',
    PH: 'Philippine e-commerce: bright cheerful colors, approachable everyday beauty, warm and energetic vibe, diverse and real-looking models, clean layouts with vibrant accents, clear product focus',
    VN: 'Vietnamese e-commerce: clean soft pink/white, K-beauty influenced, before/after popular, VND pricing with strikethrough, youthful cute style',
    TH: 'Thai e-commerce: bright colorful playful, gold/white premium for beauty, celebrity endorsement style, cute kawaii elements, strong promo emphasis',
    MY: 'Malaysian e-commerce: multicultural inclusive, halal-conscious, clean modern, bilingual Malay/English, modest fashion awareness, soft neutral palettes',
    SG: 'Singaporean e-commerce: premium minimalist clean, high-end positioning, sophisticated typography, quality-over-price, clinical/scientific beauty trend',
    US: 'Amazon US FBA e-commerce aesthetic: professional, trustworthy and conversion-focused; premium lifestyle context; crisp high-contrast lighting; clean hierarchy and readable English-US copy; authentic diverse American models when needed; A+ content quality; product accuracy first; no visual language from non-US marketplaces'
  };
  const platforms = {
    neutral: { name: '不指定平台', direction: 'Follow the image purpose and brand brief; clean, high-converting commercial e-commerce photography.' },
    amazon: { name: 'Amazon', direction: 'Clear product identity, premium A+ lifestyle photography, crisp studio lighting, clear benefit hierarchy.' },
    tiktok: { name: 'TikTok Shop', direction: 'Mobile-first, dynamic visual hook, energetic and authentic lifestyle context, clear product highlight.' },
    mercadolibre: { name: 'Mercado Libre / Livre', direction: 'Bold, clean, high-contrast e-commerce photography with strong thumbnail impact and trustworthy presentation.' },
    shopee: { name: 'Shopee', direction: 'Vibrant, high-saturation commercial style with clear mobile readability, prominent focal point, and energetic promotional appeal.' },
    lazada: { name: 'Lazada', direction: 'Clean, modern, premium e-commerce composition with elegant product focus and high aesthetic appeal.' },
    dtc: { name: '独立站 / DTC', direction: 'Brand-led editorial product storytelling, sophisticated art direction, generous intentional spacing and material texture.' },
  };
  const modes = {
    taotu: `你是电商视觉总监/AI作图专家，拥有百万级爆款操盘经验。根据产品信息和目标市场，为电商黄金9图生成高质量设计理念。

你必须输出一个JSON对象，严格遵循结构：
{"styles":["风格1","风格2","风格3","风格4","风格5"],"slots":[9个图片类型],"concepts":[9个设计理念]}

styles字段：推荐5个最适合该产品+目标市场的视觉风格方向，中文，第一个最推荐。

slots数组（恰好9个）：根据产品推荐最合适的9张图类型，格式：
{"t":"中文名称","s":"English name","d":"一句话说明","i":"emoji图标"}
主图/封面图必须是第一张，其余根据产品特性选择最有转化力的组合。

concepts数组（恰好9个），每个对应slots中的一张图，格式：
{"concept":"中文理念（必须详尽，见要求）"}

【concept字段 - 中文理念，必须包含以下所有维度，总字数不少于150字】：
• 【转化目标】这张图要打动谁？解决什么购买疑虑或激发什么购买欲望？
• 【核心场景】具体场景描述：在哪里？什么时间？什么人物/氛围？
• 【光影情绪】光线方向、色温、整体情绪基调（如：晨光侧逆光/暖黄氛围/高级感）
• 【视觉构图】构图方式（如：三分法/对角线/居中对称）、主体占比、前后景关系
• 【色彩方案】主色+辅色+点缀色，色调风格（如：莫兰迪/高饱和/低纯度奶油色）
• 【文案位置】标题/卖点/角标的位置、字体风格、文案内容方向
• 【设计风格】具体风格参考（如：ins风极简/K-beauty/Shopee爆款风）
结尾标注应用概念。

图片风格、色彩、排版、文案调性必须严格符合目标市场审美。
产品外观约束（仅防止AI画错产品）：用"颜色+product"指代产品，不要描述产品细节形状。
只输出JSON对象，不加markdown代码块。`,
    zhutu: '策划可独立比较的主图创意方向。强调缩略图中产品可识别、清晰的重点和平台版位约束。主体占比、文字和背景依据产品与版位决定，突出商业卖点与吸睛构图。',
    changjing: '策划产品真实生活使用场景。国家生活语境、使用动作、空间尺度和摄影真实性优先；产品必须自然融入空间并产生真实的接触阴影与光线反射，拒绝悬浮贴图。',
    fba: `你是美国 Amazon FBA 电商视觉总监和 AI 生图方案工程师。你的任务不是复述运营人员写的需求，而是把每条人类语言需求翻译成可供生图模型继续执行的中文设计方案。

设计方案必须使用清晰、具体、无歧义的机器可执行语言，并包含：主体与产品保真、场景与道具、构图与机位、主体占比与空间关系、光线与色温、色彩与材质、人物动作（如需要）、文案内容与位置（如需要）、画幅比例、禁止项。只使用美国 Amazon FBA 审美：专业、可信、清晰、高转化、premium lifestyle、A+ 内容风格。

严禁直接复制、拼接或只做同义词替换原始需求；严禁输出其他国家或地区电商平台风格。只输出调用方指定的严格 JSON。`,
  };
  const productRules = '产品资料图是商品身份与外观的唯一事实来源。综合全部产品图直接核对真实颜色、形状、比例、材质、标签、品牌、包装、配件、数量与变体关系；不要先把商品压缩成颜色名称或文字描述，也不要用生成的描述替代图片事实。仅使用用户提供或图片明确可见的信息，不猜尺寸、成分、认证、功效或价格。除非用户在当前任务明确要求修改，否则不得改变、重设计、增删或混合产品特征。';
  const referenceRules = '产品图提供商品身份。风格/场景参考图只提供用户指定的构图、背景、光线或风格，不引入其中的旧商品、品牌、标签、数字或卖点。多张产品图可能是不同角度或变体，只展示当前任务选定的数量与变体；不要求全部同时出现。';
  const dnaRules = '整套图保持统一的视觉DNA与品牌质感。配色契合产品本身与目标市场，场景与摄影光线真实自然，每个槽位承担独立的转化与展示任务。';
  const modePromptRules = {
    taotu: `你是电商套图提示词工程师。用户已确认整套图片的视觉DNA和每张图的唯一任务。请按输入顺序为每个任务生成一条可直接用于生图模型的提示词。

输出严格JSON数组，数量与确认方案完全一致；每项格式为{"en":"English prompt","zh":"中文提示词"}。en只使用英文，zh只使用中文（品牌名除外），图片内文案使用{lang}。

整套图共享视觉DNA，但每张图必须完成自己的信息任务，不重复同一构图。依据该任务决定是否需要人物、场景、道具、文案、特写或信息图；不要为了凑字段强行加入不需要的元素。凡有真实空间或人物接触，必须给出合理尺度、透视、接触关系与同方向光影；纯主图或图形化卖点图则保持清晰干净。产品资料图是商品身份唯一来源，不要用“颜色+product”替代商品事实，不虚构规格、认证、功效、价格或包装文字。国家、语言、人物、生活场景、排版和促销强度服从本次任务上下文与目标平台。只输出JSON。`,
    zhutu: `你是电商主图与商品首屏创意提示词工程师。用户已确认多个可独立比较的主图方向。请按输入顺序生成可直接用于生图模型的提示词。

输出严格JSON数组，数量与确认方案完全一致；每项格式为{"en":"English prompt","zh":"中文提示词"}。en只使用英文，zh只使用中文（品牌名除外），图片内文案使用{lang}。

主图首先保证缩略图中商品身份清晰、层级明确、符合目标平台版位。主体占比由具体方向决定：纯商品英雄图通常约60–75%；包装组合、使用情境、质地或功能证据图可降低到35–60%，不得机械地让每张图都占65%。背景、人物、道具、文案和促销角标只在方案需要时加入，不能遮挡商品或虚构信息。产品资料图是商品身份唯一来源，不要用“颜色+product”替代商品事实。不同方向应测试构图、信息重点或消费动机，而不是只换颜色。只输出JSON。`,
    changjing: `你是写实电商场景图提示词工程师。用户已确认多个生活方式或使用场景方向。请按输入顺序生成可直接用于生图模型的提示词。

输出严格JSON数组，数量与确认方案完全一致；每项格式为{"en":"English prompt","zh":"中文提示词"}。en只使用英文，zh只使用中文（品牌名除外），图片内文案使用{lang}。

优先建立目标国家真实可信的生活空间、人物行为、使用动作和消费语境。产品大小、透视、摆放与手部接触必须符合现实；接触阴影、环境光和反射只在场景实际需要时描述，并与主光方向一致，避免悬浮贴图和过度CG感。主体占比按场景任务灵活确定，既能识别商品又保留必要环境信息；不要套用主图固定占比。产品资料图是商品身份唯一来源，不要用“颜色+product”替代商品事实，不虚构规格、功效、认证、价格或包装文字。只输出JSON。`
  };
  const defaultRegistry = new Map();

  function upgradeDefaults(mode, defaults) {
    const old = clone(defaults);
    const gitAesthetic = JSON.stringify(mode === 'fba' ? { US: marketProfiles.US } : marketProfiles, null, 2);
    Object.assign(defaults, {
      recognize: productRules,
      ...(mode === 'fba' ? { extract: defaults.extract || '从输入 csvText 抽取明确的作图任务，保留原任务名称、组名、要求与宽高比，不增加任务，不把商品资料行当成作图要求。没有组名或比例时返回空字符串，不猜产品事实。' } : {}),
      concept: defaults.concept || modes[mode],
      ...(mode === 'zhutu' || mode === 'changjing' ? { strategy: defaults.strategy || defaults.concept || modes[mode] } : {}),
      prompt: modePromptRules[mode] || defaults.prompt || (mode === 'fba' ? `你是美国 Amazon FBA 电商 AI 生图提示词工程师。用户已经确认并可能编辑了中文设计方案。请把每个方案进一步展开为一条可直接用于生图模型的中文提示词。

输出严格 JSON 数组，每个对象只有一个字段：{"zh":"中文提示词"}。对象数量必须与输入方案数量完全一致。

每条中文提示词必须具体、可执行，并完整包含：画面主体、产品保真要求、场景与道具、构图与机位、主体占比、光影与色温、色彩方案、材质质感、人物动作（如需要）、文案内容和位置（如需要）、目标画幅、清晰度与禁止项。
画幅必须使用对应任务给出的比例；当输入标明“强制比例”时，必须忽略方案中的原比例并使用强制比例。
视觉、色彩、排版和文案调性只允许美国 Amazon FBA 审美。PRODUCT TRUTH SOURCE 产品资料图是唯一产品身份来源；TARGET TEMPLATE REFERENCE 仅提供结构与视觉模板，其中旧产品、包装、Logo、品牌和文字必须全部替换。
提示词使用中文；图片内文案仍按输入的 English-US 要求写成英文。不要输出英文提示词字段，不要输出 markdown。` : (mode === 'zhutu' ? `你是顶级电商主图AI作图专家，精通Shopee/Lazada/TikTok主图规范和爆款视觉逻辑。用户已确认各主图变体方向，现在需要根据每个变体方向，生成可直接用于AI出图的高质量提示词。

【主图提示词铁律 - 每条提示词必须遵守】
1. 产品占画面60-75%，作为绝对视觉主体，必须明确说明产品位置（居中/稍偏）
2. 背景服务于产品（渐变/纹理/轻场景均可），不得喧宾夺主
3. 文案/角标/badge放在安全区（产品上方或下方留白），不遮挡产品
4. 200×200缩略图下产品依然清晰可识别，信息层次一目了然
5. 说明促销标签/卖点角标的位置和样式（如有）

输出JSON数组(N个对象)：{"en":"English prompt","zh":"中文提示词"}

语言规则：en纯英文禁止中文字符，zh纯中文（品牌名除外），图片文案/slogan在en和zh中都用{lang}
产品外观约束：用"颜色+product"指代产品，产品图会作为reference传入，不要描述产品形状细节
风格/色彩/排版/文案调性必须符合目标市场审美和目标平台规范

每条提示词必须包含以下所有元素：
· 产品主体（占比约65%、位置、视角，如：centered large product, front view, filling 65% of frame）
· 背景类型（如：gradient pastel background / light texture / minimalist solid color）
· 文案区域（如：top 20% headline area / bottom badge strip，用{lang}表示文案内容）
· 色调方案（主色+辅色，如：warm coral main, white typography, gold accent）
· 促销元素（如有，说明位置+样式，如：top-right corner flash sale badge in orange）
· 平台视觉风格（符合平台审美，如：Shopee-style high saturation / Lazada clean minimalist）
· 光影质感（如：soft studio lighting, subtle shadow, clean product highlight）

只输出JSON数组，不加markdown代码块。` : `你是一名引领行业潮流、拥有百万级爆款经验的电商美妆类目视觉总监/AI作图专家。用户已确认9张电商图的设计理念，你现在需要根据每张确认的理念，高质量创作可直接使用的AI作图提示词。

输出JSON数组(9个对象)：{"en":"English prompt","zh":"中文提示词"}

语言规则：en纯英文禁止中文字符，zh纯中文（品牌名除外），图片文案/slogan在en和zh中都用{lang}。
产品外观约束：用"颜色+product"指代产品，产品图会作为reference传入，不要描述产品细节。
风格/色彩/排版/文案调性必须符合目标市场审美。
每个提示词必须包含：画面内容、设计风格、光影氛围、产品/模特姿态、色彩方案、构图方式、材质质感、分辨率/画幅。
图片文案只用{lang}，明确内容和位置。具体可执行，不笼统。
只输出JSON。`)),
      imggen: defaults.imggen || (mode === 'fba' ? `# Image Reference Instructions
- All images marked PRODUCT TRUTH SOURCE are complementary product originals and the only source of product identity. Read them together to understand the product's exact shape, color, label, packaging, texture, angles, quantities, styles, and dimensions.
- The TARGET TEMPLATE REFERENCE controls only layout, structure, camera, lighting, and visual hierarchy. Remove and replace every product, package, logo, brand, label, number, and claim visible in it.
- You MUST preserve the selected user product's exact appearance. Do not alter, redesign, or reimagine, or mix it with the template product.
- {refNote}
- {prodAppearance}
- {arNote}
- Generate the final image based on the prompt below, keeping the product faithful to all relevant product originals while matching the target reference's finished look.` : `# Image Reference Instructions
- The first image is the product photo (white/transparent background). You MUST preserve this product's exact appearance (shape, color, label, packaging, texture) in the generated image. Do not alter, redesign, or reimagine the product.
- {refNote}
- {prodAppearance}
- Generate the final image based on the prompt below, keeping the product faithful to the original photo.`),
      aesthetic: defaults.aesthetic || gitAesthetic,
      referenceRules, dnaRules,
      editRules: 'CURRENT IMAGE TO EDIT 是本次修改对象，PRODUCT SOURCE 只用于核对商品身份，REFERENCE 只用于用户指定的参考方向。执行用户修改指令，保留未要求修改的元素；如果用户要求改变某个商品属性，该项以用户指令为准。不主动加入国家、平台、文案或卖点。',
      editTemplates: JSON.stringify({ combine:'参考 REFERENCE 的风格和光影，调整 CURRENT IMAGE TO EDIT；保留商品身份。',replace_person:'把 CURRENT IMAGE TO EDIT 中的人物替换为 REFERENCE 中的人物，保持商品不变，协调动作和光线。',add_logo:'将 REFERENCE 的标志加入 CURRENT IMAGE TO EDIT，保持标志比例和边缘。',replace_background:'依据 REFERENCE 更换 CURRENT IMAGE TO EDIT 的背景，保留产品原貌。',replace_product:'将 CURRENT IMAGE TO EDIT 中的旧商品替换成 PRODUCT SOURCE 的商品，保持场景透视与光影。' },null,2),
      contextRules: '本次taskContext是当前任务选择的唯一依据：使用其中的国家、语言、模特要求、品牌和版位。用户资料与知识库只作素材，不沿用旧市场或旧平台。不要拼接其他任务。模型无法从照片保证识别国籍，应通过符合本市场的环境、服饰与使用情境表达，不按国籍强行固定面孔。',
      platforms: JSON.stringify(platforms, null, 2),
      categoryRules: JSON.stringify({ general: '依据实际产品选择摄影和证据，不推断不存在的功能。', beauty: '准确表达包装、质地和有依据的使用方式；不虚构功效、成分、前后对比。', home: '真实尺度、材质、承重和使用关系；不虚构容量或配件。', fitness: '合理人体动作、结构和受力；不虚构减重或健康效果。', electronics: '准确接口、按键、线材和组件，不生成不存在的功能。' }, null, 2),
      runtimeOptions: JSON.stringify({ schemeTemperature: 0.7, promptTemperature: 0.5, knowledgeLimit: 30, knowledgeTerms: [] }, null, 2),
    });
    defaultRegistry.set(mode, clone(defaults));
    window.AiPhotoPromptSettings?.registerDefaults(mode, defaults, old, REVISION);
  }

  function parseMap(value, label) {
    const parsed = JSON.parse(value || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(label + '必须是JSON对象');
    return parsed;
  }
  function profile(value) { return typeof value === 'string' ? value : JSON.stringify(value || {}, null, 2); }
  function escapeHtml(value) { return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
  function hash(text) { let h = 2166136261; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619); return (h >>> 0).toString(36); }
  function fingerprint(value) { return hash(JSON.stringify(value)); }
  function format(template, context) {
    return String(template || '').replace(/\{(lang|market|model|count)\}/g, (_, key) => String(context[key] ?? ''));
  }
  function validate(value, schema, path = 'result') {
    if (schema.type === 'object') {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(path + '不是对象');
      for (const key of schema.required || []) if (!(key in value)) throw new Error(path + '缺少' + key);
      for (const [key, entry] of Object.entries(value)) {
        if (schema.properties?.[key]) validate(entry, schema.properties[key], path + '.' + key);
        else if (schema.additionalProperties === false) throw new Error(path + '包含未定义字段' + key);
      }
    } else if (schema.type === 'array') {
      if (!Array.isArray(value)) throw new Error(path + '不是数组');
      if (schema.minItems != null && value.length < schema.minItems || schema.maxItems != null && value.length > schema.maxItems) throw new Error(path + '数量不符：' + value.length);
      value.forEach((item, i) => validate(item, schema.items, path + '[' + i + ']'));
    } else if (schema.type === 'string' && (typeof value !== 'string' || schema.minLength > 0 && value.length < schema.minLength)) throw new Error(path + '文字格式不符');
    else if (schema.type === 'integer' && !Number.isInteger(value)) throw new Error(path + '必须是整数');
    return value;
  }

  const traces = [];
  function record(entry) {
    const safe = { time: new Date().toISOString(), revision: REVISION, ...entry };
    traces.unshift(safe); if (traces.length > 24) traces.length = 24;
    window.dispatchEvent?.(new CustomEvent('photo-request-trace', { detail: safe }));
    return safe;
  }
  function showTrace() {
    const dialog = document.createElement('dialog');
    dialog.style.cssText = 'width:min(1000px,95vw);max-height:90vh;border:1px solid #cbd5e1;border-radius:16px;padding:20px;background:white;color:#0f172a';
    const close = document.createElement('button'); close.textContent = '关闭'; close.onclick = () => { dialog.close(); dialog.remove(); };
    const title = document.createElement('h3'); title.textContent = '本次实际请求 · 不含 API Key · 最近24次（仅保留本页内存）';
    dialog.append(close, title);
    if (!traces.length) { const p = document.createElement('p'); p.textContent = '尚未发起请求。方案、提示词与出图请求发出前会记录完整正文、图片角色及模型参数。'; dialog.append(p); }
    for (const entry of traces) {
      const details = document.createElement('details'); details.open = entry === traces[0];
      const summary = document.createElement('summary'); summary.textContent = `${entry.time} · ${entry.stage} · ${entry.provider || entry.model || ''} · ${entry.status || 'prepared'}`;
      const pre = document.createElement('pre'); pre.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.7 monospace'; pre.textContent = JSON.stringify(entry, null, 2);
      details.append(summary, pre); dialog.append(details);
    }
    document.body.append(dialog); dialog.showModal();
  }

  async function imageParts(images) {
    const parts = [];
    for (const [index, image] of images.entries()) {
      let data = image.dataUrl;
      if (!data) continue;
      if (/^https?:/.test(data)) {
        const response = await fetch('/api/proxy-image?url=' + encodeURIComponent(data));
        if (!response.ok) throw new Error('参考图读取失败：HTTP ' + response.status);
        const blob = await response.blob();
        data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });
      }
      const match = /^data:(image\/[^;,]+);base64,([\s\S]+)$/.exec(data);
      if (!match) throw new Error('第' + (index + 1) + '张图片格式无效');
      parts.push({ text: `IMAGE ${index + 1}: ${image.role || 'product'}` }, { inlineData: { mimeType: match[1], data: match[2] } });
    }
    return parts;
  }
  function summarizeParts(parts) {
    return parts.map(part => part.text ? { text: part.text } : { image: { mimeType: (part.inlineData || part.inline_data)?.mimeType || (part.inlineData || part.inline_data)?.mime_type, base64Characters: (part.inlineData || part.inline_data)?.data?.length || 0 } });
  }
  function knowledge(kb, settings) {
    const options = parseMap(settings.runtimeOptions, '运行参数');
    const limit = Math.max(0, Math.min(120, Number(options.knowledgeLimit) || 0));
    if (!limit) return [];
    const terms = Array.isArray(options.knowledgeTerms) ? options.knowledgeTerms.map(term => String(term).toLowerCase()) : [];
    const categories = Object.keys(kb || {});
    return categories.flatMap(category => (kb?.[category] || []).filter(item => !terms.length || terms.some(term => String(item.e + ' ' + item.z).toLowerCase().includes(term))).slice(0, Math.ceil(limit / categories.length)).map(item => ({ category, ...item }))).slice(0, limit);
  }
  function systemText(mode, stage, settings, context) {
    const strategy = stage === 'extract' ? settings.extract : stage === 'scheme' ? (settings.strategy || settings.concept) : settings.prompt;
    const markets = parseMap(settings.aesthetic, '市场档案');
    const channels = parseMap(settings.platforms, '平台档案');
    const categories = parseMap(settings.categoryRules, '品类档案');
    return [
      ['可编辑业务规则', format(strategy, context)],
      ['可编辑任务上下文规则', settings.contextRules],
      ['可编辑产品保真规则', settings.recognize],
      ['可编辑图片角色规则', settings.referenceRules],
      ['可编辑整套视觉规则', settings.dnaRules],
      ['目标国家档案：' + context.marketCode, profile(markets[context.marketCode])],
      ['目标平台档案：' + context.platform, profile(channels[context.platform])],
      ['品类档案：' + context.category, profile(categories[context.category])],
    ].filter(([, value]) => value).map(([name, value]) => `## ${name}\n${value}`).join('\n\n');
  }
  const dnaSchema = object(['palette', 'materials', 'lighting', 'typography', 'copyVoice', 'variation']);
  const taotuSlotSchema = {
    type: 'object',
    properties: {
      i: { type: 'string', minLength: 1, maxLength: 8, description: '单个emoji图标，如 🧴、✨、📦、🌿、💧、🌸、🔍、🎯、👑。严禁输出任何英文字句或产品描述' },
      t: { type: 'string', minLength: 2, maxLength: 30, description: '简短中文图片类型名称（4-8字），如“主图/首图”、“核心质地特写”' },
      s: { type: 'string', minLength: 2, maxLength: 40, description: '简短英文名称（2-4词），如“Hero Product Shot”、“Texture & Formulation”' },
      d: { type: 'string', minLength: 5, maxLength: 100, description: '一句话核心任务说明（10-25字）' }
    },
    required: ['i', 't', 's', 'd'],
    additionalProperties: false
  };
  const taotuConceptSchema = {
    type: 'object',
    properties: {
      concept: { type: 'string', minLength: 1, description: '与对应图片槽位匹配的中文设计理念；具体视觉要求以当前页面可编辑业务规则为准' }
    },
    required: ['concept'],
    additionalProperties: false
  };
  const variantSchema = {
    type: 'object',
    properties: {
      icon: { type: 'string', minLength: 1, description: '单个emoji图标，如 🎨、✨、🧴，严禁输出英文句子' },
      name: { type: 'string', minLength: 1, description: '创意方案简短中文名' },
      type_label: { type: 'string', minLength: 1, description: '英文类型标签，如 Hero Centered / Lifestyle In-situ' },
      concept: { type: 'string', minLength: 1, description: '与当前业务模式匹配的方案设计思路；具体视觉要求以当前页面可编辑业务规则为准' }
    },
    required: ['icon', 'name', 'type_label', 'concept'],
    additionalProperties: false
  };
  function schemeSchema(mode, count) {
    const result = { type: 'object', properties: { dna: dnaSchema }, required: ['dna'], additionalProperties: false };
    if (mode === 'taotu') {
      Object.assign(result.properties, { styles: array({ type: 'string' }, 5), slots: array(taotuSlotSchema, 9), concepts: array(taotuConceptSchema, 9) });
      result.required.push('styles', 'slots', 'concepts');
    } else {
      result.properties.variants = array(variantSchema, count); result.required.push('variants');
    }
    return result;
  }
  async function requestText({ apiKey, model, mode, stage, settings, context, images = [], input, schema, isCurrent = () => true }) {
    const parts = await imageParts(images);
    parts.push({ text: JSON.stringify({ taskContext: context, input }, null, 2) });
    const options = parseMap(settings.runtimeOptions, '运行参数');
    const temperature = Number(stage === 'scheme' ? options.schemeTemperature : options.promptTemperature);
    const generationConfig = { responseMimeType: 'application/json', responseJsonSchema: schema, maxOutputTokens: 16384, temperature: Number.isFinite(temperature) ? Math.min(1, Math.max(0, temperature)) : 0.6 };
    const system = systemText(mode, stage, settings, context);
    const body = { contents: [{ parts }], systemInstruction: { parts: [{ text: system }] }, generationConfig };
    const trace = record({ stage, model, context, system, contents: summarizeParts(parts), parameters: generationConfig });
    try {
      if (!isCurrent()) throw new Error('任务资料已变化，本次请求未发送，请按新资料重新生成');
      const data = await window.GeminiTextApi.generateContent(apiKey, model, body);
      trace.effectiveModel = data._effectiveModel || model;
      if (!isCurrent()) throw new Error('任务资料已变化，旧请求的返回结果已忽略');
      const candidate = data.candidates?.[0];
      if (candidate?.finishReason && candidate.finishReason !== 'STOP') throw new Error('模型未完整返回：' + candidate.finishReason);
      const text = (candidate?.content?.parts || []).map(p => p.text || '').join('');
      const result = validate(JSON.parse(text), schema);
      trace.status = 'success'; return result;
    } catch (error) { trace.status = 'error'; trace.error = error.message; throw error; }
  }

  function createFlow(read) {
    let serial = 0, accepted = null, promptKey = null, run = null;
    const key = () => fingerprint(read());
    function begin() { run = { serial: ++serial, key: key(), context: clone(read()) }; accepted = null; promptKey = null; return run; }
    function current(token) { return token?.serial === serial && token.key === key(); }
    function assert(token) { if (!current(token)) throw new Error('产品/国家/方案配置已变化，旧任务已过期，请重新生成方案'); }
    function accept(token, dna) { assert(token); accepted = { ...token, dna: clone(dna || {}) }; update(); }
    function requireScheme() { if (!accepted || accepted.key !== key()) throw new Error('当前产品或国家与方案不一致，请先重新生成方案（旧内容仍保留）'); return accepted; }
    function acceptPrompts() { promptKey = requireScheme().key; update(); }
    function requirePrompts() { const value = requireScheme(); if (promptKey !== value.key) throw new Error('方案或任务资料已更新，请重新生成提示词后出图'); return value; }
    function update() {
      const el = document.getElementById('creativeState'); if (!el) return;
      el.textContent = accepted && accepted.key === key() ? '当前方案已绑定本产品/国家 · ' + accepted.context.marketCode : '新任务或资料已变化：请生成新方案，旧结果暂时保留';
      el.style.color = accepted && accepted.key === key() ? '#047857' : '#b45309';
    }
    function changed(event) {
      const id = event?.target?.id || '';
      if (/^(ccE|vc)/.test(id) && event?.target?.tagName === 'TEXTAREA') promptKey = null;
      update();
    }
    document.addEventListener('change', changed); document.addEventListener('input', changed);
    return { begin, current, assert, accept, requireScheme, acceptPrompts, requirePrompts, update, key };
  }

  const extraFields = { contextRules: '任务上下文优先级', referenceRules: '图片角色与参考图边界', dnaRules: '视觉DNA与套图一致性规则', editRules: '结果图局部编辑规则', editTemplates: '结果图编辑预设（JSON）', platforms: '平台视觉档案（JSON）', categoryRules: '品类规则（JSON）', runtimeOptions: '模型运行参数与知识库筛选（JSON）' };
  function refreshChoices(mode, getSettings) {
    for (const [id, map] of [['creativePlatform', parseMap(getSettings().platforms, '平台档案')], ['creativeCategory', parseMap(getSettings().categoryRules, '品类档案')]]) {
      const select = document.getElementById(id); if (!select) continue;
      const previous = select.value; select.replaceChildren();
      const categoryNames = {general:'通用',beauty:'美妆个护',home:'家居',fitness:'健身运动',electronics:'电子产品'};
      for (const [key, item] of Object.entries(map)) { const option = document.createElement('option'); option.value = key; option.textContent = item?.name || (id==='creativeCategory' && categoryNames[key]) || key; select.append(option); }
      select.value = mode === 'fba' && id === 'creativePlatform' ? 'amazon' : (Object.hasOwn(map, previous) ? previous : Object.keys(map)[0] || '');
    }
  }
  function mount(mode, getSettings, read) {
    const host = document.querySelector('#iStyle')?.closest('.fg');
    if (host && !document.getElementById('creativePlatform')) {
      const block = document.createElement('div'); block.style.cssText = 'display:grid;gap:8px;margin:12px 0;font-size:12px';
      block.innerHTML = '<label>目标平台 <select id="creativePlatform" class="fs"></select></label><label>图片版位 <select id="creativeSurface" class="fs"><option value="auto">按每张图任务</option><option value="primary">商品主图</option><option value="secondary">商品辅图</option><option value="aplus">A+ 模块</option><option value="brand-story">品牌故事</option><option value="ad">广告素材</option></select></label><label>品类 <select id="creativeCategory" class="fs"></select></label><label>品牌调性 / 价格定位 <input id="creativeBrand" class="fi" placeholder="例如：亲和实用、中端专业、自然克制"></label><label>必须保留的特征（可选）<input id="creativeProductLock" class="fi" placeholder="不必重复描述产品；只写特别容易画错的地方"></label><div id="creativeState"></div><button type="button" id="creativeTraceButton" class="btn btn-sm">查看本次实际请求</button><details><summary>本套视觉 DNA（生成方案后确定，可编辑）</summary><textarea id="creativeDna" class="ft" rows="7" placeholder="生成方案后显示"></textarea></details>';
      host.after(block);
      refreshChoices(mode, getSettings);
      document.getElementById('creativePlatform').value = mode === 'fba' ? 'amazon' : 'neutral';
      if (mode === 'fba') document.getElementById('creativePlatform').disabled = true;
      document.getElementById('creativeTraceButton').onclick = showTrace;
      const storageKey = 'ai_photo_editor.creative.' + mode + '.v1';
      const ids = ['creativePlatform', 'creativeSurface', 'creativeCategory', 'creativeBrand', 'creativeProductLock'];
      try { const stored = JSON.parse(localStorage.getItem(storageKey) || '{}'); for (const id of ids) if (typeof stored[id] === 'string' && !(mode === 'fba' && id === 'creativePlatform')) document.getElementById(id).value = stored[id]; } catch (_) {}
      for (const id of ids) document.getElementById(id).addEventListener('change', () => { const value = Object.fromEntries(ids.filter(key => key !== 'creativeProductLock').map(key => [key, document.getElementById(key).value])); localStorage.setItem(storageKey, JSON.stringify(value)); });
    }
    const anchor = document.getElementById('sp_aesthetic');
    if (anchor && !document.getElementById('creativeAdvanced')) {
      const section = document.createElement('section'); section.id = 'creativeAdvanced'; section.style.cssText = 'margin-top:20px;display:grid;gap:10px';
      if (mode === 'fba') { const title = document.createElement('label'), textarea = document.createElement('textarea'); title.textContent='产品保真规则（原图事实，不再单独识别颜色）'; textarea.id='sp_productRules'; textarea.className='ft'; textarea.rows=4; section.append(title,textarea); }
      for (const [key, label] of Object.entries(extraFields)) { const title = document.createElement('label'); title.textContent = label; const textarea = document.createElement('textarea'); textarea.id = 'sp_' + key; textarea.className = 'ft'; textarea.rows = key.endsWith('Rules') ? 4 : 8; section.append(title, textarea); }
      const protocol = document.createElement('details'); const protocolTitle = document.createElement('summary'); protocolTitle.textContent='系统结构约束（只读，可查看）'; const protocolText = document.createElement('p'); protocolText.textContent='JSON Schema、任务编号、图片顺序、接口字段、网页上传与标签激活协议由程序维护，不是画面风格规则。每次请求的完整 Schema、图像角色、最终提示词和参数都可在「查看本次实际请求」中核对；不记录 API Key 或图片编码。'; protocol.append(protocolTitle,protocolText); section.append(protocol);
      const note = document.createElement('div'); note.id = 'creativeConfigRevision'; section.append(note); anchor.after(section);
    }
    return createFlow(read);
  }
  function openAdvanced(mode, settings) {
    const advancedField = key => mode === 'fba' && key === 'recognize' ? 'productRules' : mode === 'fba' && key === 'extract' ? 'recognize' : key === 'strategy' ? 'concept' : key;
    if (mode === 'fba' && document.getElementById('sp_productRules')) document.getElementById('sp_productRules').value = settings.recognize || '';
    for (const key of Object.keys(extraFields)) { const el = document.getElementById('sp_' + key); if (el) el.value = settings[key] || ''; }
    const note = document.getElementById('creativeConfigRevision');
    if (note) { note.textContent = '默认规则版本 ' + REVISION + '。自定义规则优先；旧规则不静默删除。'; const defaults = defaultRegistry.get(mode); for (const [key, value] of Object.entries(defaults || {})) if (typeof value === 'string' && settings[key] !== value) { const d = document.createElement('details'); const s = document.createElement('summary'); s.textContent = key + '：当前值与新版默认不同'; const pre = document.createElement('pre'); pre.style.cssText = 'white-space:pre-wrap;font-size:11px'; pre.textContent = '当前：\n' + settings[key] + '\n\n新版默认：\n' + value; const button = document.createElement('button'); button.type = 'button'; button.textContent = '将此字段填入新版默认（保存后生效）'; button.onclick = () => { const el = document.getElementById('sp_' + advancedField(key)); if (el) el.value = value; }; d.append(s, pre, button); note.append(d); } }
    const backupKey = window.AiPhotoPromptSettings?.getStorageKey(mode) + '.backup.' + REVISION;
    const raw = localStorage.getItem(backupKey);
    if (note && raw) {
      const details = document.createElement('details'), summary = document.createElement('summary'), pre = document.createElement('pre');
      summary.textContent = '查看升级前的提示词备份（只读，不自动重新启用）';
      pre.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;max-height:300px;overflow:auto;font-size:11px';
      try { const stored = JSON.parse(raw); const saved = stored.prompts || stored; pre.textContent = JSON.stringify(Object.fromEntries(Object.entries(saved).filter(([key,value]) => typeof value === 'string' && !/key|token|secret/i.test(key))),null,2); } catch (_) { pre.textContent = '备份格式无效，原备份仍保留。'; }
      details.append(summary,pre); note.append(details);
    }
  }
  function readAdvanced() {
    const value = Object.fromEntries(Object.keys(extraFields).map(key => [key, document.getElementById('sp_' + key)?.value || '']));
    if (document.getElementById('sp_productRules')) value.recognize = document.getElementById('sp_productRules').value;
    for (const key of ['platforms', 'categoryRules', 'runtimeOptions', 'editTemplates']) parseMap(value[key], key);
    parseMap(document.getElementById('sp_aesthetic')?.value, '市场档案');
    return value;
  }

  window.PhotoCreative = Object.freeze({ revision: REVISION, upgradeDefaults, parseMap, profile, escapeHtml, fingerprint, format, validate, object, array, schemeSchema, requestText, knowledge, systemText, mount, refreshChoices, openAdvanced, readAdvanced, record, showTrace, imageParts, summarizeParts, createFlow });
})();
