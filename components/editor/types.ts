import type { ImageFile } from '../../types';

export interface EditorGenerateInput {
  originalImages: ImageFile[];
  secondaryImage: ImageFile | null;
  prompt: string;
  aspectRatio: string;
  highFidelityPreserve: boolean;
  mergeMode: string;
}

export interface EditorPageProps {
  mode: 'web' | 'api';
  promptExpansionImageModel: string;
  customApiKey: string;
  customModeLabel: string;
  customAspectRatioWarning: string;
  showHighFidelityOption: boolean;
  generateImage: (input: EditorGenerateInput) => Promise<string>;
  onSourceImagesChanged?: () => void;
}
