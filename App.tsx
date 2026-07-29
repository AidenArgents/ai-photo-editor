import React, { useState, useCallback, useEffect } from 'react';
import { editImage, expandPromptForImage } from './services/geminiService';
import type { ImageFile } from './types';
import Header from './components/Header';
import ImageUpload from './components/ImageUpload';
import PromptInput from './components/PromptInput';
import ImageDisplay from './components/ImageDisplay';
import Loader from './components/Loader';
import { WandSparklesIcon, DownloadIcon, LayersIcon } from './components/Icons';

const EDITOR_MODEL_IDS = [
  'gemini-2.5-flash-image',
  'gemini-3.1-flash-image',
  'gemini-3.1-flash-lite-image',
  'gemini-3-pro-image',
] as const;

const DEFAULT_EDITOR_MODEL = 'gemini-2.5-flash-image';

const PROMPT_TEMPLATES: Record<string, string> = {
  replace_background: `请按参考图（图二）的背景场景与物理光影，将产品主图（图一）无缝融合，并在产品底部渲染真实物理接触阴影。`,
  combine: `请参考第二张图的光影氛围与美学色调，将产品主图置于其中，协调整体光照与环境反射。`,
  replace_product: `请将参考场景（图二）中原有的旧物体移除，替换为图一中的主产品，严格匹配透视角度与阴影。`,
  add_logo: `请将图二中的 LOGO/水印提取并自然叠加到产品主图之上，保持边缘清晰和适当透明度。`,
  replace_person: `请保持图一中人物的动作和服装不变，将其面容与头部特征替换为图二中的目标人物，做到光影无缝融合。`,
  remove_watermark: `去除右下角的gemini图标`,
  custom: ``
};

