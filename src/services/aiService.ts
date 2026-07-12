import { recognizeText } from './ocrService';
import { getAiConfig } from './aiConfig';
import { directTextChat } from './directAi';

export interface AIAnalysisResult {
  correctAnswer: string;
  steps: string[];
  knowledgePoints: string[];
  commonMistakes: string[];
  difficulty: 1 | 2 | 3 | 4 | 5;
}

const ANALYSIS_PROMPT = `请分析以下错题，返回严格JSON格式（不要包裹markdown代码块）：
{
  "correctAnswer": "正确答案",
  "steps": ["步骤1", "步骤2"],
  "knowledgePoints": ["知识点1", "知识点2"],
  "commonMistakes": ["常见错误1"],
  "difficulty": 3
}`;

export async function analyzeMistake(
  imageUrls: string[],
  existingText?: string,
): Promise<{
  ocrText: string;
  analysis: AIAnalysisResult;
}> {
  let ocrText = existingText || '';

  if (!ocrText && imageUrls.length > 0 && imageUrls[0]) {
    ocrText = await recognizeText(imageUrls[0]);
  }

  if (!ocrText) {
    throw new Error('未识别到文字，请确认图片清晰度或手动输入题目文本');
  }

  const prompt = `${ANALYSIS_PROMPT}\n\n题目：${ocrText}`;
  const content = await directTextChat(prompt, { temperature: 0.3 });
  const analysis = extractAndFixJSON(content);
  return { ocrText, analysis };
}

function extractAndFixJSON(text: string): AIAnalysisResult {
  let cleaned = text.trim();

  const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch && jsonMatch[1]) {
    cleaned = jsonMatch[1].trim();
  }

  try {
    return JSON.parse(cleaned) as AIAnalysisResult;
  } catch {
    const braceStart = cleaned.indexOf('{');
    const braceEnd = cleaned.lastIndexOf('}');
    if (braceStart !== -1 && braceEnd !== -1) {
      const jsonStr = cleaned.slice(braceStart, braceEnd + 1);
      try {
        return JSON.parse(jsonStr) as AIAnalysisResult;
      } catch {
        throw new Error(
          `无法解析 AI 返回结果为 JSON。原始内容：\n${text}`,
        );
      }
    }
    throw new Error(
      `无法解析 AI 返回结果为 JSON。原始内容：\n${text}`,
    );
  }
}

// ============ AI 辅助录入（仿 MathCyclus，内容以 Markdown 存储） ============

export interface RecognizeResult {
  /** 识别出的题目内容（Markdown 文本，公式用 $...$ / $$...$$） */
  content: string;
  /** 难度星级 1-5 */
  difficulty: number;
  /** 自动生成的知识点标签 */
  knowledgePoints: string[];
}

function buildTagsPrompt(content: string): string {
  return `你是一个专业的教研专家。请分析以下题目内容，给出难度星级和知识点标签。

要求：
1. 难度星级：1 到 5 的整数（1 最简单，5 最难）。
2. 知识点标签：提取 2-4 个最核心的考点标签（中文，用中文逗号“，”分隔）。
3. 必须严格以 JSON 格式输出，不要输出任何额外解释文本。

格式如下：
{
  "difficulty": 3,
  "tags": "标签1，标签2，标签3"
}

题目内容：
${content}`;
}

function parseTagsJson(text: string): { difficulty: number; knowledgePoints: string[] } {
  let cleaned = (text || '').trim();
  const m = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m && m[1]) cleaned = m[1].trim();
  const braceStart = cleaned.indexOf('{');
  const braceEnd = cleaned.lastIndexOf('}');
  if (braceStart !== -1 && braceEnd !== -1) cleaned = cleaned.slice(braceStart, braceEnd + 1);

  const data = JSON.parse(cleaned) as { difficulty?: number; tags?: string };
  const difficulty = Math.min(5, Math.max(1, Math.round(Number(data.difficulty) || 3)));
  const knowledgePoints = String(data.tags || '')
    .split(/[，,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);
  return { difficulty, knowledgePoints };
}

/**
 * 截图识别 + 知识点/难度生成。
 * 1) 视觉模型把题目图片转写为 Markdown 文本（ocrService）
 * 2) 文本模型根据内容生成难度星级与知识点标签
 */
export async function recognizeMistakeFromImage(dataUrl: string): Promise<RecognizeResult> {
  const config = getAiConfig();
  if (!config.aiApiKey) {
    throw new Error('未配置 AI API Key，请先在设置中填写');
  }

  const content = await recognizeText(dataUrl);
  if (!content.trim()) {
    throw new Error('OCR 未识别到题目内容，请确认图片清晰度');
  }

  const resContent = await directTextChat(buildTagsPrompt(content), { temperature: 0.3, systemPrompt: 'You are a teaching expert.' });
  let tags: { difficulty: number; knowledgePoints: string[] };
  try {
    tags = parseTagsJson(resContent);
  } catch {
    tags = { difficulty: 3, knowledgePoints: [] };
  }

  return {
    content,
    difficulty: tags.difficulty,
    knowledgePoints: tags.knowledgePoints,
  };
}
