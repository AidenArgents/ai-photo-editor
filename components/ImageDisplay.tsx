import React from 'react';
import Loader from './Loader';
import { ImageIcon } from './Icons';

interface ImageDisplayProps {
  imageUrl: string | null;
  isLoading?: boolean;
}

const ImageDisplay = ({ imageUrl, isLoading = false }: ImageDisplayProps): React.JSX.Element => {
  return (
    <div className="relative w-full aspect-square bg-white rounded-lg border border-pink-200 overflow-hidden flex items-center justify-center">
      {imageUrl ? (
        <img src={imageUrl} alt="Edited result" className="block max-w-full max-h-full object-contain" />
      ) : (
        <div className="text-gray-400 flex flex-col items-center justify-center p-4 text-center">
          <ImageIcon />
          <span className="mt-2 text-sm">Edited image will appear here</span>
        </div>
      )}

      {/* Loading overlay, shown on top of either the previous image or the placeholder. */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex flex-col items-center justify-center z-10 p-4 text-center">
          <Loader />
          <p className="text-gray-600 mt-2">AI is working its magic...</p>
        </div>
      )}
    </div>
  );
};

export default ImageDisplay;