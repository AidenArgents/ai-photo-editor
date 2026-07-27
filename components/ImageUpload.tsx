import React, { useState, useRef, useCallback } from 'react';
import { UploadCloudIcon, TrashIcon } from './Icons';
import Loader from './Loader';

interface ImageUploadProps {
  onImageUpload: (file: File) => void;
  onImageRemove: () => void;
}

const ImageUpload = ({ onImageUpload, onImageRemove }: ImageUploadProps): React.JSX.Element => {
  const [mode, setMode] = useState<'file' | 'url'>('file');
  const [preview, setPreview] = useState<string | null>(null);
  
  // File mode state
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // URL mode state
  const [url, setUrl] = useState('');
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  const processFile = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      setPreview(URL.createObjectURL(file));
      onImageUpload(file);
      // Clean up URL mode state and switch back to file mode
      setUrl('');
      setUrlError(null);
      setIsLoadingUrl(false);
      setMode('file');
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };
  
  const handleDragEnter = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const triggerFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleRemove = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setPreview(null);
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
    setUrl('');
    setUrlError(null);
    onImageRemove();
  };

  const handleUrlLoad = async () => {
    if (!url.trim() || !url.startsWith('http')) {
        setUrlError("Please enter a valid image URL.");
        return;
    }
    setIsLoadingUrl(true);
    setUrlError(null);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch image. Status: ${response.status}`);
      }
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) {
        throw new Error('The provided URL does not point to a valid image.');
      }
      
      const filename = url.substring(url.lastIndexOf('/') + 1).split('?')[0] || 'image-from-url.png';
      const file = new File([blob], filename, { type: blob.type });
      processFile(file);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      console.error(e);
      setUrlError(`Could not load image. This may be due to network issues or server CORS restrictions.`);
    } finally {
      setIsLoadingUrl(false);
    }
  };

  const commonTabClass = 'w-full text-center px-3 py-2 text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-pink-300 focus:ring-opacity-50 rounded-t-md';
  const activeTabClass = 'bg-white border-x border-t border-pink-300 text-pink-600';
  const inactiveTabClass = 'text-gray-500 hover:text-pink-500 bg-pink-50 border-b border-pink-300';
  
  return (
    <div>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />
      
      <div className="grid grid-cols-2">
        <button onClick={() => setMode('file')} className={`${commonTabClass} ${mode === 'file' ? activeTabClass : inactiveTabClass}`}>
          Upload File
        </button>
        <button onClick={() => setMode('url')} className={`${commonTabClass} ${mode === 'url' ? activeTabClass : inactiveTabClass}`}>
          From URL
        </button>
      </div>
      
      <div className="border-2 border-dashed border-pink-300 border-t-0 rounded-b-lg p-1 bg-white">
        {mode === 'file' && (
            <>
            <label
                onClick={triggerFileSelect}
                onDragEnter={handleDragEnter} onDragOver={handleDragEnter} onDragLeave={handleDragLeave} onDrop={handleDrop}
                className={`relative flex flex-col items-center justify-center w-full h-36 rounded-md cursor-pointer transition-colors duration-300 ${isDragging ? 'border-pink-400 bg-pink-100' : 'bg-white hover:bg-pink-50'}`}
            >
                {preview ? (
                <>
                  <img src={preview} alt="Preview" className="object-contain h-full w-full rounded-md p-1" />
                  <button 
                    onClick={handleRemove}
                    className="absolute top-2 right-2 p-1.5 bg-white/80 backdrop-blur-sm rounded-full text-red-500 hover:bg-red-100 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-400 transition-colors"
                    aria-label="Remove image"
                  >
                    <TrashIcon />
                  </button>
                </>
                ) : (
                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-gray-500">
                    <UploadCloudIcon />
                    <p className="mb-2 text-sm text-center"><span className="font-semibold text-pink-500">Click to upload</span> or drag and drop</p>
                    <p className="text-xs">PNG, JPG, WEBP, etc.</p>
                </div>
                )}
            </label>
            {preview && (
                <button onClick={triggerFileSelect} className="text-sm text-pink-500 hover:underline mt-2 w-full text-center">
                Change image
                </button>
            )}
            </>
        )}

        {mode === 'url' && (
            <div className="h-36 flex flex-col justify-center items-center p-4 space-y-3">
                <p className="text-sm text-gray-600 text-center">Enter the web address of an image to load it.</p>
                <div className="flex gap-2 w-full">
                    <input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://.../image.png"
                        className="flex-grow p-2 bg-white border-2 border-pink-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
                    />
                    <button
                        onClick={handleUrlLoad}
                        disabled={isLoadingUrl}
                        className="px-4 py-2 text-sm font-bold text-white bg-pink-500 rounded-lg hover:bg-pink-600 disabled:bg-pink-300 disabled:cursor-wait flex items-center justify-center"
                    >
                        {isLoadingUrl ? <Loader className="text-white h-4 w-4" /> : 'Load'}
                    </button>
                </div>
                {urlError && <p className="text-red-500 text-xs text-center">{urlError}</p>}
            </div>
        )}
      </div>
    </div>
  );
};

export default ImageUpload;