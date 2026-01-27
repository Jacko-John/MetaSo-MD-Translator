/**
 * 段落标记工具
 * 使用单分隔符标记确保翻译后段落与原文一一对应
 */

import type { ParagraphInfo } from '../types';
import type { MarkerExtractionResult } from '@/types';
import { isEmptyParagraph } from './markdownProcessor';

/**
 * 为段落注入唯一分隔符
 *
 * @param batch - 段落数组
 * @returns 注入分隔符后的文本
 *
 * @example
 * ```ts
 * const batch = [
 *   { text: 'First paragraph', itemIndex: 0, paragraphIndex: 0, estimatedTokens: 5 },
 *   { text: 'Second paragraph', itemIndex: 0, paragraphIndex: 1, estimatedTokens: 5 }
 * ];
 * const marked = injectMarkers(batch);
 * // 结果：
 * // First paragraph
 * //
 * // [[__META_SO_PARA_0__]]
 * //
 * // Second paragraph
 * //
 * // [[__META_SO_PARA_1__]]
 * ```
 */
export function injectMarkers(batch: ParagraphInfo[]): string {
  return batch.map((para, index) => {
    return `${para.text.trim()}\n\n[[__META_SO_PARA_${index}__]]`;
  }).join('\n\n');
}

/**
 * 从翻译结果中提取分隔符间的段落内容
 *
 * @param translatedContent - AI 翻译后的文本
 * @param expectedCount - 期望的段落数量
 * @returns 提取结果和标记完整性信息
 *
 * @example
 * ```ts
 * const translated = `
 *   第一段
 *
 *   [[__META_SO_PARA_0__]]
 *
 *   第二段
 *
 *   [[__META_SO_PARA_1__]]
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

  // 正则匹配 [[__META_SO_PARA_n__]] 分隔符
  const markerPattern = /\[\[__META_SO_PARA_(\d+)__\]\]/g;
  const matches = Array.from(translatedContent.matchAll(markerPattern));

  // 提取段落内容
  // 每个分隔符之前的文本是该分隔符所标记的段落的翻译
  // 从文本开头到第一个分隔符之前是第0段
  // 从分隔符0到分隔符1之间是第1段
  // 以此类推
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const markerIndex = parseInt(match[1]);

    // 检查重复标记
    if (foundMarkers.has(markerIndex)) {
      duplicateMarkers.push(markerIndex);
      console.warn(`[Background] 重复的分隔符: PARA_${markerIndex}`);
    }
    foundMarkers.add(markerIndex);

    // 确定内容边界
    const contentStart = i === 0 ? 0 : matches[i - 1].index! + matches[i - 1][0].length;
    const contentEnd = match.index!;
    let content = translatedContent.slice(contentStart, contentEnd);

    // 清理内容：移除首尾空白，但保留内部结构
    content = content.trim();

    // 移除可能残留的分隔符（防御性清理）
    content = content.replace(/\[\[__META_SO_PARA_\d+__\]\]/g, '').trim();

    paragraphs[markerIndex] = content;

    if (isEmptyParagraph(content)) {
      console.warn(`[Background] 段落 ${markerIndex}: AI 返回了空翻译`);
    }
  }

  // 处理最后一个分隔符之后的内容
  if (matches.length > 0) {
    const lastMatch = matches[matches.length - 1];
    const lastMarkerIndex = parseInt(lastMatch[1]);
    const contentStart = lastMatch.index! + lastMatch[0].length;
    let content = translatedContent.slice(contentStart).trim();

    // 移除可能残留的分隔符
    content = content.replace(/\[\[__META_SO_PARA_\d+__\]\]/g, '').trim();

    // 最后一个分隔符之后是下一个段落的翻译
    const nextIndex = lastMarkerIndex + 1;
    if (nextIndex < expectedCount) {
      paragraphs[nextIndex] = content;
      foundMarkers.add(nextIndex);
      if (isEmptyParagraph(content)) {
        console.warn(`[Background] 段落 ${nextIndex}: AI 返回了空翻译`);
      }
    }
  }

  // 检测缺失的标记
  for (let i = 0; i < expectedCount; i++) {
    if (!foundMarkers.has(i)) {
      missingMarkers.push(i);
    }
  }

  // 记录提取报告
  console.log('[Background] === 分隔符提取报告 ===');
  console.log('[Background] 期望段落数:', expectedCount);
  console.log('[Background] 找到段落数:', foundMarkers.size);
  console.log('[Background] 缺失段落:', missingMarkers);
  console.log('[Background] 重复分隔符:', duplicateMarkers);
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
