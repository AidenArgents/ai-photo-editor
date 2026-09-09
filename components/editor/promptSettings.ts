export const EDITOR_PROMPT_STORAGE_KEY = 'ai_photo_editor.prompts.editor.v1';
export const EDITOR_DEFAULTS_REVISION = '2026-09-04.1';

export interface EditorPromptSettings {
  fusionTemplates: Record<string, string>;
  generationTemplate: string;
  promptOptimizerSystem: string;
  executionRules: string;
  paddingRule: string;
}

const LEGACY_FUSION_TEMPLATES: Record<string, string> = {
  replace_background: '请按参考图（图二）的背景场景与物理光影，将产品主图（图一）无缝融合，并在产品底部渲染真实物理接触阴影。',
  combine: '请参考第二张图的光影氛围与美学色调，将产品主图置于其中，协调整体光照与环境反射。',
  replace_product: '请将参考场景（图二）中原有的旧物体移除，替换为图一中的主产品，严格匹配透视角度与阴影。',
  add_logo: '请将图二中的 LOGO/水印提取并自然叠加到产品主图之上，保持边缘清晰和适当透明度。',
  replace_person: '请保持图一中人物的动作和服装不变，将其面容与头部特征替换为图二中的目标人物，做到光影无缝融合。',
  remove_watermark: '去除右下角的gemini图标',
  custom: '',
};

export const DEFAULT_FUSION_TEMPLATES: Record<string, string> = {
  replace_background: '按参考图的背景场景与光影，将主图产品自然融入其中，保持产品身份和真实尺度。',
  combine: '参考参考图的光影氛围与色调，调整主图的光照和环境反射，保持产品本色。',
  replace_product: '将参考场景中指定的旧产品替换成主图产品，匹配透视与光影，保留场景其余部分。',
  add_logo: '将参考图中的标志加入主图，保持标志的比例与清晰边缘。',
  replace_person: '保持主图中人物的动作和服装，将面容与头部特征替换为参考图中的目标人物，协调光影。',
  remove_watermark: '去除右下角的gemini图标',
  custom: '',
};

export const DEFAULT_PROMPT_OPTIMIZER_SYSTEM = `你是一个忠实、受控的电商图片提示词编辑器。你的任务是在不改变用户原意的前提下，整理原句，并且只对用户已经明确提出的要求做必要的执行性细化。

规则：
1. 用户原句是唯一事实来源。逐项保留任务对象、修改范围、数量、位置、颜色、比例、文字内容、语言和“保持不变”等限制。
2. 只能整理或细化用户已经提出的维度；不得主动增加商品、人物、场景、道具、卖点、价格、规格、功效、认证、品牌、文案或使用方法。
3. 严格区分文字内容、文字语言、文字排版和整体画面风格。用户只要求文字排版时，不得把它扩大成整张图的构图或风格。
4. 用户提供的具体文字必须原样保留，除非用户明确要求改写或翻译。
5. 产品编辑可在不冲突时补充“保持产品外观和细节准确”；用户明确要求修改的属性不受这条保真要求阻止。
6. 不主动推断多张图片之间的关系，也不要求所有图片内容都出现在结果中，除非用户明确提出。
7. 不添加“大师、杰作、8K”等空洞词，不堆砌负面提示词，不设置最低字数。
8. 结果通常为1至3句，只输出优化后的提示词正文，不输出标题、解释、引号、Markdown或JSON。`;

export const DEFAULT_EDITOR_PROMPT_SETTINGS: EditorPromptSettings = {
  fusionTemplates: { ...DEFAULT_FUSION_TEMPLATES },
  generationTemplate: '{prompt}',
  promptOptimizerSystem: DEFAULT_PROMPT_OPTIMIZER_SYSTEM,
  executionRules: '主图提供本次编辑对象；参考图仅提供用户指明的素材、人物、背景或风格，不自行推断所有素材都要出现。准确执行用户指令，保持未要求修改的商品颜色、形状、包装、标签和数量。用户明确要改的属性以指令为准。',
  paddingRule: '输入图片为适配画幅已补白。按编辑指令自然补全空白区域，不拉伸原商品。',
};

function cloneDefaults(): EditorPromptSettings {
  return {
    fusionTemplates: { ...DEFAULT_EDITOR_PROMPT_SETTINGS.fusionTemplates },
    generationTemplate: DEFAULT_EDITOR_PROMPT_SETTINGS.generationTemplate,
    promptOptimizerSystem: DEFAULT_EDITOR_PROMPT_SETTINGS.promptOptimizerSystem,
    executionRules: DEFAULT_EDITOR_PROMPT_SETTINGS.executionRules,
    paddingRule: DEFAULT_EDITOR_PROMPT_SETTINGS.paddingRule,
  };
}

export function loadEditorPromptSettings(): EditorPromptSettings {
  const defaults = cloneDefaults();
  try {
    const raw = localStorage.getItem(EDITOR_PROMPT_STORAGE_KEY);
    if (!raw) return defaults;
    const stored = JSON.parse(raw);
    if (!stored || typeof stored !== 'object') return defaults;
    if (stored.defaultsRevision !== EDITOR_DEFAULTS_REVISION && !localStorage.getItem(EDITOR_PROMPT_STORAGE_KEY + '.backup.' + EDITOR_DEFAULTS_REVISION)) localStorage.setItem(EDITOR_PROMPT_STORAGE_KEY + '.backup.' + EDITOR_DEFAULTS_REVISION, raw);
    const savedTemplates: Record<string,string> = {};
    for (const [key,value] of Object.entries(stored.fusionTemplates || {})) if (typeof value === 'string' && (stored.defaultsRevision === EDITOR_DEFAULTS_REVISION || value !== LEGACY_FUSION_TEMPLATES[key])) savedTemplates[key] = value;
    return {
      fusionTemplates: stored.fusionTemplates && typeof stored.fusionTemplates === 'object'
        ? { ...defaults.fusionTemplates, ...savedTemplates }
        : defaults.fusionTemplates,
      generationTemplate: typeof stored.generationTemplate === 'string'
        ? stored.generationTemplate
        : defaults.generationTemplate,
      promptOptimizerSystem: typeof stored.promptOptimizerSystem === 'string'
        ? stored.promptOptimizerSystem
        : defaults.promptOptimizerSystem,
      executionRules: typeof stored.executionRules === 'string' ? stored.executionRules : defaults.executionRules,
      paddingRule: typeof stored.paddingRule === 'string' ? stored.paddingRule : defaults.paddingRule,
    };
  } catch {
    return defaults;
  }
}

export function saveEditorPromptSettings(settings: EditorPromptSettings): void {
  localStorage.setItem(EDITOR_PROMPT_STORAGE_KEY, JSON.stringify({
    ...settings,
    promptSchemaVersion: 1,
    defaultsRevision: EDITOR_DEFAULTS_REVISION,
    savedAt: new Date().toISOString(),
  }));
}

export function resetEditorPromptSettings(): EditorPromptSettings {
  localStorage.removeItem(EDITOR_PROMPT_STORAGE_KEY);
  return cloneDefaults();
}

export function compileEditorPrompt(
  template: string,
  prompt: string,
  mergeMode: string,
  mainImageCount: number,
  hasReferenceImage: boolean,
): string {
  const variables: Record<string,string> = {prompt:prompt.trim(),mode:mergeMode,mainImageCount:String(mainImageCount),hasReferenceImage:hasReferenceImage?'true':'false'};
  return template
    .replace(/\{(prompt|mode|mainImageCount|hasReferenceImage)\}/g,(_,key)=>variables[key])
    .trim();
}
