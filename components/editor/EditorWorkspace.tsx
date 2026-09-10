import React, { useCallback, useEffect, useRef } from 'react';
import { editImage } from '../../services/geminiService';
import EditorPage from './EditorPage';
import type { EditorGenerateInput } from './types';

type AppMode = 'web' | 'api';
type WebProvider = 'gemini' | 'chatgpt';

type WebImageBridge = {
  generate: (options: {
    prompt: string;
    images: Array<{ dataUrl: string; role: string; name: string }>;
    aspectRatio: string;
    conversationKey: string;
    taskLabel: string;
  }) => Promise<string>;
};

declare global {
  interface Window {
    IantoGeminiWeb?: WebImageBridge;
    IantoChatGPTWeb?: WebImageBridge;
  }
}

interface EditorWorkspaceProps {
  appMode: AppMode;
  webProvider: WebProvider;
  selectedModel: string;
  customApiKey: string;
  openAiApiKey: string;
}

function newConversationKey(): string {
  return `editor_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`图片读取失败：${file.name}`));
    reader.readAsDataURL(file);
  });
}

export default function EditorWorkspace({
  appMode,
  webProvider,
  selectedModel,
  customApiKey,
  openAiApiKey,
}: EditorWorkspaceProps): React.JSX.Element {
  const conversationKey = useRef(newConversationKey());
  const resetConversation = useCallback(() => {
    conversationKey.current = newConversationKey();
  }, []);

  useEffect(() => {
    resetConversation();
  }, [appMode, webProvider, resetConversation]);

  const generateImage = useCallback(async (input: EditorGenerateInput) => {
    if (appMode === 'api') {
      if (selectedModel.startsWith('gpt-image-') && !openAiApiKey.trim()) {
        throw new Error('请先在页面右上角填写 OpenAI API Key。');
      }
      return editImage(
        input.originalImages.map((image) => image.file),
        input.secondaryImage?.file ?? null,
        input.prompt,
        input.aspectRatio,
        input.highFidelityPreserve,
        selectedModel,
        customApiKey,
        input.mergeMode,
        openAiApiKey
      );
    }

    const bridge = webProvider === 'chatgpt' ? window.IantoChatGPTWeb : window.IantoGeminiWeb;
    if (!bridge) {
      throw new Error(`没有检测到 Ianto ${webProvider === 'chatgpt' ? 'ChatGPT' : 'Gemini'} 网页作图桥接。请重载 Ianto 插件并刷新页面。`);
    }
    const images = await Promise.all(input.originalImages.map(async (image, index) => ({
      dataUrl: await fileToDataUrl(image.file),
      role: 'product',
      name: `${String(index + 1).padStart(2, '0')}-product.${image.file.name.split('.').pop() || 'png'}`,
    })));
    if (input.secondaryImage) {
      images.push({
        dataUrl: await fileToDataUrl(input.secondaryImage.file),
        role: 'reference',
        name: `99-reference.${input.secondaryImage.file.name.split('.').pop() || 'png'}`,
      });
    }
    return bridge.generate({
      prompt: input.prompt,
      images,
      aspectRatio: input.aspectRatio,
      conversationKey: conversationKey.current,
      taskLabel: '智能修图与融合',
    });
  }, [appMode, webProvider, selectedModel, customApiKey, openAiApiKey]);

  return (
    <EditorPage
      mode={appMode}
      promptExpansionImageModel={appMode === 'web'
        ? (webProvider === 'chatgpt' ? 'gpt-image-2:auto' : 'gemini-2.5-flash-image')
        : selectedModel}
      customApiKey={customApiKey}
      customModeLabel={appMode === 'web'
        ? 'Custom（网页原生任务 · 不加隐藏提示词）'
        : 'Custom（原生 API · 不加隐藏提示词）'}
      customAspectRatioWarning={appMode === 'web'
        ? 'Web 模式会把所选比例作为最高优先级指令发送到当前网页，不在本地补白。'
        : 'Custom 原生 API 模式只把宽高比交给 Gemini，不会在本地补白或二次描述图片。'}
      showHighFidelityOption={appMode === 'api'}
      generateImage={generateImage}
      onSourceImagesChanged={resetConversation}
    />
  );
}
