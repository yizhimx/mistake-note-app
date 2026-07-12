import express from 'express';
import cors from 'cors';
import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/sync/push', (req, res) => {
  const { operations } = req.body;
  console.log(`Received ${operations?.length || 0} operations`);
  res.json({ success: true, count: operations?.length || 0 });
});

app.post('/sync/pull', (req, res) => {
  const { lastSyncAt } = req.body;
  res.json({
    operations: [],
    lastSyncAt: new Date().toISOString(),
  });
});

app.post('/upload/presigned-url', (req, res) => {
  const { filename, contentType } = req.body;
  res.json({
    url: `http://localhost:${PORT}/upload/${filename}`,
    fileUrl: `http://localhost:${PORT}/uploads/${filename}`,
  });
});

// ============ AI 代理（前端经此后端调用云端大模型，密钥不落前端代码） ============

interface DashScopeMessage {
  role: string;
  content: any;
}

function normalizeChatUrl(endpoint?: string): string {
  const base = (endpoint || 'https://dashscope.aliyuncs.com/compatible-mode/v1').replace(/\/+$/, '');
  return base.includes('/chat/completions') ? base : `${base}/chat/completions`;
}

async function callDashScope(opts: {
  apiKey: string;
  endpoint?: string;
  model?: string;
  messages: DashScopeMessage[];
  temperature?: number;
}): Promise<string> {
  const url = normalizeChatUrl(opts.endpoint);
  const model = opts.model || 'qwen-vl-plus';
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.2,
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`DashScope ${resp.status}: ${txt.slice(0, 500)}`);
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new Error('DashScope 返回结构异常');
  }
  return content;
}

// 截图识别：视觉模型把题目图片转写为 Markdown 文本（数学公式用 $...$ / $$...$$）
app.post('/ocr/recognize', async (req, res) => {
  try {
    const { imageDataUrl, aiApiKey, aiEndpoint, aiModel } = req.body as {
      imageDataUrl?: string;
      aiApiKey?: string;
      aiEndpoint?: string;
      aiModel?: string;
    };

    if (!aiApiKey) return res.status(400).json({ error: '缺少 AI API Key，请先在设置中填写' });
    if (!imageDataUrl) return res.status(400).json({ error: '缺少图片数据' });

    const endpoint = aiEndpoint || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    const dashModel = aiModel || 'qwen-vl-plus';

    const prompt =
      '你是 OCR 转写助手。请把图片中的题目内容逐字逐符号转写成 Markdown 文本。\n' +
      '规则：\n' +
      '- 数学公式用 LaTeX 行内 $...$ 或块级 $$...$$ 表示。\n' +
      '- 禁止解题、禁止推理、禁止补全、禁止生成答案与解析。\n' +
      '- 只输出题目本身的 Markdown 文本，不要用代码块包裹，不要输出多余解释。';

    const messages: DashScopeMessage[] = [
      { role: 'system', content: 'You are a helpful assistant.' },
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageDataUrl } },
        ],
      },
    ];

    const text = await callDashScope({
      apiKey: aiApiKey,
      endpoint,
      model: dashModel,
      messages,
    });

    res.json({ text });
  } catch (e: any) {
    res.status(502).json({ error: e?.message || 'OCR 识别失败' });
    console.error('OCR handler error:', e);
  }
});

// 通用分析：前端构造好 prompt，后端转发到文本模型并返回文本
app.post('/ai/analyze', async (req, res) => {
  try {
    const { prompt, aiApiKey, aiEndpoint, aiModel } = req.body as {
      prompt?: string;
      aiApiKey?: string;
      aiEndpoint?: string;
      aiModel?: string;
    };

    if (!aiApiKey) return res.status(400).json({ error: '缺少 AI API Key，请先在设置中填写' });
    if (!prompt) return res.status(400).json({ error: '缺少 prompt' });

    const endpoint = aiEndpoint || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    const dashModel = aiModel || 'qwen-vl-plus';

    const messages: DashScopeMessage[] = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: prompt },
    ];

    const content = await callDashScope({
      apiKey: aiApiKey,
      endpoint,
      model: dashModel,
      messages,
      temperature: 0.3,
    });

    res.json({ content });
  } catch (e: any) {
    res.status(502).json({ error: e?.message || 'AI 分析失败' });
    console.error('AI handler error:', e);
  }
});

app.listen(PORT, () => {
  console.log(`MistakeNote server running on http://localhost:${PORT}`);
});
