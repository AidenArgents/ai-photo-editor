import React, { useState, useCallback } from 'react';
import { editImage } from './services/geminiService';
import type { ImageFile } from './types';
import Header from './components/Header';
import ImageUpload from './components/ImageUpload';
import PromptInput from './components/PromptInput';
import ImageDisplay from './components/ImageDisplay';
import Loader from './components/Loader';
import { WandSparklesIcon, DownloadIcon, LayersIcon } from './components/Icons';

const PROMPT_TEMPLATES: Record<string, string> = {
  replace_background: `Use the Secondary Image as the target scene/background blueprint and seamlessly blend the product from the Main Image into it.

# Instructions for AI
- Keep the main product from the First Image 100% intact with absolute pixel fidelity.
- Use the Second Image as the reference for background atmosphere, lighting, and composition.
- Render realistic physical contact shadows and ambient reflections under and around the product to ensure silky-smooth fusion.

# My Request
[Describe placement or specific scene adjustments here, e.g., "Place the product on the center marble table, basking in warm afternoon sunlight."]`,
  combine: `Creatively combine the lighting atmosphere and style of the Secondary Image with the product from the Main Image.

# Instructions for AI
- Use the Second Image as a visual blueprint for lighting, mood, and aesthetic tone.
- Preserve the product subject from the First Image accurately while harmonizing its environmental relighting.

# My Request
[Describe artistic vision here, e.g., "Harmonize the product with the dreamy sunset tones of the reference image."]`,
  replace_product: `Replace the main product in the Reference Scene (Second Image) with my product from the First Image.

# Instructions for AI
- The Second Image is the background scene blueprint.
- Replace its original product with the authentic product subject from the First Image.
- Ensure shadows and lighting match the scene perfectly.

# My Request
[Describe any positioning specifics here, e.g., "Make sure the old product is completely removed and my product sits in its place naturally."]`,
  add_logo: `Overlay the logo/watermark from the Second Image onto the Main Image.
  
# Instructions for AI
- Maintain logo transparency and clean edges.
- Superimpose naturally onto the main photo.

# My Request
[Describe logo placement and sizing here, e.g., "Place the logo neatly in the top right corner with subtle opacity."]`,
  replace_person: `Replace the person in the First Image with the person from the Second Image. 

# Instructions for AI
- Match facial features, lighting, skin tone reflections, and perspective precisely.

# My Request
[Describe specifics here, e.g., "Keep the original pose and outfit intact, only swap the person's identity and blend the neck/shadows smoothly."]`
};

