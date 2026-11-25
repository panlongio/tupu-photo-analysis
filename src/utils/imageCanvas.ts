import { computeCropPixelRect, extractPaletteFromPixels } from './analysisLogic';

export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('无法加载图片资源，请检查文件是否损坏。'));
    img.src = src;
  });
}

export async function prepareUploadedImage(file: File): Promise<{
  displayDataUrl: string;
  uploadDataUrl: string;
  width: number;
  height: number;
  sampledPalette: string[];
}> {
  if (!file.type.startsWith('image/')) {
    throw new Error('请上传图片格式文件（支持 JPG、PNG、WebP）。');
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error('图片体积超过 20MB，请压缩后重新上传。');
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('读取本地图片失败。'));
    reader.readAsDataURL(file);
  });

  const img = await loadImageElement(rawDataUrl);
  const maxEdge = 1500;
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
  const targetW = Math.max(1, Math.round(img.naturalWidth * scale));
  const targetH = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('浏览器不支持 Canvas 图像处理。');
  }
  ctx.drawImage(img, 0, 0, targetW, targetH);

  const uploadDataUrl = canvas.toDataURL('image/jpeg', 0.88);
  const sampledPalette = sampleImagePalette(img, 6);

  return {
    displayDataUrl: rawDataUrl,
    uploadDataUrl,
    width: img.naturalWidth,
    height: img.naturalHeight,
    sampledPalette,
  };
}

export function sampleImagePalette(img: HTMLImageElement, count = 6): string[] {
  const sampleW = 140;
  const aspect = img.naturalHeight / Math.max(1, img.naturalWidth);
  const sampleH = Math.max(1, Math.round(sampleW * aspect));
  const canvas = document.createElement('canvas');
  canvas.width = sampleW;
  canvas.height = sampleH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, sampleW, sampleH);
  const imageData = ctx.getImageData(0, 0, sampleW, sampleH);
  return extractPaletteFromPixels(imageData.data, sampleW, sampleH, count);
}

/**
 * Extracts a genuine pixel crop from the original image for Module D detail thumbnails.
 */
export function cropDetailThumbnail(
  img: HTMLImageElement,
  box: [number, number, number, number],
  outWidth = 360,
  outHeight = 270
): string {
  const rect = computeCropPixelRect(box, img.naturalWidth, img.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = outWidth;
  canvas.height = outHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Cover-fit the crop rect into the target thumbnail aspect without distortion
  const srcAspect = rect.width / Math.max(1, rect.height);
  const dstAspect = outWidth / Math.max(1, outHeight);

  let sx = rect.x;
  let sy = rect.y;
  let sw = rect.width;
  let sh = rect.height;

  if (srcAspect > dstAspect) {
    const newW = sh * dstAspect;
    sx += (sw - newW) / 2;
    sw = newW;
  } else {
    const newH = sw / dstAspect;
    sy += (sh - newH) / 2;
    sh = newH;
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outWidth, outHeight);
  return canvas.toDataURL('image/jpeg', 0.9);
}

/**
 * Generates an archival graphite-on-paper composition contour sketch directly from the real photo
 * using Gaussian-smoothed luminance + Sobel edge detection.
 */
export function generateCompositionSketchDataUrl(
  img: HTMLImageElement,
  maxWidth = 540
): string {
  const aspect = img.naturalHeight / Math.max(1, img.naturalWidth);
  const w = Math.min(maxWidth, Math.max(240, img.naturalWidth));
  const h = Math.max(160, Math.round(w * aspect));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.drawImage(img, 0, 0, w, h);
  const src = ctx.getImageData(0, 0, w, h).data;

  // 1. Convert to grayscale luminance
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    gray[i] = 0.299 * src[idx] + 0.587 * src[idx + 1] + 0.114 * src[idx + 2];
  }

  // 2. Light 3x3 Gaussian blur to suppress film grain while preserving structural edges
  const blur = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      blur[i] =
        (gray[i - w - 1] +
          2 * gray[i - w] +
          gray[i - w + 1] +
          2 * gray[i - 1] +
          4 * gray[i] +
          2 * gray[i + 1] +
          gray[i + w - 1] +
          2 * gray[i + w] +
          gray[i + w + 1]) /
        16;
    }
  }

  // 3. Sobel edge extraction + subtle archival paper tonal wash
  const out = ctx.createImageData(w, h);
  const dst = out.data;

  // Archival paper base: #EFECE6 (239, 236, 230), Graphite ink: #2A302C (42, 48, 44)
  const paperR = 239;
  const paperG = 236;
  const paperB = 230;
  const inkR = 42;
  const inkG = 48;
  const inkB = 44;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let edgeStrength = 0;
      if (x > 0 && x < w - 1 && y > 0 && y < h - 1) {
        const gx =
          -blur[i - w - 1] +
          blur[i - w + 1] -
          2 * blur[i - 1] +
          2 * blur[i + 1] -
          blur[i + w - 1] +
          blur[i + w + 1];
        const gy =
          -blur[i - w - 1] -
          2 * blur[i - w] -
          blur[i - w + 1] +
          blur[i + w - 1] +
          2 * blur[i + w] +
          blur[i + w + 1];
        const mag = Math.hypot(gx, gy);
        // Emphasize crisp structural contour lines
        edgeStrength = Math.max(0, Math.min(1, (mag - 22) / 130));
      }

      // Very gentle shadow mass wash so architectural volumes & faces stay recognizable
      const shadowWash = Math.max(0, (1 - blur[i] / 255) * 0.14);
      const inkAmount = Math.min(1, edgeStrength * 0.92 + shadowWash);

      const idx = i * 4;
      dst[idx] = Math.round(paperR * (1 - inkAmount) + inkR * inkAmount);
      dst[idx + 1] = Math.round(paperG * (1 - inkAmount) + inkG * inkAmount);
      dst[idx + 2] = Math.round(paperB * (1 - inkAmount) + inkB * inkAmount);
      dst[idx + 3] = 255;
    }
  }

  ctx.putImageData(out, 0, 0);
  return canvas.toDataURL('image/png');
}
