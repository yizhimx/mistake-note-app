import { recognizeText } from './ocrService';
import { getAiConfig } from './aiConfig';
import { directTextChat, directVisionChat } from './directAi';
import { buildTagsPrompt, parseTagsJson } from '../utils/aiParsing';

export interface AIAnalysisResult {
  correctAnswer: string;
  steps: string[];
  knowledgePoints: string[];
  commonMistakes: string[];
  difficulty: 1 | 2 | 3 | 4 | 5;
}

/** JSON 解析失败时抛出，携带 AI 原始输出以便 UI 提供手动修正对话框 */
export class AnalysisParseError extends Error {
  rawText: string;
  constructor(rawText: string) {
    super('AI 返回内容无法解析为 JSON，请手动修正');
    this.name = 'AnalysisParseError';
    this.rawText = rawText;
  }
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
        throw new AnalysisParseError(text);
      }
    }
    throw new AnalysisParseError(text);
  }
}

/** 供 UI 在手动修正对话框中重新解析用户编辑后的文本 */
export function parseAnalysis(text: string): AIAnalysisResult {
  return extractAndFixJSON(text);
}

// ============ AI 辅助录入（仿 MathCyclus，内容以 Markdown 存储） ============

export interface RecognizeResult {
  /** 识别出的题目内容（Markdown 文本，公式用 $...$ / $$...$$） */
  content: string;
  /** 难度星级 1-5 */
  difficulty: number;
  /** 识别出的科目 */
  subject: string;
  /** 自动生成的知识板块标签 */
  knowledgeAreas: string[];
}

/**
 * 截图识别 + 科目/难度/知识板块生成。
 * 1) 视觉模型把题目图片转写为 Markdown 文本（ocrService）
 * 2) 文本模型根据内容生成科目、难度星级与知识板块标签
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
  let tags: { difficulty: number; subject: string; knowledgeAreas: string[] };
  try {
    tags = parseTagsJson(resContent);
  } catch {
    tags = { difficulty: 3, subject: '', knowledgeAreas: [] };
  }

  return {
    content,
    difficulty: tags.difficulty,
    subject: tags.subject,
    knowledgeAreas: tags.knowledgeAreas,
  };
}

/**
 * 笔记扫描识别：用视觉模型把图片转写为 Markdown（不依赖 OCR 接口，识别由 AI 完成）。
 */
export async function recognizeNoteFromImage(dataUrl: string): Promise<string> {
  const config = getAiConfig();
  if (!config.aiApiKey) {
    throw new Error('未配置 AI API Key，请先在设置中填写');
  }
  const prompt = '请识别图片中的笔记或题目内容，以 Markdown 格式输出。公式用 $...$ 或 $$...$$ 表示，保留原有的层级结构、列表和重点标注。';
  const content = await directVisionChat(prompt, dataUrl, {
    temperature: 0.2,
    systemPrompt: 'You are a precise document transcription assistant.',
  });
  return content.trim();
}
