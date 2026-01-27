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
 * 判断是否为空段落
 * 空段落包括：空字符串、纯空白字符、只包含换行符的段落
 */
export function isEmptyParagraph(text: string): boolean {
  if (!text) return true;
  const trimmed = text.trim();
  return trimmed.length === 0;
}

/**
 * 清理 MetaSo API 响应中的空段落
 * 返回清理后的响应副本
 */
export function cleanEmptyParagraphs(content: MetaSoApiResponse): MetaSoApiResponse {
  const cleaned = { ...content };

  if (cleaned.data && Array.isArray(cleaned.data.markdown)) {
    cleaned.data = {
      ...cleaned.data,
      markdown: cleaned.data.markdown.map(item => ({
        ...item,
        markdown: Array.isArray(item.markdown)
          ? item.markdown.filter(p => !isEmptyParagraph(p))
          : item.markdown
      }))
    };
  }

  return cleaned;
}

/**
 * 从 MetaSo API 响应中提取 markdown 文本
 * 自动过滤空段落
 */
export function extractMarkdownText(content: MetaSoApiResponse): MarkdownExtractionResult {
  try {
    const data = content.data;

    if (data && Array.isArray(data.markdown)) {
      const allMarkdown: string[] = [];
      data.markdown.forEach((item) => {
        if (item.markdown && Array.isArray(item.markdown)) {
          // 过滤空段落
          const nonEmptyParagraphs = item.markdown.filter(p => !isEmptyParagraph(p));
          allMarkdown.push(...nonEmptyParagraphs);
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
 * 自动过滤空段落
 */
export function flattenMarkdownItems(items: MetaSoMarkdownItem[]): ParagraphInfo[] {
  const paragraphs: ParagraphInfo[] = [];

  items.forEach((item, itemIndex) => {
    if (item.markdown && Array.isArray(item.markdown)) {
      item.markdown.forEach((paragraph, paragraphIndex) => {
        // 过滤空段落
        if (!isEmptyParagraph(paragraph)) {
          paragraphs.push({
            text: paragraph,
            itemIndex,
            paragraphIndex,
            estimatedTokens: estimateTokens(paragraph)
          });
        }
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
 * 注意：原始内容已经清理过空段落，所以这里直接使用
 */
export function assembleTranslatedContent(
  originalItems: MetaSoMarkdownItem[],
  translatedParagraphs: Map<string, string>
): MetaSoMarkdownItem[] {
  return originalItems.map((item, itemIndex) => {
    const translatedMarkdown: string[] = [];

    item.markdown.forEach((_, paragraphIndex) => {
      const key = `${itemIndex}-${paragraphIndex}`;
      const translatedText = translatedParagraphs.get(key);

      // 只有当翻译文本存在且不为空时才添加
      if (translatedText && !isEmptyParagraph(translatedText)) {
        translatedMarkdown.push(translatedText);
      }
    });

    return {
      markdown_lang: translatedMarkdown,
      markdown: item.markdown,
      page: item.page,
      could_translate: true
    };
  });
}
