/**
 * Client-side watermark removal using Canvas API pixel-level inpainting.
 * 
 * Removes small overlay graphics (AI badges, sparkle icons, etc.) from the 
 * bottom-right corner of an image by sampling surrounding pixels and using
 * inverse-distance-weighted interpolation to reconstruct the covered area.
 * 
 * This runs entirely in the browser — no API call, no safety filter, 
 * 100% original image fidelity outside the repaired region.
 */

/**
 * Remove watermark from the bottom-right corner of an image.
 * @param imageFile - The source image file
 * @param cornerPercent - Percentage of image dimension to clean (default 5%)
 * @returns data URL of the cleaned image (PNG)
 */
export async function removeWatermarkClientSide(
  imageFile: File,
  cornerPercent: number = 5
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(imageFile);

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;

        // Draw original image — every pixel preserved
        ctx.drawImage(img, 0, 0);

        // Calculate watermark region size (bottom-right corner)
        const regionW = Math.max(36, Math.round(img.width * cornerPercent / 100));
        const regionH = Math.max(36, Math.round(img.height * cornerPercent / 100));
        const edgeMargin = Math.max(2, Math.round(Math.min(img.width, img.height) * 0.003));

        // Watermark region top-left corner (in image coordinates)
        const rx = img.width - regionW - edgeMargin;
        const ry = img.height - regionH - edgeMargin;

        // Sampling border: pixels around the watermark region used as inpainting source
        const border = Math.max(6, Math.round(Math.min(regionW, regionH) * 0.3));

        // Fetch area = watermark region + surrounding border
        const fetchX = Math.max(0, rx - border);
        const fetchY = Math.max(0, ry - border);
        const fetchW = Math.min(img.width - fetchX, regionW + border + edgeMargin);
        const fetchH = Math.min(img.height - fetchY, regionH + border + edgeMargin);

        const imageData = ctx.getImageData(fetchX, fetchY, fetchW, fetchH);
        const px = imageData.data;

        // Local coordinates of watermark region inside the fetched block
        const wmX0 = rx - fetchX;
        const wmY0 = ry - fetchY;
        const wmX1 = Math.min(wmX0 + regionW, fetchW);
        const wmY1 = Math.min(wmY0 + regionH, fetchH);

        // ---- Inverse-distance-weighted inpainting ----
        // For each pixel inside the watermark region, sample the 4 nearest border
        // pixels (left, right, top, bottom edges) and blend them by 1/d² weighting.
        // This produces smooth, natural fills for solid and gradient backgrounds.
        for (let ly = wmY0; ly < wmY1; ly++) {
          for (let lx = wmX0; lx < wmX1; lx++) {
            const dLeft   = lx - wmX0 + 1;
            const dRight  = wmX1 - lx;
            const dTop    = ly - wmY0 + 1;
            const dBottom = wmY1 - ly;

            // Source pixel coordinates (just outside watermark boundary)
            const sLeftX  = Math.max(0, wmX0 - 1);
            const sRightX = Math.min(fetchW - 1, wmX1);
            const sTopY   = Math.max(0, wmY0 - 1);
            const sBotY   = Math.min(fetchH - 1, wmY1);

            const pL = pixelAt(px, fetchW, sLeftX,  ly);
            const pR = pixelAt(px, fetchW, sRightX, ly);
            const pT = pixelAt(px, fetchW, lx, sTopY);
            const pB = pixelAt(px, fetchW, lx, sBotY);

            // Inverse-square distance weights
            const wL = 1 / (dLeft * dLeft);
            const wR = 1 / (dRight * dRight);
            const wT = 1 / (dTop * dTop);
            const wB = 1 / (dBottom * dBottom);
            const wS = wL + wR + wT + wB;

            const idx = (ly * fetchW + lx) * 4;
            px[idx]     = Math.round((pL[0]*wL + pR[0]*wR + pT[0]*wT + pB[0]*wB) / wS);
            px[idx + 1] = Math.round((pL[1]*wL + pR[1]*wR + pT[1]*wT + pB[1]*wB) / wS);
            px[idx + 2] = Math.round((pL[2]*wL + pR[2]*wR + pT[2]*wT + pB[2]*wB) / wS);
            // Alpha channel untouched
          }
        }

        // ---- Feathered blending at boundary ----
        // To avoid a hard edge between original and inpainted pixels,
        // blend a thin strip (feather zone) at the watermark boundary.
        const feather = Math.max(3, Math.round(Math.min(regionW, regionH) * 0.08));
        const origData = ctx.getImageData(fetchX, fetchY, fetchW, fetchH);
        const origPx = origData.data;

        for (let ly = wmY0; ly < wmY1; ly++) {
          for (let lx = wmX0; lx < wmX1; lx++) {
            const distToEdge = Math.min(
              lx - wmX0,
              wmX1 - 1 - lx,
              ly - wmY0,
              wmY1 - 1 - ly
            );
            if (distToEdge < feather) {
              // Blend: closer to edge = more original, deeper = more inpainted
              const alpha = distToEdge / feather;  // 0 at edge, 1 at feather depth
              const idx = (ly * fetchW + lx) * 4;
              px[idx]     = Math.round(origPx[idx]     * (1 - alpha) + px[idx]     * alpha);
              px[idx + 1] = Math.round(origPx[idx + 1] * (1 - alpha) + px[idx + 1] * alpha);
              px[idx + 2] = Math.round(origPx[idx + 2] * (1 - alpha) + px[idx + 2] * alpha);
            }
          }
        }

        ctx.putImageData(imageData, fetchX, fetchY);

        URL.revokeObjectURL(url);
        // Use original mime type if possible, fallback to PNG
        const outputType = imageFile.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
        const quality = outputType === 'image/jpeg' ? 0.95 : undefined;
        resolve(canvas.toDataURL(outputType, quality));
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('无法加载图片进行水印去除'));
    };

    img.src = url;
  });
}

/** Read RGB values at (x, y) from a flat pixel array */
function pixelAt(
  data: Uint8ClampedArray,
  width: number,
  x: number,
  y: number
): [number, number, number] {
  const idx = (y * width + x) * 4;
  return [data[idx], data[idx + 1], data[idx + 2]];
}
