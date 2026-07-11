import { marked } from 'marked';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { getCachedImage, preloadFromMarkdown } from '@/services/imageStore';

const PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

function renderKatex(text: string): string {
  return text
    .replace(/\$\$([\s\S]*?)\$\$/g, (_m: string, math: string) => {
      try { return katex.renderToString(math.trim(), { displayMode: true, throwOnError: false }); }
      catch { return `<div class="katex-error">${math.trim()}</div>`; }
    })
    .replace(/\$([^$\n]+?)\$/g, (_m: string, math: string) => {
      try { return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false }); }
      catch { return `<span class="katex-error">${math.trim()}</span>`; }
    });
}

function resolveImages(text: string): string {
  return text.replace(/!\[([^\]]*)\]\((local:[^)]+)\)/g, (_m: string, alt: string, ref: string) => {
    const dataUrl = getCachedImage(ref);
    return `![${alt}](${dataUrl || PLACEHOLDER})`;
  });
}

marked.setOptions({
  breaks: true,
  gfm: true,
});

export function renderMarkdown(text: string): string {
  const resolved = resolveImages(text);
  const processed = renderKatex(resolved);
  const html = marked.parse(processed) as string;
  return html;
}

export async function buildExportHtml(mistakes: Array<{
  title: string;
  content?: string;
  imageUrls: string[];
  answer: string;
  answerImages: string[];
  aiAnalysis: string | null;
  subject: string;
  difficulty: number;
  tags: string[];
  knowledgePoints: string[];
  notes: string;
  createdAt: string;
  reviewCount: number;
  masteryLevel: string | null;
}>): Promise<string> {
  for (const m of mistakes) {
    await preloadFromMarkdown(m.content || '');
    await preloadFromMarkdown(m.answer || '');
  }
  const items = mistakes.map((m, idx) => {
    const contentHtml = m.content ? renderMarkdown(m.content) : '';
    const imagesHtml = m.imageUrls.map(url =>
      `<img src="${url}" style="max-width:100%;max-height:300px;object-fit:contain;margin-bottom:8px" />`
    ).join('');

    let answerHtml = m.answer ? renderMarkdown(m.answer) : '';
    const answerImagesHtml = m.answerImages.map(url =>
      `<img src="${url}" style="max-width:100%;max-height:300px;object-fit:contain;margin-bottom:8px" />`
    ).join('');

    let aiHtml = '';
    if (m.aiAnalysis) {
      try {
        const parsed = JSON.parse(m.aiAnalysis);
        aiHtml = `<div class="ai-section">
          <h3>AI 分析</h3>
          ${parsed.analysis ? `<p>${parsed.analysis}</p>` : ''}
          ${parsed.correctAnswer ? `<p><strong>正确答案：</strong>${parsed.correctAnswer}</p>` : ''}
          ${parsed.steps ? `<ol>${parsed.steps.map((s: string) => `<li>${s}</li>`).join('')}</ol>` : ''}
        </div>`;
      } catch {
        aiHtml = `<div class="ai-section"><h3>AI 分析</h3><p>${m.aiAnalysis}</p></div>`;
      }
    }

    const masteryMap: Record<string, string> = { fresh: '生疏', hesitant: '犹豫', smooth: '顺利' };

    return `<div class="mistake-item">
      <h2>${idx + 1}. ${m.title || '未命名错题'}</h2>
      <table class="meta-table">
        <tr><td>科目</td><td>${m.subject || '未分类'}</td></tr>
        <tr><td>难度</td><td>${m.difficulty || '-'}</td></tr>
        <tr><td>标签</td><td>${m.tags.join(', ') || '-'}</td></tr>
        <tr><td>知识点</td><td>${m.knowledgePoints.join(', ') || '-'}</td></tr>
        <tr><td>掌握度</td><td>${m.masteryLevel ? masteryMap[m.masteryLevel] || m.masteryLevel : '未掌握'}</td></tr>
        <tr><td>复习次数</td><td>${m.reviewCount}</td></tr>
        <tr><td>录入时间</td><td>${m.createdAt.slice(0, 10)}</td></tr>
        <tr><td>备注</td><td>${m.notes || '-'}</td></tr>
      </table>
      ${contentHtml || imagesHtml}
      ${answerHtml}
      ${answerImagesHtml}
      ${aiHtml}
    </div>`;
  }).join('<hr>');

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body { font-family: 'Microsoft YaHei', sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
  h1 { text-align: center; color: #333; }
  .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  .meta-table td { padding: 4px 8px; border: 1px solid #ddd; }
  .meta-table td:first-child { font-weight: bold; width: 80px; background: #f5f5f5; }
  .mistake-item { page-break-inside: avoid; margin-bottom: 20px; }
  .ai-section { background: #f0f7ff; padding: 10px; border-radius: 6px; margin-top: 8px; }
  hr { margin: 24px 0; border: none; border-top: 2px solid #eee; }
  img { margin: 4px 0; border: 1px solid #ddd; border-radius: 4px; max-width: 100%; }
  pre { background: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto; }
  code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
  ul { padding-left: 20px; }
  ol { padding-left: 20px; }
  .katex { font-size: 1.1em; }
  .katex-error { color: red; }
</style></head><body>
  <h1>错题导出</h1>
  <p style="text-align:center;color:#666">导出时间：${new Date().toLocaleString()}</p>
  <p style="text-align:center;color:#666">共 ${mistakes.length} 道错题</p>
  ${items}
</body></html>`;
}
