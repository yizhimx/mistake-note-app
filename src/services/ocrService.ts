import { getAiConfig } from './aiConfig';
import { directVisionChat } from './directAi';

export async function recognizeText(dataUrl: string): Promise<string> {
  const config = getAiConfig();
  if (!config.aiApiKey) {
    throw new Error('未配置 AI API Key，请先在设置中填写');
  }
  try {
    const prompt =
      '你是 OCR 转写助手。请把图片中的题目内容逐字逐符号转写成 Markdown 文本。\n' +
      '规则：\n' +
      '- 数学公式用 LaTeX 行内 $...$ 或块级 $$...$$ 表示。\n' +
      '- 禁止解题、禁止推理、禁止补全、禁止生成答案与解析。\n' +
      '- 只输出题目本身的 Markdown 文本，不要用代码块包裹，不要输出多余解释。';
    return await directVisionChat(prompt, dataUrl, { temperature: 0.2 });
  } catch (e) {
    console.error('OCR recognition failed:', e);
    throw e;
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function drawToCanvas(img: HTMLImageElement | ImageBitmap, maxWidth: number, quality: number): string {
  const canvas = document.createElement('canvas');
  let { width, height } = img;
  if (width > maxWidth) {
    height = (height * maxWidth) / width;
    width = maxWidth;
  }
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Failed to get canvas context');
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}

export async function compressToDataUrl(
  file: File,
  maxWidth = 800,
  quality = 0.6,
): Promise<string> {
  const rawDataUrl = await fileToDataUrl(file);

  // Check if compression is enabled in settings
  try {
    const enabled = localStorage.getItem('compressImages');
    if (enabled === 'false') return rawDataUrl;
  } catch { /* localStorage unavailable, proceed with compression */ }

  // Try createImageBitmap first (works on File/Blob directly in Electron/Chrome)
  try {
    const bitmap = await createImageBitmap(file);
    const result = drawToCanvas(bitmap, maxWidth, quality);
    bitmap.close();
    return result;
  } catch {
    // createImageBitmap failed, ignore
  }

  // Try new Image() with data URL
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Failed to load image'));
      i.src = rawDataUrl;
    });
    return drawToCanvas(img, maxWidth, quality);
  } catch {
    // Both compression approaches failed, return raw data URL
    return rawDataUrl;
  }
}

export async function uploadImage(
  file: File,
  compress = true,
): Promise<string> {
  return compress ? compressToDataUrl(file) : fileToDataUrl(file);
}
