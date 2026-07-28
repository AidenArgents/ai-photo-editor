import React, { useState, useRef, useCallback } from 'react';
import { UploadCloudIcon, TrashIcon } from './Icons';
import Loader from './Loader';

interface ImageUploadProps {
  onImageUpload?: (file: File) => void;
  onImageRemove?: () => void;
  multiple?: boolean;
  onImagesUpload?: (files: File[]) => void;
  onImagesRemove?: () => void;
}

const ImageUpload = ({ 
  onImageUpload, 
  onImageRemove, 
  multiple = false,
  onImagesUpload,
  onImagesRemove 
}: ImageUploadProps): React.JSX.Element => {
  const [mode, setMode] = useState<'file' | 'url'>('file');
  const [previews, setPreviews] = useState<{ url: string; file: File }[]>([]);
  
  // File mode state
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // URL mode state
  const [url, setUrl] = useState('');
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  const processFiles = (newFiles: File[]) => {
    const validFiles = newFiles.filter(f => f && f.type.startsWith('image/'));
    if (validFiles.length === 0) return;

    if (multiple) {
      const newItems = validFiles.map(f => ({ url: URL.createObjectURL(f), file: f }));
      const updated = [...previews, ...newItems];
      setPreviews(updated);
      if (onImagesUpload) {
        onImagesUpload(updated.map(item => item.file));
      } else if (onImageUpload && updated.length > 0) {
        onImageUpload(updated[0].file);
      }
    } else {
      const f = validFiles[0];
      setPreviews([{ url: URL.createObjectURL(f), file: f }]);
      if (onImageUpload) {
        onImageUpload(f);
      }
    }
    setUrl('');
    setUrlError(null);
    setIsLoadingUrl(false);
    setMode('file');
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from<File>(event.target.files) : [];
    if (files.length > 0) {
      processFiles(files);
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
    const files = e.dataTransfer.files ? Array.from<File>(e.dataTransfer.files) : [];
    if (files.length > 0) {
      processFiles(files);
    }
  };

  const triggerFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleRemove = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setPreviews([]);
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
    setUrl('');
    setUrlError(null);
    if (onImageRemove) onImageRemove();
    if (onImagesRemove) onImagesRemove();
  };

  const handleRemoveIndex = (e: React.MouseEvent, indexToRemove: number) => {
    e.preventDefault();
    e.stopPropagation();
    const updated = previews.filter((_, idx) => idx !== indexToRemove);
    setPreviews(updated);
    if (updated.length === 0) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setUrl('');
      if (onImageRemove) onImageRemove();
      if (onImagesRemove) onImagesRemove();
    } else {
      if (onImagesUpload) {
        onImagesUpload(updated.map(item => item.file));
      } else if (onImageUpload && updated.length > 0) {
        onImageUpload(updated[0].file);
      }
    }
  };

  const parseUrls = (input: string): string[] => {
    return input
      .split(/[\s,，;；|]+/)
      .map((u) => u.trim())
      .filter((u) => u.startsWith('http://') || u.startsWith('https://'));
  };

  const handleUrlLoad = async () => {
    const targetUrls = parseUrls(url);
    if (targetUrls.length === 0) {
      setUrlError("请输入至少一个有效的图片网络网址（以 http:// 或 https:// 开头）。");
      return;
    }

    setIsLoadingUrl(true);
    setUrlError(null);

    const urlsToLoad = multiple ? targetUrls : [targetUrls[0]];

    // 单张图片的下载函数
    const loadSingleUrl = async (targetUrl: string): Promise<File> => {
      let blob: Blob | null = null;

      if (targetUrl.startsWith('blob:') || targetUrl.startsWith('data:')) {
        const res = await fetch(targetUrl);
        blob = await res.blob();
      } else {
        const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(targetUrl)}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        try {
          const proxyRes = await fetch(proxyUrl, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (!proxyRes.ok) {
            const errData = await proxyRes.json().catch(() => ({}));
            throw new Error(errData.error || `服务器拉取状态码: ${proxyRes.status}`);
          }
          const tempBlob = await proxyRes.blob();
          if (!tempBlob.type.startsWith('image/')) {
            throw new Error('返回的不是有效的图片格式。');
          }
          blob = tempBlob;
        } catch (err: any) {
          clearTimeout(timeoutId);
          if (err.name === 'AbortError') {
            throw new Error('拉取超时（15秒内无响应），请确认网址可访问。');
          }
          throw err;
        }
      }

      const cleanUrl = targetUrl.split('?')[0];
      const filename = cleanUrl.substring(cleanUrl.lastIndexOf('/') + 1) || `image.png`;
      return new File([blob], filename, { type: blob.type || 'image/png' });
    };

    // 限流并发：最多 concurrency 路同时下载，结果顺序与输入顺序严格一致
    const concurrency = 5;
    const results: PromiseSettledResult<File>[] = [];
    for (let i = 0; i < urlsToLoad.length; i += concurrency) {
      const batch = urlsToLoad.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(batch.map(u => loadSingleUrl(u)));
      results.push(...batchResults);
    }

    const loadedFiles: File[] = [];
    const failedUrls: string[] = [];
    results.forEach((r, idx) => {
      if (r.status === 'fulfilled') {
        loadedFiles.push(r.value);
      } else {
        console.error(`Failed to load url: ${urlsToLoad[idx]}`, r.reason);
        failedUrls.push(urlsToLoad[idx]);
      }
    });

    setIsLoadingUrl(false);

    if (loadedFiles.length > 0) {
      processFiles(loadedFiles);
      if (failedUrls.length > 0) {
        setUrlError(`成功加载 ${loadedFiles.length} 张，失败 ${failedUrls.length} 张。`);
      } else {
        setUrl('');
      }
    } else {
      setUrlError("图片加载失败，可能是跨域限制或链接权限问题，请确认马帮/系统网址可公开访问。");
    }
  };

  const commonTabClass = 'w-full text-center px-3 py-2 text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-pink-300 focus:ring-opacity-50 rounded-t-md';
  const activeTabClass = 'bg-white border-x border-t border-pink-300 text-pink-600';
  const inactiveTabClass = 'text-gray-500 hover:text-pink-500 bg-pink-50 border-b border-pink-300';
  
  return (
    <div className="flex flex-col h-full w-full min-h-0 overflow-hidden">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        multiple={multiple}
        className="hidden"
      />
      
      <div className="grid grid-cols-2 shrink-0">
        <button onClick={() => setMode('file')} className={`${commonTabClass} ${mode === 'file' ? activeTabClass : inactiveTabClass}`}>
          本地上传
        </button>
        <button onClick={() => setMode('url')} className={`${commonTabClass} ${mode === 'url' ? activeTabClass : inactiveTabClass}`}>
          网络网址
        </button>
      </div>
      
      <div className="border-2 border-dashed border-pink-300 border-t-0 rounded-b-lg p-1.5 bg-white flex-1 flex flex-col justify-center min-h-0 overflow-hidden">
        {mode === 'file' && (
            <>
            <label
                onClick={previews.length === 0 ? triggerFileSelect : undefined}
                onDragEnter={handleDragEnter} onDragOver={handleDragEnter} onDragLeave={handleDragLeave} onDrop={handleDrop}
                className={`relative flex flex-col items-center justify-center w-full flex-1 min-h-0 overflow-hidden py-2 rounded-md transition-colors duration-300 ${isDragging ? 'border-pink-400 bg-pink-100' : 'bg-white hover:bg-pink-50'} ${previews.length === 0 ? 'cursor-pointer' : ''}`}
            >
                {previews.length > 0 ? (
                  multiple ? (
                    <div className="absolute inset-0 flex flex-row items-center gap-2 overflow-x-auto overflow-y-hidden p-2">
                      {previews.map((item, idx) => (
                        <div key={idx} className="relative h-full aspect-square shrink-0 bg-gray-50 border border-gray-200 rounded-md overflow-hidden group">
                          <img src={item.url} alt={`Preview ${idx + 1}`} className="object-contain w-full h-full p-1" />
                          <button 
                            onClick={(e) => handleRemoveIndex(e, idx)}
                            className="absolute top-1 right-1 p-1 bg-white/90 backdrop-blur-sm rounded-full text-red-500 hover:bg-red-100 hover:text-red-600 focus:outline-none shadow-sm transition-colors"
                            aria-label="Remove image"
                            title="删除这张图片"
                          >
                            <TrashIcon />
                          </button>
                          <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                            #{idx + 1}
                          </span>
                        </div>
                      ))}
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); triggerFileSelect(); }}
                        className="h-full aspect-square shrink-0 border-2 border-dashed border-pink-300 rounded-md flex flex-col items-center justify-center text-pink-500 hover:bg-pink-50 hover:border-pink-400 transition-colors cursor-pointer"
                        title="添加更多产品图片"
                      >
                        <span className="text-2xl font-bold leading-none">+</span>
                        <span className="text-[10px] font-semibold mt-1">继续添加</span>
                      </button>
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center overflow-hidden p-1">
                      <img src={previews[0].url} alt="Preview" className="object-contain max-h-full max-w-full rounded-md" />
                      <button 
                        onClick={() => handleRemove()}
                        className="absolute top-2 right-2 p-1.5 bg-white/80 backdrop-blur-sm rounded-full text-red-500 hover:bg-red-100 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-400 transition-colors"
                        aria-label="Remove image"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  )
                ) : (
                <div className="flex flex-col items-center justify-center py-2 text-gray-500">
                    <UploadCloudIcon />
                    <p className="mb-1 text-xs text-center"><span className="font-semibold text-pink-500">点击上传</span> 或拖拽图片</p>
                    <p className="text-[10px]">支持 PNG, JPG, WEBP 等格式</p>
                </div>
                )}
            </label>
            {previews.length > 0 && !multiple && (
                <button onClick={triggerFileSelect} className="text-sm text-pink-500 hover:underline mt-2 w-full text-center shrink-0">
                更换图片
                </button>
            )}
            {previews.length > 0 && multiple && (
                <div className="flex justify-between items-center px-2 mt-2 shrink-0">
                  <span className="text-xs font-semibold text-pink-600">已选 {previews.length} 张产品图（左右滑动查看）</span>
                  <button onClick={() => handleRemove()} className="text-xs text-red-500 hover:underline">
                    清空全部
                  </button>
                </div>
            )}
            </>
        )}

        {mode === 'url' && (
            <div className="flex-1 min-h-0 flex flex-col justify-center items-center p-2 space-y-2 overflow-hidden">
                <p className="text-xs text-gray-600 text-center">
                  {multiple 
                    ? "支持批量粘贴多个网址（用空格、回车或逗号隔开）" 
                    : "输入图片的网络链接进行加载。"}
                </p>
                <div className="flex gap-2 w-full flex-grow">
                    {multiple ? (
                      <textarea
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://instudio.mabang.../1.jpg&#10;https://instudio.mabang.../2.jpg"
                        className="flex-grow p-2 bg-white border-2 border-pink-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-pink-400 resize-none font-mono"
                      />
                    ) : (
                      <input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://.../image.png"
                        className="flex-grow p-2 bg-white border-2 border-pink-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-400 font-mono"
                      />
                    )}
                    <button
                        onClick={handleUrlLoad}
                        disabled={isLoadingUrl}
                        className="px-4 py-2 text-sm font-bold text-white bg-pink-500 rounded-lg hover:bg-pink-600 disabled:bg-pink-300 disabled:cursor-wait flex flex-col items-center justify-center flex-shrink-0"
                    >
                        {isLoadingUrl ? <Loader className="text-white h-4 w-4 mb-1" /> : null}
                        <span>{isLoadingUrl ? '加载中' : (multiple ? '批量加载' : '加载')}</span>
                    </button>
                </div>
                {urlError && <p className="text-red-500 text-[11px] text-center font-medium leading-tight max-w-full truncate" title={urlError}>{urlError}</p>}
            </div>
        )}
      </div>
    </div>
  );
};

export default ImageUpload;