export default function App(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<'editor' | 'fba' | 'taotu' | 'zhutu' | 'changjing'>('editor');
  const [isSidebarPinned, setIsSidebarPinned] = useState<boolean>(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState<boolean>(false);
  const isSidebarExpanded = isSidebarPinned || isSidebarHovered;
  const [originalImages, setOriginalImages] = useState<ImageFile[]>([]);

  const originalImage = originalImages[0] || null;
  const [secondaryImage, setSecondaryImage] = useState<ImageFile | null>(null);
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [promptBeforeExpansion, setPromptBeforeExpansion] = useState<string | null>(null);
  const [isExpandingPrompt, setIsExpandingPrompt] = useState<boolean>(false);
  const [promptExpansionMessage, setPromptExpansionMessage] = useState<string | null>(null);
  const [promptExpansionError, setPromptExpansionError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [mergeMode, setMergeMode] = useState<string>(
    () => localStorage.getItem('fusion_merge_mode') || 'custom'
  );

  useEffect(() => {
    if (!secondaryImage && mergeMode !== 'custom' && mergeMode !== 'remove_watermark') {
      setMergeMode('custom');
    }
  }, [secondaryImage, mergeMode]);
  const [aspectRatio, setAspectRatio] = useState<string>('auto');
  const [aspectRatioWarning, setAspectRatioWarning] = useState<string | null>(null);
  const [highFidelityPreserve, setHighFidelityPreserve] = useState<boolean>(false);

  const [selectedModel, setSelectedModel] = useState<string>(
    () => {
      const savedModel = localStorage.getItem('gemini_selected_model');
      return savedModel && EDITOR_MODEL_IDS.includes(savedModel as (typeof EDITOR_MODEL_IDS)[number])
        ? savedModel
        : DEFAULT_EDITOR_MODEL;
    }
  );
  const [customApiKey, setCustomApiKey] = useState<string>(
    () => localStorage.getItem('gemini_custom_api_key') || ''
  );

  const handleModelChange = (model: string) => {
    if (!EDITOR_MODEL_IDS.includes(model as (typeof EDITOR_MODEL_IDS)[number])) {
      return;
    }
    setSelectedModel(model);
    localStorage.setItem('gemini_selected_model', model);
  };

  const handleApiKeyChange = (key: string) => {
    setCustomApiKey(key);
    if (key) {
      localStorage.setItem('gemini_custom_api_key', key);
    } else {
      localStorage.removeItem('gemini_custom_api_key');
    }
  };

  const handleImageUpload = (file: File) => {
    setOriginalImages([{
      file: file,
      url: URL.createObjectURL(file),
    }]);
    setEditedImage(null);
    setError(null);
  };

  const handleImagesUpload = (files: File[]) => {
    setOriginalImages(files.map(file => ({
      file: file,
      url: URL.createObjectURL(file),
    })));
    setEditedImage(null);
    setError(null);
  };

  const handleImageRemove = () => {
    setOriginalImages([]);
  };

  const handleSecondaryImageUpload = (file: File) => {
    setSecondaryImage({
      file: file,
      url: URL.createObjectURL(file),
    });
    if (mergeMode === 'remove_watermark') {
      setMergeMode('custom');
      if (prompt.trim() === '' || prompt === PROMPT_TEMPLATES['remove_watermark']) {
        setPrompt(PROMPT_TEMPLATES['custom'] || '');
      }
    } else if (prompt.trim() === '') {
       setPrompt(PROMPT_TEMPLATES[mergeMode]);
    }
  };

  const handleSecondaryImageRemove = () => {
    setSecondaryImage(null);
  };

  const handleMergeModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMode = e.target.value;
    setMergeMode(newMode);
    localStorage.setItem('fusion_merge_mode', newMode);
    setPromptBeforeExpansion(null);
    setPromptExpansionMessage(null);
    setPromptExpansionError(null);
    if (aspectRatio !== 'auto') {
      const isRawCustomMode = newMode === 'custom';
      setHighFidelityPreserve(!isRawCustomMode);
      setAspectRatioWarning(
        isRawCustomMode
          ? 'Custom 原生 API 模式只把宽高比交给 Gemini，不会在本地补白或二次描述图片。'
          : '注意：更改宽高比会重新生成图像。为保证产品图不失真，推荐使用“高保真保留产品”模式。'
      );
    }
    // custom 模式不覆盖用户已有文本
    if (newMode !== 'custom') {
      setPrompt(PROMPT_TEMPLATES[newMode] || '');
    }
  };

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
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
    setPromptExpansionMessage(null);
    setPromptExpansionError(null);

    try {
      const result = await expandPromptForImage({
        prompt: prompt.trim(),
        imageModel: selectedModel,
        mainImageCount: Math.max(1, originalImages.length),
        hasReferenceImage: secondaryImage !== null,
        mergeMode,
        aspectRatio,
        customApiKey,
      });

      setPromptBeforeExpansion((current) => current ?? prompt);
      setPrompt(result.expandedPrompt);
      const warningText =
        result.warnings.length > 0 ? ` ${result.warnings.join(' ')}` : '';
      setPromptExpansionMessage(
        `已按 ${result.imageModelName || '当前模型'} 受控优化，结果已写入输入框。${warningText}`
      );
    } catch (e: unknown) {
      setPromptExpansionError(
        e instanceof Error ? e.message : '提示词扩写失败，请重试。'
      );
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

  const handleAspectRatioChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newAspectRatio = e.target.value;
    setAspectRatio(newAspectRatio);
    
    if (newAspectRatio !== 'auto') {
      setHighFidelityPreserve(mergeMode !== 'custom');
      setAspectRatioWarning(
        mergeMode === 'custom'
          ? 'Custom 原生 API 模式只把宽高比交给 Gemini，不会在本地补白或二次描述图片。'
          : '注意：更改宽高比会重新生成图像。为保证产品图不失真，推荐使用“高保真保留产品”模式。'
      );
    } else {
      setHighFidelityPreserve(false); // Crucially, reset to false for 'auto'
      setAspectRatioWarning(null); // And clear the warning
    }
  };

  const handleGenerateClick = useCallback(async () => {
    if (!originalImage || (mergeMode !== 'remove_watermark' && !prompt.trim())) {
      setError('Please upload a main image and provide an editing prompt.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setEditedImage(null);

    try {
      const result = await editImage(
        originalImages.map(img => img.file),
        secondaryImage?.file ?? null,
        prompt,
        aspectRatio,
        highFidelityPreserve,
        selectedModel,
        customApiKey,
        mergeMode
      );
      setEditedImage(result);
    } catch (e: unknown)      {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      setError(`Failed to edit image: ${errorMessage}`);
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [originalImages, secondaryImage, prompt, aspectRatio, highFidelityPreserve, selectedModel, customApiKey, mergeMode]);

  const handleDownloadClick = () => {
    if (!editedImage) return;
    const link = document.createElement('a');
    link.href = editedImage;
    // Extract file extension from mime type
    const mimeType = editedImage.substring(editedImage.indexOf(':') + 1, editedImage.indexOf(';'));
    const extension = mimeType.split('/')[1] || 'png';
    link.download = `edited-image.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const canGenerate =
    originalImage !== null &&
    (mergeMode === 'remove_watermark' || prompt.trim().length > 0) &&
    !isLoading;

  return (
    <div className="min-h-screen bg-pink-50 text-gray-800 font-sans">
      <Header
        selectedModel={selectedModel}
        onModelChange={handleModelChange}
        customApiKey={customApiKey}
        onApiKeyChange={handleApiKeyChange}
        showModelSelector={activeTab === 'editor'}
      />
      <main className="w-full px-4 md:px-8 py-6 flex flex-col md:flex-row gap-6 items-stretch min-h-[calc(100vh-76px)]">
        {/* Left Side Glassmorphism Bookmark Navigation (Hover Collapsible & Pinnable) */}
        <aside
          onMouseEnter={() => setIsSidebarHovered(true)}
          onMouseLeave={() => setIsSidebarHovered(false)}
          className={`shrink-0 bg-white/70 backdrop-blur-xl rounded-3xl border border-white/80 shadow-xl shadow-pink-500/5 flex flex-col gap-2.5 sticky top-24 z-30 max-h-[calc(100vh-110px)] overflow-y-auto transition-all duration-300 ease-in-out ${
            isSidebarExpanded ? 'w-56 p-4' : 'w-16 p-2.5 items-center'
          }`}
        >
          <div className="w-full flex items-center justify-between px-1 mb-1">
            {isSidebarExpanded ? (
              <>
                <span className="text-xs font-bold text-gray-400 tracking-wider uppercase truncate">AI 矩阵</span>
                <button
                  onClick={() => setIsSidebarPinned(!isSidebarPinned)}
                  title={isSidebarPinned ? "点击解除固定（鼠标移开将自动收缩）" : "点击固定侧边栏（常驻展开）"}
                  className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    isSidebarPinned ? 'bg-pink-500 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                  }`}
                >
                  <span>{isSidebarPinned ? '📌 已固定' : '🔓 自动收缩'}</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsSidebarPinned(true)}
                title="点击展开并固定侧边栏"
                className="mx-auto p-1.5 rounded-xl text-xs bg-gray-100 text-gray-500 hover:bg-pink-100 hover:text-pink-600 transition-colors shadow-sm"
              >
                📌
              </button>
            )}
          </div>

          {/* 1: AI Photo Editor */}
          <button
            onClick={() => setActiveTab('editor')}
            title="1. 智能修图与融合"
            className={`flex items-center gap-3 rounded-2xl font-bold text-sm transition-all text-left group ${
              isSidebarExpanded ? 'px-3.5 py-3 w-full' : 'p-2.5 justify-center w-11 h-11 mx-auto'
            } ${
              activeTab === 'editor'
                ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-500/30 scale-[1.02]'
                : 'bg-white/80 text-gray-700 hover:bg-white hover:text-pink-600 hover:shadow-md'
            }`}
          >
            <span className={`w-6 h-6 rounded-xl flex items-center justify-center font-extrabold text-xs shrink-0 transition-transform group-hover:scale-110 ${
              activeTab === 'editor' ? 'bg-white/20 text-white' : 'bg-pink-100 text-pink-600'
            }`}>1</span>
            {isSidebarExpanded && (
              <div className="flex flex-col min-w-0">
                <span className="leading-snug truncate">智能修图与融合</span>
                <span className={`text-[10px] font-normal mt-0.5 truncate ${activeTab === 'editor' ? 'text-pink-100' : 'text-gray-400'}`}>AI重绘 · 光影对齐</span>
              </div>
            )}
          </button>

          {/* 2: FBA Generator */}
          <button
            onClick={() => setActiveTab('fba')}
            title="2. FBA 场景作图"
            className={`flex items-center gap-3 rounded-2xl font-bold text-sm transition-all text-left group ${
              isSidebarExpanded ? 'px-3.5 py-3 w-full' : 'p-2.5 justify-center w-11 h-11 mx-auto'
            } ${
              activeTab === 'fba'
                ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30 scale-[1.02]'
                : 'bg-white/80 text-gray-700 hover:bg-white hover:text-blue-600 hover:shadow-md'
            }`}
          >
            <span className={`w-6 h-6 rounded-xl flex items-center justify-center font-extrabold text-xs shrink-0 transition-transform group-hover:scale-110 ${
              activeTab === 'fba' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-600'
            }`}>2</span>
            {isSidebarExpanded && (
              <div className="flex flex-col min-w-0">
                <span className="leading-snug truncate">FBA 场景作图</span>
                <span className={`text-[10px] font-normal mt-0.5 truncate ${activeTab === 'fba' ? 'text-blue-100' : 'text-gray-400'}`}>亚马逊 · 营销出图</span>
              </div>
            )}
          </button>

          {/* 3: 套图生成 */}
          <button
            onClick={() => setActiveTab('taotu')}
            title="3. 电商 AI 套图"
            className={`flex items-center gap-3 rounded-2xl font-bold text-sm transition-all text-left group ${
              isSidebarExpanded ? 'px-3.5 py-3 w-full' : 'p-2.5 justify-center w-11 h-11 mx-auto'
            } ${
              activeTab === 'taotu'
                ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-500/30 scale-[1.02]'
                : 'bg-white/80 text-gray-700 hover:bg-white hover:text-purple-600 hover:shadow-md'
            }`}
          >
            <span className={`w-6 h-6 rounded-xl flex items-center justify-center font-extrabold text-xs shrink-0 transition-transform group-hover:scale-110 ${
              activeTab === 'taotu' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-600'
            }`}>3</span>
            {isSidebarExpanded && (
              <div className="flex flex-col min-w-0">
                <span className="leading-snug truncate">电商 AI 套图</span>
                <span className={`text-[10px] font-normal mt-0.5 truncate ${activeTab === 'taotu' ? 'text-purple-100' : 'text-gray-400'}`}>9图理念 · 矩阵策划</span>
              </div>
            )}
          </button>

          {/* 4: 主图生成 */}
          <button
            onClick={() => setActiveTab('zhutu')}
            title="4. 电商 AI 主图"
            className={`flex items-center gap-3 rounded-2xl font-bold text-sm transition-all text-left group ${
              isSidebarExpanded ? 'px-3.5 py-3 w-full' : 'p-2.5 justify-center w-11 h-11 mx-auto'
            } ${
              activeTab === 'zhutu'
                ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/30 scale-[1.02]'
                : 'bg-white/80 text-gray-700 hover:bg-white hover:text-amber-600 hover:shadow-md'
            }`}
          >
            <span className={`w-6 h-6 rounded-xl flex items-center justify-center font-extrabold text-xs shrink-0 transition-transform group-hover:scale-110 ${
              activeTab === 'zhutu' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-600'
            }`}>4</span>
            {isSidebarExpanded && (
              <div className="flex flex-col min-w-0">
                <span className="leading-snug truncate">电商 AI 主图</span>
                <span className={`text-[10px] font-normal mt-0.5 truncate ${activeTab === 'zhutu' ? 'text-amber-100' : 'text-gray-400'}`}>核心视点 · 高频点击</span>
              </div>
            )}
          </button>

          {/* 5: 场景图生成 */}
          <button
            onClick={() => setActiveTab('changjing')}
            title="5. 电商 AI 场景图"
            className={`flex items-center gap-3 rounded-2xl font-bold text-sm transition-all text-left group ${
              isSidebarExpanded ? 'px-3.5 py-3 w-full' : 'p-2.5 justify-center w-11 h-11 mx-auto'
            } ${
              activeTab === 'changjing'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30 scale-[1.02]'
                : 'bg-white/80 text-gray-700 hover:bg-white hover:text-emerald-600 hover:shadow-md'
            }`}
          >
            <span className={`w-6 h-6 rounded-xl flex items-center justify-center font-extrabold text-xs shrink-0 transition-transform group-hover:scale-110 ${
              activeTab === 'changjing' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-600'
            }`}>5</span>
            {isSidebarExpanded && (
              <div className="flex flex-col min-w-0">
                <span className="leading-snug truncate">电商 AI 场景图</span>
                <span className={`text-[10px] font-normal mt-0.5 truncate ${activeTab === 'changjing' ? 'text-emerald-100' : 'text-gray-400'}`}>本土美学 · 氛围渲染</span>
              </div>
            )}
          </button>
        </aside>

        {/* Right Side Main Content Area */}
        <div className="flex-1 min-w-0 w-full flex flex-col min-h-0 overflow-hidden">
          {activeTab === 'editor' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 lg:h-[calc(100vh-110px)] lg:max-h-[calc(100vh-110px)] min-h-0 overflow-hidden">
              {/* Column 1: Image Uploads */}
              <div className="lg:col-span-3 bg-white/80 rounded-2xl p-4 shadow-lg border border-pink-200 flex flex-col gap-3 h-full min-h-0 overflow-hidden">
                <h2 className="text-xl font-bold text-pink-600 shrink-0">1. 上传图片</h2>
                <div className="flex flex-col gap-1.5 flex-1 min-h-0 overflow-hidden">
                  <h3 className="text-base font-semibold text-gray-700 shrink-0">主要产品 / 主体 <span className="text-xs font-normal text-pink-600 ml-1">(产品主图)</span></h3>
                  <p className="text-xs text-gray-500 -mt-1 mb-1 shrink-0">您需要保留和编辑的核心产品或主体。</p>
                  <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                    <ImageUpload 
                      multiple={true}
                      onImageUpload={handleImageUpload}
                      onImagesUpload={handleImagesUpload}
                      onImageRemove={handleImageRemove}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 flex-1 min-h-0 overflow-hidden">
                  <div className="flex items-center gap-2 shrink-0">
                    <LayersIcon />
                    <h3 className="text-base font-semibold text-gray-700">参考图片 <span className="text-xs font-normal text-pink-600 ml-1">(场景/期望效果图)</span></h3>
                  </div>
                  <p className="text-xs text-gray-500 -mt-1 mb-1 shrink-0">选填：上传参考背景场景、风格或目标构图。</p>
                  <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                    <ImageUpload onImageUpload={handleSecondaryImageUpload} onImageRemove={handleSecondaryImageRemove} />
                  </div>
                  <div className="mt-2 p-2.5 bg-pink-100/40 rounded-lg border border-pink-200 animate-fadeIn shrink-0">
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="merge-mode" className="block text-xs font-bold text-pink-800">Fusion Mode (修图与融合模式):</label>
                      {!secondaryImage && (
                        <span className="text-[10px] text-pink-600 bg-pink-100 px-2 py-0.5 rounded-full font-bold">传参考图解锁双图融合</span>
                      )}
                    </div>
                    <select
                      id="merge-mode"
                      name="merge-mode"
                      value={mergeMode}
                      onChange={handleMergeModeChange}
                      className="block w-full p-2 bg-white border-2 border-pink-300 rounded-lg text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-400"
                    >
                      <option value="custom">Custom（原生 API · 不加隐藏提示词）</option>
                      <option value="remove_watermark">Remove Watermark (去除右下角水印或AI图标)</option>
                      <option value="replace_background" disabled={!secondaryImage}>
                        Background Fusion (场景融合·主图融进参考图背景{secondaryImage ? '' : ' · 需参考图'})
                      </option>
                      <option value="combine" disabled={!secondaryImage}>
                        Style & Lighting Reference (风格光影参考{secondaryImage ? '' : ' · 需参考图'})
                      </option>
                      <option value="replace_product" disabled={!secondaryImage}>
                        Replace Product (主体调换·替换参考图产品{secondaryImage ? '' : ' · 需参考图'})
                      </option>
                      <option value="add_logo" disabled={!secondaryImage}>
                        Add Logo / Watermark (叠加标志或水印{secondaryImage ? '' : ' · 需参考图'})
                      </option>
                      <option value="replace_person" disabled={!secondaryImage}>
                        Replace Person (人物模特调换·面部与姿态融合{secondaryImage ? '' : ' · 需参考图'})
                      </option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Column 2: Prompt */}
              <div className="lg:col-span-3 bg-white/80 rounded-2xl p-4 shadow-lg border border-pink-200 flex flex-col gap-3 h-full min-h-0 overflow-hidden">
                <h2 className="text-xl font-bold text-pink-600 shrink-0">2. 描述修图指令</h2>
                <div className="flex-1 flex flex-col min-h-0">
                  <PromptInput value={prompt} onChange={handlePromptChange} />
                  {mergeMode === 'custom' && (
                    <div className="mt-2 shrink-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleExpandPrompt}
                          disabled={isExpandingPrompt || isLoading || !prompt.trim()}
                          className="px-3 py-1.5 rounded-lg border border-pink-300 bg-pink-50 text-pink-700 text-xs font-bold hover:bg-pink-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isExpandingPrompt ? '正在优化…' : '✨ AI 优化提示词'}
                        </button>
                        {promptBeforeExpansion !== null && (
                          <button
                            type="button"
                            onClick={handleRestorePrompt}
                            disabled={isExpandingPrompt || isLoading}
                            className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-600 text-xs font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            恢复原文
                          </button>
                        )}
                        <span className="text-[11px] text-gray-400">
                          只细化你明确提出的要求，不改变作用对象，结果可见、可修改
                        </span>
                      </div>
                      {promptExpansionMessage && (
                        <p className="mt-1.5 text-[11px] text-emerald-700">
                          {promptExpansionMessage}
                        </p>
                      )}
                      {promptExpansionError && (
                        <p className="mt-1.5 text-[11px] text-red-500">
                          {promptExpansionError}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div className="shrink-0">
                  <label htmlFor="aspect-ratio" className="block text-sm font-medium text-gray-700 mb-1">图片宽高比</label>
                  <select
                    id="aspect-ratio"
                    name="aspect-ratio"
                    value={aspectRatio}
                    onChange={handleAspectRatioChange}
                    className="block w-full p-2 bg-white border-2 border-pink-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
                  >
                    <option value="auto">保持原始比例</option>
                    <option value="prompt">智能自动 (根据提示词)</option>
                    <option value="1:1">正方形 (1:1)</option>
                    <option value="3:4">竖屏人像 (3:4)</option>
                    <option value="4:3">横屏风景 (4:3)</option>
                    <option value="3:2">横屏风景 (3:2)</option>
                    <option value="4:5">社交平台竖屏 (4:5)</option>
                    <option value="16:9">宽屏显示 (16:9)</option>
                    <option value="9:16">全屏手机竖屏 (9:16)</option>
                  </select>
                  {aspectRatioWarning && (
                    <p className="text-amber-800 bg-amber-100 border-l-4 border-amber-500 rounded p-3 text-xs mt-3">
                      {aspectRatioWarning}
                    </p>
                  )}
                  {aspectRatio !== 'auto' && mergeMode !== 'custom' && (
                    <div className="mt-3 p-3 bg-pink-100/50 rounded-lg border border-pink-200">
                        <label htmlFor="high-fidelity-preserve" className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                id="high-fidelity-preserve"
                                checked={highFidelityPreserve}
                                onChange={(e) => setHighFidelityPreserve(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-pink-600 focus:ring-pink-500"
                            />
                            <span className="text-sm font-medium text-pink-800">高保真保留产品</span>
                        </label>
                        <p className="text-xs text-pink-700/80 mt-1 pl-6">
                            采用多步骤流程以更好地保留产品细节。
                        </p>
                    </div>
                  )}
                </div>
                <button
                  onClick={handleGenerateClick}
                  disabled={!canGenerate}
                  className="shrink-0 flex items-center justify-center gap-2 w-full px-6 py-3.5 font-bold text-white rounded-xl transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 shadow-md shadow-pink-500/20 disabled:shadow-none focus:outline-none focus:ring-4 focus:ring-pink-400 focus:ring-opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader className="text-white" />
                      <span>正在修图中...</span>
                    </>
                  ) : (
                    <>
                      <WandSparklesIcon />
                      <span className="text-base">生成修图结果</span>
                    </>
                  )}
                </button>
                {error && <p className="text-red-500 text-xs mt-1 text-center shrink-0">{error}</p>}
              </div>

              {/* Column 3: Image Display */}
              <div className="lg:col-span-6 bg-white/80 rounded-2xl p-4 shadow-lg border border-pink-200 flex flex-col gap-3 h-full min-h-0 overflow-hidden">
                <div className="flex justify-between items-center shrink-0">
                  <h2 className="text-xl font-bold text-pink-600">3. 修图结果展示</h2>
                  {editedImage && !isLoading && (
                    <button
                      onClick={handleDownloadClick}
                      className="flex items-center justify-center gap-2 px-4 py-2 font-bold text-pink-600 rounded-lg transition-all duration-300 ease-in-out border-2 border-pink-500 bg-white hover:bg-pink-50 focus:outline-none focus:ring-4 focus:ring-pink-400 focus:ring-opacity-50"
                    >
                      <DownloadIcon />
                      <span>下载原图</span>
                    </button>
                  )}
                </div>
                <div className="flex-1 min-h-0 flex flex-col">
                  <ImageDisplay imageUrl={editedImage} isLoading={isLoading} />
                </div>
              </div>
            </div>
          ) : activeTab === 'fba' ? (
            <div className="bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl border border-blue-200 overflow-hidden w-full h-[calc(100vh-100px)] min-h-[920px] relative animate-fadeIn flex-1">
              <iframe id="fba-frame" src="/fba.html" className="w-full h-full border-0" title="FBA场景图生成" />
            </div>
          ) : activeTab === 'taotu' ? (
            <div className="bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl border border-purple-200 overflow-hidden w-full h-[calc(100vh-100px)] min-h-[920px] relative animate-fadeIn flex-1">
              <iframe id="taotu-frame" src="/taotu.html" className="w-full h-full border-0" title="电商AI套图生成" />
            </div>
          ) : activeTab === 'zhutu' ? (
            <div className="bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl border border-amber-200 overflow-hidden w-full h-[calc(100vh-100px)] min-h-[920px] relative animate-fadeIn flex-1">
              <iframe id="zhutu-frame" src="/zhutu.html" className="w-full h-full border-0" title="电商AI主图生成" />
            </div>
          ) : (
            <div className="bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl border border-emerald-200 overflow-hidden w-full h-[calc(100vh-100px)] min-h-[920px] relative animate-fadeIn flex-1">
              <iframe id="changjing-frame" src="/changjing.html" className="w-full h-full border-0" title="电商AI场景图生成" />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
