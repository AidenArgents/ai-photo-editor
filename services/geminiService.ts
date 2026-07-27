/**
 * Client-side padding helper to ensure product/image details are not distorted
 * when changing aspect ratios. Runs entirely in the browser canvas.
 */
const padImageToAspectRatio = (file: File, targetAspectRatioString: string): Promise<File> => {
  return new Promise((resolve, reject) => {
    const [w, h] = targetAspectRatioString.split(':').map(Number);
    if (isNaN(w) || iSNaN(h) || h === 0) {
        return reject(new Error('Invalid aspect ratio string'));
    }
    const targetRatio = w / h;

    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      if (!e.target?.result) {
        return reject(new Error('FileReader did not return a result'));
      }
      img.onload = () => {
        const originalWidth = img.width;
        const originalHeight = img.height;
        const originalRatio = originalWidth / originalHeight;

        let newWidth: number, newHeight: number, offsetX: number, offsetY: number;

        if (originalRatio > targetRatio) {
          // Original is wider than target, so padding will be on top/bottom
          newWidth = originalWidth;
          newHeight = Math.round(originalWidth / targetRatio);
          offsetX = 0;
          offsetY = Math.round((newHeight - originalHeight) / 2);
        } else {
          // Original is taller than or equal to target, padding will be on sides
          newHeight = originalHeight;
          newWidth = Math.round(originalHeight * targetRatio);
          offsetY = 0;
          offsetX = Math.round((newWidth - originalWidth) / 2);
        }

        const canvas = document.createElement('canvas');
        canvas.width = newWidth;
        canvas.height = newHeight;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          return reject(new Error('Could not get canvas context'));
        }

        // Fill background with white
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, newWidth, newHeight);

        // Draw the original image centered on the new canvas
        ctx.drawImage(img, offsetX, offsetY, originalWidth, originalHeight);

        // Convert canvas to a new file
        canvas.toBlob((blob) => {
          if (!blob) {
            return reject(new Error('Canvas toBlob failed'));
          }
          const paddedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".png", { type: 'image/png' });
          resolve(paddedFile);
        }, 'image/png');
      };
      
      img.onerror = () => reject(new Error('Image failed to load'));
      img.src = e.target.result as string;
    };
    
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsDataURL(file);
  });
};

// Helper helper for uppercase/lowercase in check
function iSNaN(val: number) {
  return Number.isNaN(val);
}

/**
 * Optimizes image size before uploading to avoid huge payloads and gateway timeouts.
 */
const optimizeImageForUpload = (file: File, maxDimension = 1600): Promise<File> => {
  return new Promise((resolve) => {
    if (file.size < 1.5 * 1024 * 1024) {
      return resolve(file);
    }

    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      if (!e.target?.result) return resolve(file);
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(file);

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) return resolve(file);
            const optimized = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpeg", {
              type: 'image/jpeg',
            });
            resolve(optimized);
          },
          'image/jpeg',
          0.92
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
};

/**
 * Sends image editing requests to the server-side API.
 * The server handles interaction with Gemini using its secure environment variables.
 */
export const editImage = async (
  imageFile: File,
  secondaryImageFile: File | null,
  prompt: string,
  aspectRatio: string,
  highFidelityPreserve: boolean,
  model?: string,
  customApiKey?: string
): Promise<string> => {
  try {
    let finalImage = await optimizeImageForUpload(imageFile);
    let finalSecondaryImage = secondaryImageFile ? await optimizeImageForUpload(secondaryImageFile) : null;

    // Run client-side padding if highFidelityPreserve is selected
    if (aspectRatio !== 'auto' && highFidelityPreserve) {
      console.log('Client: Padding main image to aspect ratio...', aspectRatio);
      finalImage = await padImageToAspectRatio(finalImage, aspectRatio);

      if (finalSecondaryImage) {
        console.log('Client: Padding secondary image to aspect ratio...', aspectRatio);
        finalSecondaryImage = await padImageToAspectRatio(finalSecondaryImage, aspectRatio);
      }
    }

    // Construct FormData to send files and parameters to the server
    const formData = new FormData();
    formData.append('image', finalImage);
    if (finalSecondaryImage) {
      formData.append('secondaryImage', finalSecondaryImage);
    }
    formData.append('prompt', prompt);
    formData.append('aspectRatio', aspectRatio);
    formData.append('highFidelityPreserve', highFidelityPreserve ? 'true' : 'false');
    if (model) {
      formData.append('model', model);
    }

    console.log('Client: Sending request to /api/edit-image...');
    const headers: Record<string, string> = {};
    if (customApiKey) {
      headers['x-gemini-api-key'] = customApiKey;
    }

    const response = await fetch('/api/edit-image', {
      method: 'POST',
      headers: headers,
      body: formData,
    });

    let data: any;
    try {
      const text = await response.text();
      
      // Check if response is HTML (e.g. proxy redirect or gateway error)
      if (text.includes('Cookie check') || text.includes('doctype html') || text.includes('<html')) {
        throw new Error('网络通信临时波动，请再次点击“生成编辑”重试。');
      }

      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('Failed to parse server response. Raw text:', text);
        if (!response.ok) {
          throw new Error(`服务器响应错误 (${response.status})。请检查 API Key 或重试。`);
        }
        throw new Error(`服务响应异常，请重试。`);
      }
    } catch (parseError: any) {
      throw new Error(parseError.message || '网络请求解析失败。');
    }

    // Check if there is an error field in the JSON
    const serverError = data.error || '';
    if (serverError) {
      const errStr = typeof serverError === 'object' ? JSON.stringify(serverError) : String(serverError);
      
      if (
        errStr.includes('quota') || 
        errStr.includes('Quota') || 
        errStr.includes('429') || 
        errStr.includes('RESOURCE_EXHAUSTED') || 
        errStr.includes('exceeded') ||
        errStr.includes('limit: 0')
      ) {
        throw new Error(
          '您的 Gemini API 密钥处于免费层级 (Free Tier)，当前 Google 已限制免费账户生成/编辑图片的额度为 0。\n\n' +
          '【如何解决】：\n' +
          '1. 请点击右上角设置 (Settings)，配置已启用“按需付费计费 (Pay-as-you-go)”的 Gemini API 密钥。\n' +
          '2. 或者在 Google AI Studio 平台中为您的账户绑定信用卡进行升级。\n\n' +
          '一般的文本对话模型（如 Gemini 2.5/3.5 Flash）免费额度仍可正常使用，但图片生成/编辑模型需要付费账单账户额度。'
        );
      }
      
      if (errStr.includes('paid plans') || errStr.includes('only available on paid plans')) {
        throw new Error(
          '当前调用的 Imagen 3.0 / 4.0 图像生成模型仅在“付费方案 (Paid Plans)”中可用。' +
          '请在右上角设置中配置已绑定付费账单的 API 密钥，或使用默认的图片编辑。'
        );
      }

      throw new Error(errStr);
    }

    if (!data.imageUrl) {
      throw new Error('服务器未返回编辑后的图片 URL。');
    }

    return data.imageUrl;
  } catch (error: any) {
    console.error('Client: Image editing failed:', error);
    throw new Error(error.message || 'The padding-based editing process failed. Please try again.');
  }
};
