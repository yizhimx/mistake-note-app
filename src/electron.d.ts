export {};

declare global {
  interface Window {
    electronAPI?: {
      readDbFile: () => Promise<Uint8Array | null>;
      writeDbFile: (data: Uint8Array) => Promise<void>;
      getDbPath: () => Promise<string>;
      exportPdf?: (html: string) => Promise<boolean>;
      saveImage: (dataUrl: string) => Promise<string | null>;
      saveImageAs: (dataUrl: string, name: string) => Promise<string | null>;
      loadImage: (name: string) => Promise<string | null>;
      deleteImage: (name: string) => Promise<void>;
      aiRequest: (payload: {
        url: string;
        method?: string;
        headers?: Record<string, string>;
        body?: string;
        requestId?: string;
      }) => Promise<{ ok: boolean; status: number; statusText: string; body: string }>;
      cancelAiRequest: (requestId: string) => Promise<{ success: boolean; reason?: string }>;
    };
  }
}
