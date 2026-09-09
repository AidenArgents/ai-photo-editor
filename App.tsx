import React, { useState } from 'react';
import Header from './components/Header';
import ApiEditorPage from './components/editor/ApiEditorPage';
import WebEditorPage from './components/editor/WebEditorPage';

const EDITOR_MODEL_IDS = [
  'gemini-2.5-flash-image',
  'gemini-3.1-flash-image',
  'gemini-3.1-flash-lite-image',
  'gemini-3-pro-image',
  'gpt-image-2:auto',
  'gpt-image-2:low',
  'gpt-image-2:medium',
  'gpt-image-2:high',
] as const;

const DEFAULT_EDITOR_MODEL = 'gemini-2.5-flash-image';

type AppMode = 'web' | 'api';
type WebProvider = 'gemini' | 'chatgpt';

export default function App(): React.JSX.Element {
  const [appMode, setAppMode] = useState<AppMode>(
    () => localStorage.getItem('ai_photo_editor_mode') === 'api' ? 'api' : 'web'
  );
  const [webProvider, setWebProvider] = useState<WebProvider>(
    () => localStorage.getItem('ai_photo_editor_web_provider') === 'chatgpt' ? 'chatgpt' : 'gemini'
  );
  const [activeTab, setActiveTab] = useState<'editor' | 'fba' | 'taotu' | 'zhutu' | 'changjing'>('editor');
  const [isSidebarPinned, setIsSidebarPinned] = useState<boolean>(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState<boolean>(false);
  const isSidebarExpanded = isSidebarPinned || isSidebarHovered;

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
  const [openAiApiKey, setOpenAiApiKey] = useState<string>(
    () => localStorage.getItem('openai_custom_api_key') || ''
  );

  const handleAppModeChange = (mode: AppMode) => {
    setAppMode(mode);
    localStorage.setItem('ai_photo_editor_mode', mode);
  };

  const handleWebProviderChange = (provider: WebProvider) => {
    setWebProvider(provider);
    localStorage.setItem('ai_photo_editor_web_provider', provider);
  };

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

  const handleOpenAiApiKeyChange = (key: string) => {
    setOpenAiApiKey(key);
    if (key) {
      localStorage.setItem('openai_custom_api_key', key);
    } else {
      localStorage.removeItem('openai_custom_api_key');
    }
  };

  return (
    <div className="min-h-screen bg-pink-50 text-gray-800 font-sans">
      <Header
        appMode={appMode}
        onAppModeChange={handleAppModeChange}
        webProvider={webProvider}
        onWebProviderChange={handleWebProviderChange}
        selectedModel={selectedModel}
        onModelChange={handleModelChange}
        customApiKey={customApiKey}
        onApiKeyChange={handleApiKeyChange}
        openAiApiKey={openAiApiKey}
        onOpenAiApiKeyChange={handleOpenAiApiKeyChange}
        showModelSelector={activeTab === 'editor'}
        showOpenAiKeyField={appMode === 'api' && activeTab !== 'editor'}
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
          <div className={activeTab === 'editor' ? 'contents' : 'hidden'}>
            {appMode === 'web' ? (
              <React.Fragment key={`web-${webProvider}`}>
                <WebEditorPage
                  webProvider={webProvider}
                  customApiKey={customApiKey}
                />
              </React.Fragment>
            ) : (
              <ApiEditorPage
                selectedModel={selectedModel}
                customApiKey={customApiKey}
                openAiApiKey={openAiApiKey}
              />
            )}
          </div>
          {activeTab !== 'editor' && (activeTab === 'fba' ? (
            <div className="bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl border border-blue-200 overflow-hidden w-full h-[calc(100vh-100px)] min-h-[920px] relative animate-fadeIn flex-1">
              <iframe key={`${appMode}-fba`} id="fba-frame" src={appMode === 'web' ? '/web/fba.html' : '/fba.html'} className="w-full h-full border-0" title="FBA场景图生成" />
            </div>
          ) : activeTab === 'taotu' ? (
            <div className="bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl border border-purple-200 overflow-hidden w-full h-[calc(100vh-100px)] min-h-[920px] relative animate-fadeIn flex-1">
              <iframe key={`${appMode}-taotu`} id="taotu-frame" src={appMode === 'web' ? '/web/taotu.html' : '/taotu.html'} className="w-full h-full border-0" title="电商AI套图生成" />
            </div>
          ) : activeTab === 'zhutu' ? (
            <div className="bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl border border-amber-200 overflow-hidden w-full h-[calc(100vh-100px)] min-h-[920px] relative animate-fadeIn flex-1">
              <iframe key={`${appMode}-zhutu`} id="zhutu-frame" src={appMode === 'web' ? '/web/zhutu.html' : '/zhutu.html'} className="w-full h-full border-0" title="电商AI主图生成" />
            </div>
          ) : (
            <div className="bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl border border-emerald-200 overflow-hidden w-full h-[calc(100vh-100px)] min-h-[920px] relative animate-fadeIn flex-1">
              <iframe key={`${appMode}-changjing`} id="changjing-frame" src={appMode === 'web' ? '/web/changjing.html' : '/changjing.html'} className="w-full h-full border-0" title="电商AI场景图生成" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
