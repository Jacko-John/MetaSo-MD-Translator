/**
 * 段落标记工具
 * 使用 HTML 注释标记确保翻译后段落与原文一一对应
 */

import type { ParagraphInfo } from '../types';
import type { MarkerExtractionResult } from '@/types';

/**
 * 为段落注入唯一标记
 *
 * @param batch - 段落数组
 * @returns 注入标记后的文本
 *
 * @example
 * ```ts
 * const batch = [
 *   { text: 'First paragraph', itemIndex: 0, paragraphIndex: 0, estimatedTokens: 5 },
 *   { text: 'Second paragraph', itemIndex: 0, paragraphIndex: 1, estimatedTokens: 5 }
 * ];
 * const marked = injectMarkers(batch);
 * // 结果：
 * // <!-- META_SO_PARA_0 -->
 * // First paragraph
 * // <!-- META_SO_PARA_0 -->
 * //
 * // <!-- META_SO_PARA_1 -->
 * // Second paragraph
 * // <!-- META_SO_PARA_1 -->
 * ```
 */
export function injectMarkers(batch: ParagraphInfo[]): string {
  return batch.map((para, index) => {
    const marker = `<!-- META_SO_PARA_${index} -->`;
    return `${marker}\n${para.text.trim()}\n${marker}`;
  }).join('\n\n');
}

/**
 * 从翻译结果中提取标记间的段落内容
 *
 * @param translatedContent - AI 翻译后的文本
 * @param expectedCount - 期望的段落数量
 * @returns 提取结果和标记完整性信息
 *
 * @example
 * ```ts
 * const translated = `
 *   <!-- META_SO_PARA_0 -->
 *   第一段
 *   <!-- META_SO_PARA_0 -->
 *   <!-- META_SO_PARA_1 -->
 *   第二段
 *   <!-- META_SO_PARA_1 -->
 * `;
 * const result = extractTranslatedParagraphs(translated, 2);
 * // result.paragraphs = ['第一段', '第二段']
 * // result.missingMarkers = []
 * // result.foundMarkers = Set(0, 1)
 * ```
 */
export function extractTranslatedParagraphs(
  translatedContent: string,
  expectedCount: number
): MarkerExtractionResult {
  const paragraphs: string[] = [];
  const missingMarkers: number[] = [];
  const duplicateMarkers: number[] = [];
  const foundMarkers = new Set<number>();

  // 正则匹配 <!-- META_SO_PARA_n --> 标记
  // 使用非贪婪匹配和忽略大小写
  const markerPattern = /<!--\s*META_SO_PARA_(\d+)\s*-->/gi;
  const matches = Array.from(translatedContent.matchAll(markerPattern));

  // 检查标记成对出现
  if (matches.length % 2 !== 0) {
    console.warn('[Background] 标记数量为奇数，可能存在不完整对');
  }

  // 提取段落内容
  for (let i = 0; i < matches.length; i += 2) {
    const startMatch = matches[i];
    const endMatch = matches[i + 1];

    if (!startMatch || !endMatch) {
      continue;
    }

    const startIndex = parseInt(startMatch[1]);
    const endIndex = parseInt(endMatch[1]);

    // 验证标记配对
    if (startIndex !== endIndex) {
      console.warn(`[Background] 标记不匹配: START=${startIndex}, END=${endIndex}`);
      continue;
    }

    // 检查重复标记
    if (foundMarkers.has(startIndex)) {
      duplicateMarkers.push(startIndex);
      console.warn(`[Background] 重复的标记: PARA_${startIndex}`);
    }
    foundMarkers.add(startIndex);

    // 提取标记之间的内容
    const contentStart = startMatch.index! + startMatch[0].length;
    const contentEnd = endMatch.index!;
    let content = translatedContent.slice(contentStart, contentEnd);

    // 清理内容：移除首尾空白，但保留内部结构
    content = content.trim();

    // 移除可能残留的标记（防御性清理）
    content = content.replace(/<!--\s*META_SO_PARA_\d+\s*-->/gi, '').trim();

    paragraphs[startIndex] = content;
  }

  // 检测缺失的标记
  for (let i = 0; i < expectedCount; i++) {
    if (!foundMarkers.has(i)) {
      missingMarkers.push(i);
    }
  }

  // 记录提取报告
  console.log('[Background] === 标记提取报告 ===');
  console.log('[Background] 期望标记数:', expectedCount);
  console.log('[Background] 找到标记数:', foundMarkers.size);
  console.log('[Background] 缺失标记:', missingMarkers);
  console.log('[Background] 重复标记:', duplicateMarkers);
  console.log('[Background] ===================');

  return {
    paragraphs,
    missingMarkers,
    duplicateMarkers,
    foundMarkers
  };
}

/**
 * 验证标记完整性
 *
 * @param result - 提取结果
 * @returns 是否所有标记都完整
 */
export function validateMarkerIntegrity(result: MarkerExtractionResult): boolean {
  return result.missingMarkers.length === 0 && result.duplicateMarkers.length === 0;
}

export type { MarkerExtractionResult };
