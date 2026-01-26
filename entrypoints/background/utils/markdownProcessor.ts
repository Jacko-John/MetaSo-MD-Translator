import type { MetaSoApiResponse, MetaSoMarkdownItem } from '@/types';
import type { MarkdownExtractionResult, ParagraphInfo } from '../types';
import { CONFIG } from '../constants';

/**
 * 估算文本的 token 数量
 */
export function estimateTokens(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars / 2) + Math.ceil(otherChars / 4);
}

/**
 * 从 MetaSo API 响应中提取 markdown 文本
 */
export function extractMarkdownText(content: MetaSoApiResponse): MarkdownExtractionResult {
  try {
    const data = content.data;

    if (data && Array.isArray(data.markdown)) {
      const allMarkdown: string[] = [];
      data.markdown.forEach((item) => {
        if (item.markdown && Array.isArray(item.markdown)) {
          allMarkdown.push(...item.markdown);
        }
      });
      const text = allMarkdown.join('\n');
      return { text, estimatedTokens: estimateTokens(text) };
    }
  } catch (error) {
    console.warn('[Background] 无法提取 markdown:', error, '原始数据:', content);
  }

  return { text: '', estimatedTokens: 0 };
}

/**
 * 将 markdown 项展平为段落列表
 */
export function flattenMarkdownItems(items: MetaSoMarkdownItem[]): ParagraphInfo[] {
  const paragraphs: ParagraphInfo[] = [];

  items.forEach((item, itemIndex) => {
    if (item.markdown && Array.isArray(item.markdown)) {
      item.markdown.forEach((paragraph, paragraphIndex) => {
        paragraphs.push({
          text: paragraph,
          itemIndex,
          paragraphIndex,
          estimatedTokens: estimateTokens(paragraph)
        });
      });
    }
  });

  return paragraphs;
}

/**
 * 将段落按 token 限制智能分批
 */
export function batchParagraphs(paragraphs: ParagraphInfo[], maxTokens: number): ParagraphInfo[][] {
  const batches: ParagraphInfo[][] = [];
  let currentBatch: ParagraphInfo[] = [];
  let currentBatchTokens = 0;

  const safeMaxTokens = maxTokens - CONFIG.TRANSLATION.SAFE_TOKEN_MARGIN;

  for (const paragraph of paragraphs) {
    const estimatedTokens = paragraph.estimatedTokens;

    if (estimatedTokens > safeMaxTokens) {
      if (currentBatch.length > 0) {
        batches.push(currentBatch);
        currentBatch = [];
        currentBatchTokens = 0;
      }
      batches.push([paragraph]);
      continue;
    }

    if (currentBatchTokens + estimatedTokens > safeMaxTokens && currentBatch.length > 0) {
      batches.push(currentBatch);
      currentBatch = [];
      currentBatchTokens = 0;
    }

    currentBatch.push(paragraph);
    currentBatchTokens += estimatedTokens;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

/**
 * 组装翻译后的内容
 */
export function assembleTranslatedContent(
  originalItems: MetaSoMarkdownItem[],
  translatedParagraphs: Map<string, string>
): MetaSoMarkdownItem[] {
  return originalItems.map((item, itemIndex) => ({
    markdown_lang: item.markdown.map((_, paragraphIndex) => {
      const key = `${itemIndex}-${paragraphIndex}`;
      return translatedParagraphs.get(key) || '';
    }),
    markdown: item.markdown,
    page: item.page,
    could_translate: true
  }));
}
