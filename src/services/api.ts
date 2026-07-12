import { getSetting } from './db';
import type { AiConfig } from './aiConfig';

async function getBaseUrl(): Promise<string> {
  return (await getSetting('syncUrl')) || 'http://localhost:3001';
}

async function getToken(): Promise<string> {
  return (await getSetting('syncToken')) || '';
}

async function request<T>(
  method: string,
  path: string,
  body?: any,
): Promise<T> {
  const baseUrl = await getBaseUrl();
  const token = await getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const init: RequestInit = { method, headers };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  const res = await fetch(`${baseUrl}${path}`, init);

  if (!res.ok) {
    let detail = `API Error: ${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body.error) detail = body.error;
    } catch { /* ignore */ }
    throw new Error(detail);
  }

  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: any) => request<T>('POST', path, body),
  put: <T>(path: string, body?: any) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),

  async healthCheck(): Promise<{ status: string }> {
    return this.get('/health');
  },

  async getUploadUrl(filename: string, contentType: string): Promise<{ url: string; fileUrl: string }> {
    return this.post('/upload/presigned-url', { filename, contentType });
  },

  async syncPush(operations: any[]): Promise<any> {
    return this.post('/sync/push', { operations });
  },

  async syncPull(lastSyncAt?: string): Promise<any> {
    return this.post('/sync/pull', { lastSyncAt });
  },

  async ocrRecognize(imageDataUrl: string, config?: AiConfig): Promise<{ text: string }> {
    return this.post('/ocr/recognize', { imageDataUrl, ...(config || {}) });
  },

  async aiAnalyze(prompt: string, config?: AiConfig): Promise<{ content: string }> {
    return this.post('/ai/analyze', { prompt, ...(config || {}) });
  },
};
