import React, { useMemo, useState } from 'react';
import { DEFAULT_EDITOR_PROMPT_SETTINGS, EDITOR_DEFAULTS_REVISION, EDITOR_PROMPT_STORAGE_KEY, type EditorPromptSettings } from './promptSettings';

interface EditorAdvancedSettingsProps {
  settings: EditorPromptSettings;
  onClose: () => void;
  onSave: (settings: EditorPromptSettings) => void;
  onReset: () => void;
}

export default function EditorAdvancedSettings({
  settings,
  onClose,
  onSave,
  onReset,
}: EditorAdvancedSettingsProps): React.JSX.Element {
  const initialTemplates = useMemo(
    () => JSON.stringify(settings.fusionTemplates, null, 2),
    [settings.fusionTemplates],
  );
  const [fusionTemplates, setFusionTemplates] = useState(initialTemplates);
  const [generationTemplate, setGenerationTemplate] = useState(settings.generationTemplate);
  const [promptOptimizerSystem, setPromptOptimizerSystem] = useState(settings.promptOptimizerSystem);
  const [executionRules, setExecutionRules] = useState(settings.executionRules);
  const [paddingRule, setPaddingRule] = useState(settings.paddingRule);
  const [error, setError] = useState<string | null>(null);
  const backup = localStorage.getItem(EDITOR_PROMPT_STORAGE_KEY + '.backup.' + EDITOR_DEFAULTS_REVISION);
  const handleReset = () => {
    onReset();
    setFusionTemplates(JSON.stringify(DEFAULT_EDITOR_PROMPT_SETTINGS.fusionTemplates,null,2));
    setGenerationTemplate(DEFAULT_EDITOR_PROMPT_SETTINGS.generationTemplate);
    setPromptOptimizerSystem(DEFAULT_EDITOR_PROMPT_SETTINGS.promptOptimizerSystem);
    setExecutionRules(DEFAULT_EDITOR_PROMPT_SETTINGS.executionRules);
    setPaddingRule(DEFAULT_EDITOR_PROMPT_SETTINGS.paddingRule);
    setError(null);
  };

  const handleSave = () => {
    try {
      const parsed = JSON.parse(fusionTemplates);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('融合模式默认指令必须是 JSON 对象。');
      }
      if (!generationTemplate.includes('{prompt}')) {
        throw new Error('最终提示词模板必须包含 {prompt}，否则会丢失当前编辑指令。');
      }
      if (!promptOptimizerSystem.trim()) {
        throw new Error('AI 优化规则不能为空。');
      }
      onSave({
        fusionTemplates: Object.fromEntries(
          Object.entries(parsed).map(([key, value]) => [key, String(value ?? '')]),
        ),
        generationTemplate,
        promptOptimizerSystem,
        executionRules,
        paddingRule,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '设置格式错误。');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="w-full max-w-4xl max-h-[88vh] overflow-hidden rounded-2xl bg-white shadow-2xl border border-pink-200 flex flex-col">
        <div className="px-5 py-4 border-b border-pink-100 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-bold text-gray-800">⚙️ 第 1 页高级参数</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">Web/API 共用 · 默认版本 {EDITOR_DEFAULTS_REVISION} · 已保存的自定义规则优先。</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleReset} className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">全部重置</button>
            <button type="button" onClick={handleSave} className="px-3 py-1.5 text-xs rounded-lg bg-emerald-500 text-white font-bold hover:bg-emerald-600">保存</button>
            <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg text-gray-400 hover:bg-gray-100">✕</button>
          </div>
        </div>
        <div className="p-5 overflow-y-auto space-y-6">
          <section>
            <div className="flex items-start gap-3 mb-2">
              <span className="w-7 h-7 rounded-lg bg-pink-500 text-white text-xs font-bold grid place-items-center">1</span>
              <div><h3 className="text-sm font-bold text-gray-800">融合模式默认指令</h3><p className="text-[11px] text-gray-500">切换 Fusion Mode 时写入编辑框；可继续手动修改。</p></div>
            </div>
            <textarea value={fusionTemplates} onChange={(event) => setFusionTemplates(event.target.value)} rows={11} className="w-full rounded-xl border border-pink-200 bg-pink-50/30 p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-pink-300" />
          </section>
          <section>
            <div className="flex items-start gap-3 mb-2">
              <span className="w-7 h-7 rounded-lg bg-violet-500 text-white text-xs font-bold grid place-items-center">2</span>
              <div><h3 className="text-sm font-bold text-gray-800">所有出图渠道共用的最终提示词模板</h3><p className="text-[11px] text-gray-500">变量：{'{prompt}'}、{'{mode}'}、{'{mainImageCount}'}、{'{hasReferenceImage}'}。必须保留 {'{prompt}'}。</p></div>
            </div>
            <textarea value={generationTemplate} onChange={(event) => setGenerationTemplate(event.target.value)} rows={5} className="w-full rounded-xl border border-violet-200 bg-violet-50/30 p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-violet-300" />
          </section>
          <section>
            <div className="flex items-start gap-3 mb-2">
              <span className="w-7 h-7 rounded-lg bg-blue-500 text-white text-xs font-bold grid place-items-center">3</span>
              <div><h3 className="text-sm font-bold text-gray-800">AI 优化提示词规则</h3><p className="text-[11px] text-gray-500">点击“AI 优化提示词”时使用；控制优化边界，不直接改变出图渠道。</p></div>
            </div>
            <textarea value={promptOptimizerSystem} onChange={(event) => setPromptOptimizerSystem(event.target.value)} rows={14} className="w-full rounded-xl border border-blue-200 bg-blue-50/30 p-3 text-xs leading-5 focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </section>
          <section className="space-y-2">
            <h3 className="text-sm font-bold text-gray-800">4. 非 Custom 模式的执行规则</h3>
            <p className="text-[11px] text-gray-500">直接发送原图；不再让后台先描述图片、再靠描述重画。Custom 不附加此规则。</p>
            <textarea value={executionRules} onChange={event=>setExecutionRules(event.target.value)} rows={5} className="w-full rounded-xl border p-3 text-xs" />
            <p className="text-[11px] text-gray-500">API 手动开启补白时附加的说明（补白不保证商品保真）：</p>
            <textarea value={paddingRule} onChange={event=>setPaddingRule(event.target.value)} rows={3} className="w-full rounded-xl border p-3 text-xs" />
          </section>
          <details className="text-xs"><summary>查看新版默认规则（对照，不覆盖已保存值）</summary><pre className="whitespace-pre-wrap break-words p-3">{JSON.stringify(DEFAULT_EDITOR_PROMPT_SETTINGS,null,2)}</pre></details>
          {backup && <details className="text-xs"><summary>查看升级前的提示词备份（只读）</summary><pre className="whitespace-pre-wrap break-words p-3">{backup}</pre></details>}
          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}
        </div>
      </div>
    </div>
  );
}
