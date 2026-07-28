
import React from 'react';
import { CameraIcon } from './Icons';

interface HeaderProps {
  selectedModel: string;
  onModelChange: (model: string) => void;
  customApiKey: string;
  onApiKeyChange: (key: string) => void;
  showModelSelector?: boolean;
}

const Header = ({
  selectedModel,
  onModelChange,
  customApiKey,
  onApiKeyChange,
  showModelSelector = true,
}: HeaderProps): React.JSX.Element => {
  return (
    <header className="bg-white/80 backdrop-blur-sm border-b border-pink-200 sticky top-0 z-10">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-4">
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
                  </select>
                </div>
              )}
              <span className="text-[10px] sm:text-xs font-bold text-gray-400 ml-2 hidden lg:inline">Powered by Aiden_Argents</span>
            </h1>
          </div>

          {/* Right Side: Custom API Key */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="relative flex items-center">
              <span className="text-xs text-gray-500 font-medium mr-2 hidden sm:inline">🔑 Gemini API Key:</span>
              <input
                type="password"
                placeholder="粘贴您的自定义 API Key..."
                value={customApiKey}
                onChange={(e) => onApiKeyChange(e.target.value)}
                className="text-xs border border-pink-200 rounded px-2 py-1 bg-white/50 focus:bg-white focus:outline-none focus:border-pink-500 w-28 sm:w-44 placeholder-gray-400 transition-colors"
              />
              {customApiKey && (
                <button
                  onClick={() => onApiKeyChange('')}
                  className="absolute right-2 text-[10px] text-gray-400 hover:text-gray-600 focus:outline-none"
                  title="清除 API Key"
                >
                  ✕
                </button>
              )}
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
        </div>
      </div>
    </header>
  );
};

export default Header;
