// 跨平台拍照/相册选取工具
// 移动端（Capacitor）使用原生 Camera 插件，桌面/Web 回退到 HTML input

import { dataUrlToBlob } from '@/services/imageStore';

export type PickResult = {
  dataUrl: string;
  file: File;
};

async function getCompressedFile(dataUrl: string, name: string): Promise<{ dataUrl: string; file: File }> {
  const blob = dataUrlToBlob(dataUrl);
  const file = new File([blob], name, { type: 'image/jpeg' });
  const { compressToDataUrl } = await import('@/services/ocrService');
  const compressed = await compressToDataUrl(file);
  const compressedBlob = dataUrlToBlob(compressed);
  return {
    dataUrl: compressed,
    file: new File([compressedBlob], file.name, { type: 'image/jpeg' }),
  };
}

/** 调用系统相机拍照 */
export async function takePhoto(): Promise<PickResult | null> {
  try {
    const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
      quality: 80,
    });
    if (photo.dataUrl) {
      return getCompressedFile(photo.dataUrl, `photo-${Date.now()}.jpg`);
    }
    return null;
  } catch {
    return pickFromHtmlInput(true);
  }
}

/** 从系统相册选取图片 */
export async function pickFromGallery(): Promise<PickResult | null> {
  try {
    const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Photos,
      quality: 80,
    });
    if (photo.dataUrl) {
      return getCompressedFile(photo.dataUrl, `gallery-${Date.now()}.jpg`);
    }
    return null;
  } catch {
    return pickFromHtmlInput(false);
  }
}

/** 拍照/相册的通用入口：优先用原生 Camera，回退到 HTML input */
export async function pickImage(source: 'camera' | 'gallery'): Promise<PickResult | null> {
  return source === 'camera' ? takePhoto() : pickFromGallery();
}

/** HTML input 回退 */
function pickFromHtmlInput(useCamera: boolean): Promise<PickResult | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (useCamera) input.setAttribute('capture', 'environment');
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      try {
        const { compressToDataUrl } = await import('@/services/ocrService');
        const compressed = await compressToDataUrl(file);
        resolve({ dataUrl: compressed, file: new File([dataUrlToBlob(compressed)], file.name, { type: file.type }) });
      } catch {
        resolve(null);
      }
    };
    input.click();
  });
}
