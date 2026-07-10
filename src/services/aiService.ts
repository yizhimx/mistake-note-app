import { api } from './api';
import { recognizeText } from './ocrService';

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

  if (!ocrText && imageUrls.length > 0) {
    ocrText = await recognizeText(imageUrls[0]);
  }

  if (!ocrText) {
    throw new Error('未识别到文字，请确认图片清晰度或手动输入题目文本');
  }

  const prompt = `${ANALYSIS_PROMPT}\n\n题目：${ocrText}`;
  const response = await api.aiAnalyze(prompt);

  const analysis = extractAndFixJSON(response.content);
  return { ocrText, analysis };
}

function extractAndFixJSON(text: string): AIAnalysisResult {
  let cleaned = text.trim();

  const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
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
