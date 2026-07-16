import { getAiConfig as _getAiConfig } from './aiConfig';
export const getAiConfig = _getAiConfig;

function normalizeUrl(endpoint?: string): string {
  const base = (endpoint || 'https://dashscope.aliyuncs.com/compatible-mode/v1').replace(/\/+$/, '');
  return base.includes('/chat/completions') ? base : `${base}/chat/completions`;
}

// Request ID generator for cancellation tracking
let requestIdCounter = 0;
function generateRequestId(): string {
  return `ai_req_${Date.now()}_${++requestIdCounter}`;
}

// Transport wrapper: in Electron, route through main-process proxy (no CORS);
// in web/browser, fall back to direct fetch.
async function aiFetch(
  url: string,
  init: RequestInit,
  signal?: AbortSignal | null,
): Promise<Response> {
  // Electron IPC path with cancellation support
  if (window.electronAPI?.aiRequest) {
    const headers = (init.headers as Record<string, string>) ?? {};
    const requestId = generateRequestId();

    // If signal provided, register for abort
    let aborted = false;
    const abortHandler = () => {
      aborted = true;
      window.electronAPI?.cancelAiRequest?.(requestId);
    };
    signal?.addEventListener('abort', abortHandler);

    try {
      const res = await window.electronAPI.aiRequest({
        url,
        method: init.method ?? 'POST',
        headers,
        body: init.body as string,
        requestId,
      });
      return new Response(res.body, { status: res.status, statusText: res.statusText });
    } finally {
      signal?.removeEventListener('abort', abortHandler);
    }
  }

  // Fallback: direct fetch (web mode, or stale Electron build where preload wasn't updated)
  console.error('[directAi] window.electronAPI.aiRequest 不可用，回退到直接 fetch（可能被 CORS 拦截，或 Electron 未完全重启/重新构建）');
  try {
    return await fetch(url, { ...init, signal: signal ?? null });
  } catch (e: any) {
    throw new Error(`直接 fetch 失败: ${e?.message || e}（请确认 Electron 已完全退出并重新运行 quasar dev -m electron）`);
  }
}

export async function directTextChat(
  prompt: string,
  options?: { systemPrompt?: string; temperature?: number; signal?: AbortSignal | null },
): Promise<string> {
  const config = getAiConfig();
  if (!config.aiApiKey) throw new Error('未配置 AI API Key，请先在设置中填写');

  const { signal, ...opts } = options ?? {};
  const resp = await aiFetch(normalizeUrl(config.aiEndpoint), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.aiApiKey}`,
    },
    body: JSON.stringify({
      model: config.aiModel || 'qwen-plus',
      messages: [
        { role: 'system', content: opts?.systemPrompt || 'You are a helpful assistant.' },
        { role: 'user', content: prompt },
      ],
      temperature: opts?.temperature ?? 0.3,
    }),
  }, signal ?? undefined);

  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`AI API ${resp.status}: ${txt.slice(0, 500)}`);
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('AI API 返回结构异常');
  return content;
}

export async function directVisionChat(
  text: string,
  imageDataUrl: string,
  options?: { systemPrompt?: string; temperature?: number; signal?: AbortSignal | null },
): Promise<string> {
  const config = getAiConfig();
  if (!config.aiApiKey) throw new Error('未配置 AI API Key，请先在设置中填写');

  const { signal, ...opts } = options ?? {};
  const resp = await aiFetch(normalizeUrl(config.aiEndpoint), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.aiApiKey}`,
    },
    body: JSON.stringify({
      model: config.aiModel || 'qwen-vl-plus',
      messages: [
        { role: 'system', content: opts?.systemPrompt || 'You are a helpful assistant.' },
        {
          role: 'user',
          content: [
            { type: 'text', text },
            { type: 'image_url', image_url: { url: imageDataUrl } },
          ],
        },
      ],
      temperature: opts?.temperature ?? 0.2,
    }),
  }, signal ?? undefined);

  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`AI Vision API ${resp.status}: ${txt.slice(0, 500)}`);
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('AI Vision API 返回结构异常');
  return content;
}
