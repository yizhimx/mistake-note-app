import { getSetting } from './db';

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

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    throw new Error(`API Error: ${res.status} ${res.statusText}`);
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

  async ocrRecognize(imageUrl: string): Promise<{ text: string }> {
    return this.post('/ocr/recognize', { imageUrl });
  },

  async aiAnalyze(text: string, model?: string): Promise<{ content: string }> {
    return this.post('/ai/analyze', { text, model });
  },
};
