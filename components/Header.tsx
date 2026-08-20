
import React from 'react';
import { CameraIcon } from './Icons';

interface HeaderProps {
  selectedModel: string;
  onModelChange: (model: string) => void;
  customApiKey: string;
  onApiKeyChange: (key: string) => void;
  openAiApiKey: string;
  onOpenAiApiKeyChange: (key: string) => void;
  showModelSelector?: boolean;
  showOpenAiKeyField?: boolean;
}

const Header = ({
  selectedModel,
  onModelChange,
  customApiKey,
  onApiKeyChange,
  openAiApiKey,
  onOpenAiApiKeyChange,
  showModelSelector = true,
  showOpenAiKeyField = false,
}: HeaderProps): React.JSX.Element => {
  const isOpenAiModel = selectedModel.startsWith('gpt-image-2:');
  const shouldShowOpenAiKey = isOpenAiModel || showOpenAiKeyField;
  const [showGeminiKey, setShowGeminiKey] = React.useState(false);
  const [showOpenAiKey, setShowOpenAiKey] = React.useState(false);

  return (
    <header className="bg-white/80 backdrop-blur-sm border-b border-pink-200 sticky top-0 z-10">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`flex items-center justify-between gap-4 ${shouldShowOpenAiKey ? 'py-2' : 'h-14 sm:h-16'}`}>
          {/* Left Side: Logo & Model Selector */}
          <div className="flex items-center gap-3 min-w-0">
            <CameraIcon />
            <h1 className="text-base sm:text-xl font-bold text-gray-800 tracking-tight flex items-center flex-wrap gap-y-1">
              <span className="whitespace-nowrap">AI Photo Editor</span>
              {showModelSelector && (
                <div className="flex items-center ml-1 sm:ml-2">
                  <span className="text-xs sm:text-sm font-light text-pink-500">with</span>
                  <select
                    value={selectedModel}
                    onChange={(e) => onModelChange(e.target.value)}
                    className="text-xs sm:text-sm font-semibold text-pink-600 bg-pink-50 border border-pink-200 rounded-md px-1.5 sm:px-2 py-0.5 ml-1 focus:outline-none focus:ring-1 focus:ring-pink-400 cursor-pointer"
                  >
                    <option value="gemini-2.5-flash-image">Nano Banana · 最高1K $0.039/¥0.28（2026-10-02停用）</option>
					<option value="gemini-3.1-flash-image">Nano Banana 2 · 1K $0.067/¥0.48（推荐·最高支持4K）</option>
					<option value="gemini-3.1-flash-lite-image">Nano Banana 2 Lite · 1K $0.0336/¥0.24（快速省钱）</option>
					<option value="gemini-3-pro-image">Nano Banana Pro · 1K/2K $0.134/¥0.96 · 4K $0.24/¥1.73</option>
                    <option value="gpt-image-2:auto">GPT Image 2 自动（OpenAI·模型判断质量）</option>
                    <option value="gpt-image-2:low">GPT Image 2 低 · $0.005–0.006/¥0.04（快速省钱）</option>
                    <option value="gpt-image-2:medium">GPT Image 2 中 · $0.041–0.053/¥0.30–0.38（推荐）</option>
                    <option value="gpt-image-2:high">GPT Image 2 高 · $0.165–0.211/¥1.19–1.52（高质量）</option>
                  </select>
                </div>
              )}
              <span className="text-[10px] sm:text-xs font-bold text-gray-400 ml-2 hidden lg:inline">Powered by Aiden_Argents</span>
            </h1>
          </div>

          {/* Right Side: API Keys */}
          <div className={`flex flex-shrink-0 ${shouldShowOpenAiKey ? 'flex-col gap-1 items-end' : 'items-center gap-2'}`}>
            {/* Gemini API Key row */}
            <div className="flex items-center gap-2">
              <div className="relative flex items-center">
                <span className="text-xs text-gray-500 font-medium mr-2 hidden sm:inline">🔑 Gemini API Key:</span>
                <input
                  type={showGeminiKey ? 'text' : 'password'}
                  placeholder="粘贴 Gemini API Key..."
                  value={customApiKey}
                  onChange={(e) => onApiKeyChange(e.target.value)}
                  className="text-xs border border-pink-200 rounded px-2 py-1 pr-7 bg-white/50 focus:bg-white focus:outline-none focus:border-pink-500 w-28 sm:w-44 placeholder-gray-400 transition-colors"
                />
                <button
                  onClick={() => setShowGeminiKey(!showGeminiKey)}
                  className="absolute right-2 text-[10px] text-gray-400 hover:text-gray-600 focus:outline-none"
                  title={showGeminiKey ? '隐藏' : '显示'}
                >
                  {showGeminiKey ? '🙈' : '👁'}
                </button>
              </div>
              {customApiKey ? (
                <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded font-mono font-bold border border-green-200">
                  自定义
                </span>
              ) : (
                <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded font-mono border border-gray-100">
                  默认
                </span>
              )}
            </div>
            {/* OpenAI API Key row - shown for GPT on page 1 and for all workflow pages */}
            {shouldShowOpenAiKey && (
              <div className="flex items-center gap-2">
                <div className="relative flex items-center">
                  <span className="text-xs text-gray-500 font-medium mr-2 hidden sm:inline">🔑 OpenAI API Key:</span>
                  <input
                    type={showOpenAiKey ? 'text' : 'password'}
                    placeholder="粘贴 OpenAI API Key..."
                    value={openAiApiKey}
                    onChange={(e) => onOpenAiApiKeyChange(e.target.value)}
                    className="text-xs border border-pink-200 rounded px-2 py-1 pr-7 bg-white/50 focus:bg-white focus:outline-none focus:border-pink-500 w-28 sm:w-44 placeholder-gray-400 transition-colors"
                  />
                  <button
                    onClick={() => setShowOpenAiKey(!showOpenAiKey)}
                    className="absolute right-2 text-[10px] text-gray-400 hover:text-gray-600 focus:outline-none"
                    title={showOpenAiKey ? '隐藏' : '显示'}
                  >
                    {showOpenAiKey ? '🙈' : '👁'}
                  </button>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono border ${
                  openAiApiKey
                    ? 'text-green-600 bg-green-50 font-bold border-green-200'
                    : 'text-amber-600 bg-amber-50 border-amber-200'
                }`}>
                  {openAiApiKey ? '已填写' : '待填写'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
