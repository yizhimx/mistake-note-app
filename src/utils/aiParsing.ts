export interface ParsedTags {
  difficulty: number;
  subject: string;
  knowledgeAreas: string[];
}

export function buildTagsPrompt(content: string): string {
  return `你是一个专业的教研专家。请分析以下题目内容，给出科目、难度星级和知识板块标签。

要求：
1. 科目：从以下列表中选择最匹配的一个（数学、物理、化学、英语、语文、生物、历史、地理、政治）。
2. 难度星级：1 到 5 的整数（1 最简单，5 最难）。
3. 知识板块：提取 2-4 个最核心的考点板块（中文，用中文逗号“，”分隔，例如“函数，导数”）。
4. 必须严格以 JSON 格式输出，不要输出任何额外解释文本。

格式如下：
{
  "subject": "数学",
  "difficulty": 3,
  "knowledgeAreas": "函数，导数，极值"
}

题目内容：
${content}`;
}

export function parseTagsJson(text: string): ParsedTags {
  let cleaned = (text || '').trim();
  const m = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m && m[1]) cleaned = m[1].trim();
  const braceStart = cleaned.indexOf('{');
  const braceEnd = cleaned.lastIndexOf('}');
  if (braceStart !== -1 && braceEnd !== -1) cleaned = cleaned.slice(braceStart, braceEnd + 1);

  const data = JSON.parse(cleaned) as { difficulty?: number; subject?: string; knowledgeAreas?: string };
  const difficulty = Math.min(5, Math.max(1, Math.round(Number(data.difficulty) || 3)));
  const subject = String(data.subject || '').trim();
  const knowledgeAreas = String(data.knowledgeAreas || '')
    .split(/[，,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);
  return { difficulty, subject, knowledgeAreas };
}
