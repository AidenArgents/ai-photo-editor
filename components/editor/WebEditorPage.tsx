import React, { useCallback, useRef } from 'react';
import EditorPage from './EditorPage';
import type { EditorGenerateInput } from './types';

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

interface WebEditorPageProps {
  webProvider: WebProvider;
  customApiKey: string;
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

export default function WebEditorPage({ webProvider, customApiKey }: WebEditorPageProps): React.JSX.Element {
  const conversationKey = useRef(newConversationKey());
  const resetConversation = useCallback(() => {
    conversationKey.current = newConversationKey();
  }, []);

  const generateImage = useCallback(async (input: EditorGenerateInput) => {
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
  }, [webProvider]);

  return (
    <EditorPage
      mode="web"
      promptExpansionImageModel={webProvider === 'chatgpt' ? 'gpt-image-2:auto' : 'gemini-2.5-flash-image'}
      customApiKey={customApiKey}
      customModeLabel="Custom（网页原生任务 · 不加隐藏提示词）"
      customAspectRatioWarning="Web 模式会把所选比例作为最高优先级指令发送到当前网页，不在本地补白。"
      showHighFidelityOption={false}
      generateImage={generateImage}
      onSourceImagesChanged={resetConversation}
    />
  );
}
