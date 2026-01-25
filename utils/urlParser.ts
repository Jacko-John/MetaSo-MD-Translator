// URL Parser for MetaSo API

import type { ParsedMetaSoUrl } from '@/types';

/**
 * MetaSo API URL 正则表达式
 * 匹配: https://metaso.cn/api/file/{fileId}/pdf-markdown/{pageId}[?lang=xx]
 */
const METASO_URL_PATTERN = /^https:\/\/metaso\.cn\/api\/file\/(\d+)\/pdf-markdown\/([\d-]+)(\?.*)?$/;

/**
 * 解析 MetaSo API URL
 * @param url - 要解析的 URL
 * @returns 解析结果或 null（如果不匹配）
 */
export function parseMetaSoUrl(url: string): ParsedMetaSoUrl | null {
  try {
    // 如果是相对路径，尝试转换为绝对路径
    let absoluteUrl = url;
    if (url.startsWith('/')) {
      absoluteUrl = `https://metaso.cn${url}`;
    }

    const match = absoluteUrl.match(METASO_URL_PATTERN);

    if (!match) {
      return null;
    }

    const [, fileId, pageId, queryString] = match;
    const hasLangParam = queryString?.includes('lang=') || false;

    // 提取 lang 参数值
    let lang: string | undefined;
    if (hasLangParam && queryString) {
      const urlParams = new URLSearchParams(queryString);
      lang = urlParams.get('lang') || undefined;
    }

    return {
      fileId,
      pageId,
      hasLangParam,
      lang
    };
  } catch (error) {
    console.error('[URLParser] Failed to parse URL:', url, error);
    return null;
  }
}

/**
 * 从 URL 生成内容 ID
 * @param url - MetaSo API URL
 * @returns 内容 ID (fileId-pageId)
 */
export function generateContentId(url: string): string | null {
  const parsed = parseMetaSoUrl(url);
  if (!parsed) {
    return null;
  }
  return `${parsed.fileId}-${parsed.pageId}`;
}

/**
 * 构建完整的 MetaSo API URL
 * @param fileId - 文件 ID
 * @param pageId - 页面 ID
 * @param lang - 语言参数（可选）
 * @returns 完整 URL
 */
export function buildMetaSoUrl(fileId: string, pageId: string, lang?: string): string {
  const baseUrl = `https://metaso.cn/api/file/${fileId}/pdf-markdown/${pageId}`;
  if (lang) {
    return `${baseUrl}?lang=${lang}`;
  }
  return baseUrl;
}

/**
 * 检查 URL 是否是 MetaSo API URL
 * @param url - 要检查的 URL
 * @returns 是否是 MetaSo API URL
 */
export function isMetaSoUrl(url: string): boolean {
  return parseMetaSoUrl(url) !== null;
}

/**
 * 从 URL 中提取基础 URL（不带查询参数）
 * @param url - MetaSo API URL
 * @returns 基础 URL
 */
export function getBaseUrl(url: string): string | null {
  const parsed = parseMetaSoUrl(url);
  if (!parsed) {
    return null;
  }
  return buildMetaSoUrl(parsed.fileId, parsed.pageId);
}
