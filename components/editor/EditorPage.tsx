import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { ImageFile } from '../../types';
import { expandPromptForImage } from '../../services/geminiService';
import { recordRequest, showRequestTrace } from '../../services/requestTrace';
import ImageUpload from '../ImageUpload';
import PromptInput from '../PromptInput';
import ImageDisplay from '../ImageDisplay';
import Loader from '../Loader';
import { DownloadIcon, LayersIcon, WandSparklesIcon } from '../Icons';
import type { EditorPageProps } from './types';
import EditorAdvancedSettings from './EditorAdvancedSettings';
import {
  compileEditorPrompt,
  loadEditorPromptSettings,
  resetEditorPromptSettings,
  saveEditorPromptSettings,
  type EditorPromptSettings,
} from './promptSettings';

export default function EditorPage({
  mode,
  promptExpansionImageModel,
  customApiKey,
  customModeLabel,
  customAspectRatioWarning,
  showHighFidelityOption,
  generateImage,
  onSourceImagesChanged,
}: EditorPageProps): React.JSX.Element {
  const [originalImages, setOriginalImages] = useState<ImageFile[]>([]);
  const originalImage = originalImages[0] || null;
  const [secondaryImage, setSecondaryImage] = useState<ImageFile | null>(null);
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [promptBeforeExpansion, setPromptBeforeExpansion] = useState<string | null>(null);
  const [isExpandingPrompt, setIsExpandingPrompt] = useState(false);
  const [promptExpansionMessage, setPromptExpansionMessage] = useState<string | null>(null);
  const [promptExpansionError, setPromptExpansionError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mergeMode, setMergeMode] = useState(
    () => localStorage.getItem(`fusion_merge_mode_${mode}`) || localStorage.getItem('fusion_merge_mode') || 'custom'
  );
  const [aspectRatio, setAspectRatio] = useState('auto');
  const [aspectRatioWarning, setAspectRatioWarning] = useState<string | null>(null);
  const [highFidelityPreserve, setHighFidelityPreserve] = useState(false);
  const [promptSettings, setPromptSettings] = useState<EditorPromptSettings>(loadEditorPromptSettings);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const sourceRevision = useRef(0);
  const currentPrompt = useRef(prompt);
  currentPrompt.current = prompt;

  useEffect(() => {
    if (!secondaryImage && mergeMode !== 'custom' && mergeMode !== 'remove_watermark') {
      setMergeMode('custom');
    }
  }, [secondaryImage, mergeMode]);

  useEffect(() => {
    if (aspectRatio === 'auto') {
      setAspectRatioWarning(null);
      return;
    }
    setAspectRatioWarning(
      mergeMode === 'custom'
        ? customAspectRatioWarning
        : '画幅交给模型的原生参数；默认发送原图。可手动选择补白，但补白不保证产品完全不变。'
    );
  }, [aspectRatio, mergeMode, customAspectRatioWarning]);

  const resetOutput = useCallback(() => {
    sourceRevision.current++;
    setEditedImage(null);
    setError(null);
    onSourceImagesChanged?.();
  }, [onSourceImagesChanged]);

  const handleImageUpload = (file: File) => {
    setOriginalImages([{ file, url: URL.createObjectURL(file) }]);
    resetOutput();
  };

  const handleImagesUpload = (files: File[]) => {
    setOriginalImages(files.map((file) => ({ file, url: URL.createObjectURL(file) })));
    resetOutput();
  };

  const handleImageRemove = () => {
    setOriginalImages([]);
    resetOutput();
  };

  const handleSecondaryImageUpload = (file: File) => {
    setSecondaryImage({ file, url: URL.createObjectURL(file) });
    resetOutput();
    if (mergeMode === 'remove_watermark') {
      setMergeMode('custom');
      if (!prompt.trim() || prompt === promptSettings.fusionTemplates.remove_watermark) setPrompt(promptSettings.fusionTemplates.custom || '');
    } else if (!prompt.trim()) {
      setPrompt(promptSettings.fusionTemplates[mergeMode] || '');
    }
  };

  const handleSecondaryImageRemove = () => {
    setSecondaryImage(null);
    resetOutput();
  };

  const handleMergeModeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextMode = event.target.value;
    setMergeMode(nextMode);
    localStorage.setItem(`fusion_merge_mode_${mode}`, nextMode);
    setPromptBeforeExpansion(null);
    setPromptExpansionMessage(null);
    setPromptExpansionError(null);
    if (aspectRatio !== 'auto') {
      setHighFidelityPreserve(false);
      setAspectRatioWarning(nextMode === 'custom' ? customAspectRatioWarning : '默认发送原图并使用模型画幅参数；补白只是可选预处理，不保证商品完全不变。');
    }
    if (nextMode !== 'custom') setPrompt(promptSettings.fusionTemplates[nextMode] || '');
  };

  const handlePromptChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(event.target.value);
    setPromptExpansionMessage(null);
    setPromptExpansionError(null);
  };

  const handleExpandPrompt = async () => {
    if (!prompt.trim()) {
      setPromptExpansionError('请先输入需要扩写的提示词。');
      return;
    }
    if (!customApiKey.trim()) {
      setPromptExpansionError('请先在页面右上角填写 Gemini API Key。');
      return;
    }
    setIsExpandingPrompt(true);
    const revision = sourceRevision.current;
    setPromptExpansionMessage(null);
    setPromptExpansionError(null);
    try {
      const result = await expandPromptForImage({
        prompt: prompt.trim(),
        imageModel: promptExpansionImageModel,
        mainImageCount: Math.max(1, originalImages.length),
        hasReferenceImage: secondaryImage !== null,
        mergeMode,
        aspectRatio,
        customApiKey,
        promptOptimizerSystem: promptSettings.promptOptimizerSystem,
      });
      if (revision !== sourceRevision.current || currentPrompt.current !== prompt) throw new Error('原图或提示词已变化，未覆盖你当前的输入。');
      setPromptBeforeExpansion((current) => current ?? prompt);
      setPrompt(result.expandedPrompt);
      const warnings = result.warnings.length ? ` ${result.warnings.join(' ')}` : '';
      setPromptExpansionMessage(`已按 ${result.imageModelName || '当前模型'} 受控优化，结果已写入输入框。${warnings}`);
    } catch (cause: unknown) {
      setPromptExpansionError(cause instanceof Error ? cause.message : '提示词扩写失败，请重试。');
    } finally {
      setIsExpandingPrompt(false);
    }
  };

  const handleRestorePrompt = () => {
    if (promptBeforeExpansion === null) return;
    setPrompt(promptBeforeExpansion);
    setPromptBeforeExpansion(null);
    setPromptExpansionError(null);
    setPromptExpansionMessage('已恢复扩写前的原文。');
  };

  const handleAspectRatioChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextRatio = event.target.value;
    setAspectRatio(nextRatio);
    if (nextRatio === 'auto') {
      setHighFidelityPreserve(false);
      setAspectRatioWarning(null);
      return;
    }
    setHighFidelityPreserve(false);
    setAspectRatioWarning(mergeMode === 'custom' ? customAspectRatioWarning : '画幅交给模型的原生参数；默认发送原图。可手动选择补白，但补白不保证产品完全不变。');
  };

  const handleGenerateClick = useCallback(async () => {
    if (!originalImage || (mergeMode !== 'remove_watermark' && !prompt.trim())) {
      setError('请上传主图并填写修图指令。');
      return;
    }
    setIsLoading(true);
    setError(null);
    setEditedImage(null);
    const revision = sourceRevision.current;
    try {
      const compiled = compileEditorPrompt(
        promptSettings.generationTemplate,
        prompt,
        mergeMode,
        originalImages.length,
        Boolean(secondaryImage),
      );
      const roles = '主图：IMAGE 1' + (originalImages.length > 1 ? '–' + originalImages.length : '') + (secondaryImage ? '；参考图：IMAGE ' + (originalImages.length+1) : '');
      const effectivePrompt = mergeMode === 'custom' || mergeMode === 'remove_watermark' ? compiled : [roles, promptSettings.executionRules, mode === 'api' && highFidelityPreserve ? promptSettings.paddingRule : '', compiled].filter(Boolean).join('\n\n');
      recordRequest({stage:'editor-image',provider:mode,prompt:effectivePrompt,parameters:{aspectRatio,highFidelityPreserve,mergeMode},images:originalImages.map((image,index)=>({index:index+1,name:image.file.name,bytes:image.file.size})),referenceImage:secondaryImage?.file.name||null});
      const result = await generateImage({
        originalImages,
        secondaryImage,
        prompt: effectivePrompt,
        aspectRatio,
        highFidelityPreserve,
        mergeMode,
      });
      if (revision !== sourceRevision.current) throw new Error('本次等待期间已更换图片，旧结果未应用到新产品。');
      setEditedImage(result);
    } catch (cause: unknown) {
      const message = cause instanceof Error ? cause.message : '发生未知错误。';
      setError(`生成失败：${message}`);
      console.error(cause);
    } finally {
      setIsLoading(false);
    }
  }, [originalImage, originalImages, secondaryImage, prompt, aspectRatio, highFidelityPreserve, mergeMode, generateImage, promptSettings, mode]);

  const handleSaveAdvancedSettings = (nextSettings: EditorPromptSettings) => {
    const previousTemplate = promptSettings.fusionTemplates[mergeMode] || '';
    saveEditorPromptSettings(nextSettings);
    setPromptSettings(nextSettings);
    if (mergeMode !== 'custom' && prompt === previousTemplate) {
      setPrompt(nextSettings.fusionTemplates[mergeMode] || '');
    }
    setShowAdvancedSettings(false);
  };

  const handleResetAdvancedSettings = () => {
    const previousTemplate = promptSettings.fusionTemplates[mergeMode] || '';
    const defaults = resetEditorPromptSettings();
    setPromptSettings(defaults);
    if (mergeMode !== 'custom' && prompt === previousTemplate) {
      setPrompt(defaults.fusionTemplates[mergeMode] || '');
    }
  };

  const handleDownloadClick = () => {
    if (!editedImage) return;
    const link = document.createElement('a');
    link.href = editedImage;
    const mimeType = editedImage.substring(editedImage.indexOf(':') + 1, editedImage.indexOf(';'));
    link.download = `edited-image.${mimeType.split('/')[1] || 'png'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const canGenerate = originalImage !== null && (mergeMode === 'remove_watermark' || prompt.trim().length > 0) && !isLoading;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 lg:h-[calc(100vh-110px)] lg:max-h-[calc(100vh-110px)] min-h-0 overflow-hidden">
      <div className="lg:col-span-3 bg-white/80 rounded-2xl p-4 shadow-lg border border-pink-200 flex flex-col gap-3 h-full min-h-0 overflow-hidden">
        <h2 className="text-xl font-bold text-pink-600 shrink-0">1. 上传图片</h2>
        <div className="flex flex-col gap-1.5 flex-1 min-h-0 overflow-hidden">
          <h3 className="text-base font-semibold text-gray-700 shrink-0">主要产品 / 主体 <span className="text-xs font-normal text-pink-600 ml-1">(产品主图)</span></h3>
          <p className="text-xs text-gray-500 -mt-1 mb-1 shrink-0">您需要保留和编辑的核心产品或主体。</p>
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <ImageUpload multiple onImageUpload={handleImageUpload} onImagesUpload={handleImagesUpload} onImageRemove={handleImageRemove} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5 flex-1 min-h-0 overflow-hidden">
          <div className="flex items-center gap-2 shrink-0"><LayersIcon /><h3 className="text-base font-semibold text-gray-700">参考图片 <span className="text-xs font-normal text-pink-600 ml-1">(场景/期望效果图)</span></h3></div>
          <p className="text-xs text-gray-500 -mt-1 mb-1 shrink-0">选填：上传参考背景场景、风格或目标构图。</p>
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <ImageUpload onImageUpload={handleSecondaryImageUpload} onImageRemove={handleSecondaryImageRemove} />
          </div>
          <div className="mt-2 p-2.5 bg-pink-100/40 rounded-lg border border-pink-200 animate-fadeIn shrink-0">
            <div className="flex items-center justify-between mb-1">
              <label htmlFor={`merge-mode-${mode}`} className="block text-xs font-bold text-pink-800">Fusion Mode (修图与融合模式):</label>
              {!secondaryImage && <span className="text-[10px] text-pink-600 bg-pink-100 px-2 py-0.5 rounded-full font-bold">传参考图解锁双图融合</span>}
            </div>
            <select id={`merge-mode-${mode}`} value={mergeMode} onChange={handleMergeModeChange} className="block w-full p-2 bg-white border-2 border-pink-300 rounded-lg text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-400">
              <option value="custom">{customModeLabel}</option>
              <option value="remove_watermark">Remove Watermark (去除右下角水印或AI图标)</option>
              <option value="replace_background" disabled={!secondaryImage}>Background Fusion (场景融合·主图融进参考图背景{secondaryImage ? '' : ' · 需参考图'})</option>
              <option value="combine" disabled={!secondaryImage}>Style & Lighting Reference (风格光影参考{secondaryImage ? '' : ' · 需参考图'})</option>
              <option value="replace_product" disabled={!secondaryImage}>Replace Product (主体调换·替换参考图产品{secondaryImage ? '' : ' · 需参考图'})</option>
              <option value="add_logo" disabled={!secondaryImage}>Add Logo / Watermark (叠加标志或水印{secondaryImage ? '' : ' · 需参考图'})</option>
              <option value="replace_person" disabled={!secondaryImage}>Replace Person (人物模特调换·面部与姿态融合{secondaryImage ? '' : ' · 需参考图'})</option>
            </select>
          </div>
        </div>
      </div>

      <div className="lg:col-span-3 bg-white/80 rounded-2xl p-4 shadow-lg border border-pink-200 flex flex-col gap-3 h-full min-h-0 overflow-hidden">
        <div className="flex items-center justify-between gap-3 shrink-0">
          <h2 className="text-xl font-bold text-pink-600">2. 描述修图指令</h2>
          <button type="button" onClick={showRequestTrace} className="text-[11px] text-slate-500">查看本次实际请求</button>
          <button type="button" onClick={() => setShowAdvancedSettings(true)} className="px-2.5 py-1.5 rounded-lg border border-pink-200 bg-white text-[11px] font-bold text-pink-600 hover:bg-pink-50">⚙️ 高级参数</button>
        </div>
        <div className="flex-1 flex flex-col min-h-0">
          <PromptInput value={prompt} onChange={handlePromptChange} />
          {mergeMode === 'custom' && (
            <div className="mt-2 shrink-0">
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={handleExpandPrompt} disabled={isExpandingPrompt || isLoading || !prompt.trim()} className="px-3 py-1.5 rounded-lg border border-pink-300 bg-pink-50 text-pink-700 text-xs font-bold hover:bg-pink-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">{isExpandingPrompt ? '正在优化…' : '✨ AI 优化提示词'}</button>
                {promptBeforeExpansion !== null && <button type="button" onClick={handleRestorePrompt} disabled={isExpandingPrompt || isLoading} className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-600 text-xs font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">恢复原文</button>}
                <span className="text-[11px] text-gray-400">只细化你明确提出的要求，不改变作用对象，结果可见、可修改</span>
              </div>
              {promptExpansionMessage && <p className="mt-1.5 text-[11px] text-emerald-700">{promptExpansionMessage}</p>}
              {promptExpansionError && <p className="mt-1.5 text-[11px] text-red-500">{promptExpansionError}</p>}
            </div>
          )}
        </div>
        <div className="shrink-0">
          <label htmlFor={`aspect-ratio-${mode}`} className="block text-sm font-medium text-gray-700 mb-1">图片宽高比</label>
          <select id={`aspect-ratio-${mode}`} value={aspectRatio} onChange={handleAspectRatioChange} className="block w-full p-2 bg-white border-2 border-pink-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-400">
            <option value="auto">保持原始比例</option><option value="prompt">智能自动 (根据提示词)</option><option value="1:1">正方形 (1:1)</option><option value="3:4">竖屏人像 (3:4)</option><option value="4:3">横屏风景 (4:3)</option><option value="3:2">横屏风景 (3:2)</option><option value="4:5">社交平台竖屏 (4:5)</option><option value="16:9">宽屏显示 (16:9)</option><option value="9:16">全屏手机竖屏 (9:16)</option>
          </select>
          {aspectRatioWarning && <p className="text-amber-800 bg-amber-100 border-l-4 border-amber-500 rounded p-3 text-xs mt-3">{aspectRatioWarning}</p>}
          {showHighFidelityOption && aspectRatio !== 'auto' && mergeMode !== 'custom' && (
            <div className="mt-3 p-3 bg-pink-100/50 rounded-lg border border-pink-200">
              <label htmlFor="high-fidelity-preserve" className="flex items-center gap-2 cursor-pointer"><input type="checkbox" id="high-fidelity-preserve" checked={highFidelityPreserve} onChange={(event) => setHighFidelityPreserve(event.target.checked)} className="h-4 w-4 rounded border-gray-300 text-pink-600 focus:ring-pink-500" /><span className="text-sm font-medium text-pink-800">补白适配画幅（可选）</span></label>
              <p className="text-xs text-pink-700/80 mt-1 pl-6">不拉伸原图，但模型仍可能改变商品细节；默认关闭。</p>
            </div>
          )}
        </div>
        <button onClick={handleGenerateClick} disabled={!canGenerate} className="shrink-0 flex items-center justify-center gap-2 w-full px-6 py-3.5 font-bold text-white rounded-xl transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 shadow-md shadow-pink-500/20 disabled:shadow-none focus:outline-none focus:ring-4 focus:ring-pink-400 focus:ring-opacity-50">
          {isLoading ? <><Loader className="text-white" /><span>正在修图中...</span></> : <><WandSparklesIcon /><span className="text-base">生成修图结果</span></>}
        </button>
        {error && <p className="text-red-500 text-xs mt-1 text-center shrink-0">{error}</p>}
      </div>

      <div className="lg:col-span-6 bg-white/80 rounded-2xl p-4 shadow-lg border border-pink-200 flex flex-col gap-3 h-full min-h-0 overflow-hidden">
        <div className="flex justify-between items-center shrink-0">
          <h2 className="text-xl font-bold text-pink-600">3. 修图结果展示</h2>
          {editedImage && !isLoading && <button onClick={handleDownloadClick} className="flex items-center justify-center gap-2 px-4 py-2 font-bold text-pink-600 rounded-lg transition-all duration-300 ease-in-out border-2 border-pink-500 bg-white hover:bg-pink-50 focus:outline-none focus:ring-4 focus:ring-pink-400 focus:ring-opacity-50"><DownloadIcon /><span>下载原图</span></button>}
        </div>
        <div className="flex-1 min-h-0 flex flex-col"><ImageDisplay imageUrl={editedImage} isLoading={isLoading} /></div>
      </div>
      {showAdvancedSettings && (
        <EditorAdvancedSettings
          settings={promptSettings}
          onClose={() => setShowAdvancedSettings(false)}
          onSave={handleSaveAdvancedSettings}
          onReset={handleResetAdvancedSettings}
        />
      )}
    </div>
  );
}