export default function App(): React.JSX.Element {
  const [originalImage, setOriginalImage] = useState<ImageFile | null>(null);
  const [secondaryImage, setSecondaryImage] = useState<ImageFile | null>(null);
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [mergeMode, setMergeMode] = useState<string>('combine');
  const [aspectRatio, setAspectRatio] = useState<string>('auto');
  const [aspectRatioWarning, setAspectRatioWarning] = useState<string | null>(null);
  const [highFidelityPreserve, setHighFidelityPreserve] = useState<boolean>(false);

  const [selectedModel, setSelectedModel] = useState<string>(
    () => localStorage.getItem('gemini_selected_model') || 'gemini-3.1-flash-lite-image'
  );
  const [customApiKey, setCustomApiKey] = useState<string>(
    () => localStorage.getItem('gemini_custom_api_key') || ''
  );

  const handleModelChange = (model: string) => {
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
    setOriginalImage({
      file: file,
      url: URL.createObjectURL(file),
    });
    setEditedImage(null);
    setError(null);
  };

  const handleImageRemove = () => {
    setOriginalImage(null);
  };

  const handleSecondaryImageUpload = (file: File) => {
    setSecondaryImage({
      file: file,
      url: URL.createObjectURL(file),
    });
    // Pre-fill prompt if user hasn't typed anything for the new mode
    if (prompt.trim() === '') {
       setPrompt(PROMPT_TEMPLATES[mergeMode]);
    }
  };

  const handleSecondaryImageRemove = () => {
    setSecondaryImage(null);
    setMergeMode('combine');
    setPrompt('');
  };

  const handleMergeModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMode = e.target.value;
    setMergeMode(newMode);
    setPrompt(PROMPT_TEMPLATES[newMode] || '');
  };

  const handleAspectRatioChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newAspectRatio = e.target.value;
    setAspectRatio(newAspectRatio);
    
    if (newAspectRatio !== 'auto') {
      setHighFidelityPreserve(true); // Default to checked for new ratios
      setAspectRatioWarning("注意：更改宽高比会重新生成图像。为保证产品图不失真，推荐使用“高保真保留产品”模式。");
    } else {
      setHighFidelityPreserve(false); // Crucially, reset to false for 'auto'
      setAspectRatioWarning(null); // And clear the warning
    }
  };

  const handleGenerateClick = useCallback(async () => {
    if (!originalImage || !prompt) {
      setError('Please upload a main image and provide an editing prompt.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setEditedImage(null);

    try {
      const result = await editImage(
        originalImage.file,
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
  }, [originalImage, secondaryImage, prompt, aspectRatio, highFidelityPreserve, selectedModel, customApiKey, mergeMode]);

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

  const canGenerate = originalImage !== null && prompt.trim().length > 0 && !isLoading;

  return (
    <div className="min-h-screen bg-pink-50 text-gray-800 font-sans">
      <Header
        selectedModel={selectedModel}
        onModelChange={handleModelChange}
        customApiKey={customApiKey}
        onApiKeyChange={handleApiKeyChange}
      />
      <main className="container mx-auto p-4 md:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Column 1: Image Uploads */}
          <div className="lg:col-span-3 bg-white/80 rounded-2xl p-4 shadow-lg border border-pink-200 flex flex-col gap-3">
            <h2 className="text-xl font-bold text-pink-600">1. Upload Images</h2>
            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-semibold text-gray-700">Main Product / Subject <span className="text-xs font-normal text-pink-600 ml-1">(产品主图)</span></h3>
              <p className="text-xs text-gray-500 -mt-1 mb-1">Your core product or subject to be preserved and edited.</p>
              <ImageUpload onImageUpload={handleImageUpload} onImageRemove={handleImageRemove} />
            </div>
            <div className="flex flex-col gap-2 mt-2">
              <div className="flex items-center gap-2">
                <LayersIcon />
                <h3 className="text-lg font-semibold text-gray-700">Reference Blueprint <span className="text-xs font-normal text-pink-600 ml-1">(场景/期望效果图)</span></h3>
              </div>
              <p className="text-xs text-gray-500 -mt-1 mb-1">Optional: Upload a reference background scene, style, or target composition.</p>
              <ImageUpload onImageUpload={handleSecondaryImageUpload} onImageRemove={handleSecondaryImageRemove} />
              {secondaryImage && (
                <div className="mt-3 p-3 bg-pink-100/40 rounded-lg border border-pink-200">
                  <label htmlFor="merge-mode" className="block text-sm font-bold text-pink-800 mb-1">Fusion Mode (合成与重绘目标):</label>
                  <select
                    id="merge-mode"
                    name="merge-mode"
                    value={mergeMode}
                    onChange={handleMergeModeChange}
                    className="block w-full p-2 bg-white border-2 border-pink-300 rounded-lg text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-400"
                  >
                    <option value="replace_background">Background Fusion (场景融合·将主产品自然融进参考场景)</option>
                    <option value="combine">Style & Lighting Reference (风格光影参考·构图与氛围渲染)</option>
                    <option value="replace_product">Replace Product (主体调换·用主图替换参考图中的产品)</option>
                    <option value="add_logo">Add Logo / Watermark (叠加标志·添加水印或品牌LOGO)</option>
                    <option value="replace_person">Replace Person (人物模特调换·面部与姿态融合)</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Column 2: Prompt */}
          <div className="lg:col-span-3 bg-white/80 rounded-2xl p-6 shadow-lg border border-pink-200 flex flex-col gap-4">
            <h2 className="text-xl font-bold text-pink-600">2. Describe Your Edit</h2>
            <PromptInput value={prompt} onChange={(e) => setPrompt(e.target.value)} />
            <div>
              <label htmlFor="aspect-ratio" className="block text-sm font-medium text-gray-700 mb-1">Aspect Ratio</label>
              <select
                id="aspect-ratio"
                name="aspect-ratio"
                value={aspectRatio}
                onChange={handleAspectRatioChange}
                className="block w-full p-2 bg-white border-2 border-pink-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
              >
                <option value="auto">Keep Original</option>
                <option value="prompt">Auto (from prompt)</option>
                <option value="1:1">Square (1:1)</option>
                <option value="3:4">Portrait (3:4)</option>
                <option value="4:3">Landscape (4:3)</option>
                <option value="3:2">Landscape (3:2)</option>
                <option value="4:5">Portrait (4:5)</option>
                <option value="16:9">Widescreen (16:9)</option>
                <option value="9:16">Tall (9:16)</option>
              </select>
              {aspectRatioWarning && (
                <p className="text-amber-800 bg-amber-100 border-l-4 border-amber-500 rounded p-3 text-xs mt-3">
                  {aspectRatioWarning}
                </p>
              )}
              {aspectRatio !== 'auto' && (
                <div className="mt-4 p-3 bg-pink-100/50 rounded-lg border border-pink-200">
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
                        采用先进的多步骤流程以更好地保留产品细节。可能需要更长时间。
                    </p>
                </div>
              )}
            </div>
            <button
              onClick={handleGenerateClick}
              disabled={!canGenerate}
              className="mt-auto flex items-center justify-center gap-2 w-full px-6 py-3 font-bold text-white rounded-lg transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed bg-pink-500 hover:bg-pink-600 disabled:bg-pink-300 focus:outline-none focus:ring-4 focus:ring-pink-400 focus:ring-opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader className="text-white" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <WandSparklesIcon />
                  <span>Generate Edit</span>
                </>
              )}
            </button>
            {error && <p className="text-red-500 text-sm mt-2 text-center">{error}</p>}
          </div>

          {/* Column 3: Image Display */}
          <div className="lg:col-span-6 bg-white/80 rounded-2xl p-6 shadow-lg border border-pink-200 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-pink-600">3. Your Edited Image</h2>
              {editedImage && !isLoading && (
                <button
                  onClick={handleDownloadClick}
                  className="flex items-center justify-center gap-2 px-4 py-2 font-bold text-pink-600 rounded-lg transition-all duration-300 ease-in-out border-2 border-pink-500 bg-white hover:bg-pink-50 focus:outline-none focus:ring-4 focus:ring-pink-400 focus:ring-opacity-50"
                >
                  <DownloadIcon />
                  <span>Download</span>
                </button>
              )}
            </div>
            <ImageDisplay imageUrl={editedImage} isLoading={isLoading} />
          </div>
        </div>
      </main>
    </div>
  );
}