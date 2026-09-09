import React, { useCallback } from 'react';
import { editImage } from '../../services/geminiService';
import EditorPage from './EditorPage';
import type { EditorGenerateInput } from './types';

interface ApiEditorPageProps {
  selectedModel: string;
  customApiKey: string;
  openAiApiKey: string;
}

export default function ApiEditorPage({ selectedModel, customApiKey, openAiApiKey }: ApiEditorPageProps): React.JSX.Element {
  const generateImage = useCallback(async (input: EditorGenerateInput) => {
    if (selectedModel.startsWith('gpt-image-2:') && !openAiApiKey.trim()) {
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
  }, [selectedModel, customApiKey, openAiApiKey]);

  return (
    <EditorPage
      mode="api"
      promptExpansionImageModel={selectedModel}
      customApiKey={customApiKey}
      customModeLabel="Custom（原生 API · 不加隐藏提示词）"
      customAspectRatioWarning="Custom 原生 API 模式只把宽高比交给 Gemini，不会在本地补白或二次描述图片。"
      showHighFidelityOption
      generateImage={generateImage}
    />
  );
}
