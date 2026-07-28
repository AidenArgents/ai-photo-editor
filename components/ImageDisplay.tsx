import React from 'react';
import Loader from './Loader';
import { ImageIcon } from './Icons';

interface ImageDisplayProps {
  imageUrl: string | null;
  isLoading?: boolean;
}

const ImageDisplay = ({ imageUrl, isLoading = false }: ImageDisplayProps): React.JSX.Element => {
  return (
    <div className="relative w-full h-full min-h-[260px] max-h-[calc(100vh-140px)] bg-white rounded-lg border border-pink-200 overflow-hidden flex items-center justify-center flex-1">
      {imageUrl ? (
        <img src={imageUrl} alt="Edited result" className="block max-w-full max-h-full object-contain" />
      ) : (
        <div className="text-gray-400 flex flex-col items-center justify-center p-4 text-center">
          <ImageIcon />
          <span className="mt-2 text-sm font-medium text-gray-500">生成好的高保真商用成品图将在这里展示</span>
        </div>
      )}

      {/* Loading overlay, shown on top of either the previous image or the placeholder. */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex flex-col items-center justify-center z-10 p-4 text-center">
          <Loader />
          <p className="text-pink-600 font-bold mt-3 animate-pulse">商业 AI 物理光影引擎正在为您精心渲染...</p>
        </div>
      )}
    </div>
  );
};

export default ImageDisplay;