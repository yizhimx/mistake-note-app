import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

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

app.post('/ocr/recognize', (req, res) => {
  const { imageUrl } = req.body;
  res.json({ text: `[OCR 识别结果占位] 图片: ${imageUrl}` });
});

app.post('/ai/analyze', (req, res) => {
  const { text } = req.body;
  const result = {
    correctAnswer: '示例答案',
    steps: ['步骤一：分析题目', '步骤二：应用公式', '步骤三：计算得出结果'],
    knowledgePoints: ['知识点 A', '知识点 B'],
    commonMistakes: ['常见错误 1：忽略边界条件'],
    difficulty: 3,
  };
  res.json({ content: JSON.stringify(result) });
});

app.listen(PORT, () => {
  console.log(`MistakeNote server running on http://localhost:${PORT}`);
});
