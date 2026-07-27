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
  combine: `Creatively combine the elements and styles of the first and second images. 

# My Request
[Describe any additional changes here, e.g., "Combine these two images creatively. Surprise me with the composition."]`,
  replace_person: `Replace the person in the first image with the person from the second image. 

# Instructions for AI
- The first image is the scene.
- The second image contains the new person.
- Extract the person from the second image.
- Remove the original person from the first image.
- Place the new person into the scene, matching lighting, shadows, and perspective.
- Then, apply my specific request below.

# My Request
[Describe any additional changes here, e.g., "dont't change other things."]`,
  add_logo: `Add the second image as a logo or watermark onto the first image.
  
# Instructions for AI
- The first image is the main picture.
- The second image is the logo.
- Preserve the transparency of the logo.
- Then, apply my specific request below.

# My Request
[Describe placement, size, or other effects here, e.g., "Overlay this second image logo onto first image. Their sizes have already been adjusted, so they can be directly superimposed."]`,
  replace_background: `Use the second image as a new background for the main subject in the first image.

# Instructions for AI
- The first image contains the main subject.
- The second image is the new background.
- Extract the subject and place it on the new background realistically.
- Then, apply my specific request below.

# My Request
[Describe any additional changes here, e.g., "Seamlessly blend the main product from the first image into the second image, ensuring a natural and harmonious integration of both elements."]`,
  replace_product: `Replace the main product in the first image with the product from the second image.

# Instructions for AI
- The first image is the scene.
- The second image contains the new product.
- Swap the products, maintaining the scene's lighting and style.
- Then, apply my specific request below.

# My Request
[Describe any additional changes here, e.g., "Make sure the first image products are totally gone."]`
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
        customApiKey
      );
      setEditedImage(result);
    } catch (e: unknown)      {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      setError(`Failed to edit image: ${errorMessage}`);
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [originalImage, secondaryImage, prompt, aspectRatio, highFidelityPreserve, selectedModel, customApiKey]);

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
              <h3 className="text-lg font-semibold text-gray-700">Main Image</h3>
              <ImageUpload onImageUpload={handleImageUpload} onImageRemove={handleImageRemove} />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <LayersIcon />
                <h3 className="text-lg font-semibold text-gray-700">Combine Images <span className="text-sm font-normal text-gray-500">(Optional)</span></h3>
              </div>
              <p className="text-xs text-gray-500 -mt-1">Upload a second image to merge, replace, or add elements.</p>
              <ImageUpload onImageUpload={handleSecondaryImageUpload} onImageRemove={handleSecondaryImageRemove} />
              {secondaryImage && (
                <div className="mt-2">
                  <label htmlFor="merge-mode" className="block text-sm font-medium text-gray-700 mb-1">How to combine:</label>
                  <select
                    id="merge-mode"
                    name="merge-mode"
                    value={mergeMode}
                    onChange={handleMergeModeChange}
                    className="block w-full p-2 bg-white border-2 border-pink-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
                  >
                    <option value="combine">Combine Styles & Elements</option>
                    <option value="replace_person">Replace Person</option>
                    <option value="add_logo">Add as Logo/Watermark</option>
                    <option value="replace_background">Use as Background</option>
                    <option value="replace_product">Replace Product</option>
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