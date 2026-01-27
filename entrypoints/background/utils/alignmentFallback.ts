/**
 * 段落对齐回退策略
 * 当标记被 AI 删除或损坏时，使用分级回退机制确保翻译继续进行
 */

import type { ParagraphInfo } from '../types';
import type { MarkerExtractionResult, FallbackResult } from '@/types';
import { FallbackLevel } from '@/types';

/**
 * 应用回退策略
 *
 * 根据标记完整性自动选择合适的回退策略：
 * - PERFECT: 直接使用提取的内容
 * - MINOR: 缺失段落使用原文
 * - MODERATE: 启发式匹配
 * - SEVERE: 行数匹配（当前逻辑）
 * - FAILURE: 保留所有原文
 *
 * @param extractionResult - 标记提取结果
 * @param originalBatch - 原始段落数组
 * @param translatedContent - AI 翻译的完整内容（用于行数回退）
 * @returns 回退结果
 */
export function applyFallbackStrategy(
  extractionResult: MarkerExtractionResult,
  originalBatch: ParagraphInfo[],
  translatedContent: string
): FallbackResult {
  const { paragraphs, missingMarkers, duplicateMarkers } = extractionResult;
  const totalCount = originalBatch.length;
  const missingCount = missingMarkers.length;

  // 计算缺失比例
  const missingRatio = totalCount > 0 ? missingCount / totalCount : 1;

  // 确定回退级别
  let level: FallbackLevel;
  if (missingCount === 0 && duplicateMarkers.length === 0) {
    level = FallbackLevel.PERFECT;
  } else if (missingRatio < 0.1) {
    level = FallbackLevel.MINOR_ISSUES;
  } else if (missingRatio < 0.3) {
    level = FallbackLevel.MODERATE_ISSUES;
  } else if (missingRatio < 1.0) {
    level = FallbackLevel.SEVERE_ISSUES;
  } else {
    level = FallbackLevel.COMPLETE_FAILURE;
  }

  // 根据级别应用策略
  switch (level) {
    case FallbackLevel.PERFECT:
      return {
        level,
        paragraphs,
        missingCount,
        totalCount,
        appliedStrategy: 'All markers found - using extracted paragraphs directly'
      };

    case FallbackLevel.MINOR_ISSUES:
      // 对缺失的段落使用原文本
      return {
        level,
        paragraphs: fillMissingWithOriginal(paragraphs, missingMarkers, originalBatch),
        missingCount,
        totalCount,
        appliedStrategy: `Minor issues: filling ${missingCount} missing paragraphs with original text`
      };

    case FallbackLevel.MODERATE_ISSUES:
      // 尝试使用启发式匹配
      return {
        level,
        paragraphs: applyHeuristicMatching(
          paragraphs,
          missingMarkers,
          originalBatch,
          translatedContent
        ),
        missingCount,
        totalCount,
        appliedStrategy: `Moderate issues: applying heuristic matching for ${missingCount} missing paragraphs`
      };

    case FallbackLevel.SEVERE_ISSUES:
      // 使用基于行数的回退（当前逻辑）
      console.warn('[Background] Severe marker loss, falling back to line-based matching');
      return {
        level,
        paragraphs: fallbackToLineBased(originalBatch, translatedContent),
        missingCount,
        totalCount,
        appliedStrategy: `Severe issues: falling back to legacy line-based matching`
      };

    case FallbackLevel.COMPLETE_FAILURE:
      // 完全失败，保留原文
      console.error('[Background] All markers lost, preserving original text');
      return {
        level,
        paragraphs: originalBatch.map(p => p.text),
        missingCount,
        totalCount,
        appliedStrategy: 'Complete failure: preserving all original text'
      };
  }
}

/**
 * 用原文填充缺失的段落
 *
 * @param paragraphs - 已提取的段落数组
 * @param missingMarkers - 缺失的标记索引
 * @param originalBatch - 原始段落信息
 * @returns 填充后的段落数组
 */
function fillMissingWithOriginal(
  paragraphs: string[],
  missingMarkers: number[],
  originalBatch: ParagraphInfo[]
): string[] {
  const result = [...paragraphs];

  missingMarkers.forEach(index => {
    if (originalBatch[index]) {
      result[index] = originalBatch[index].text;
      console.log(`[Background] 段落 ${index}: ${result[index]}`);
      console.warn(`[Background] 段落 ${index}: using original text as fallback`);
    }
  });

  return result;
}

/**
 * 启发式匹配：尝试基于相似度匹配缺失的段落
 *
 * @param paragraphs - 已提取的段落数组
 * @param missingMarkers - 缺失的标记索引
 * @param originalBatch - 原始段落信息
 * @param translatedContent - 完整的翻译内容
 * @returns 匹配后的段落数组
 */
function applyHeuristicMatching(
  paragraphs: string[],
  missingMarkers: number[],
  originalBatch: ParagraphInfo[],
  translatedContent: string
): string[] {
  const result = [...paragraphs];
  const translatedLines = translatedContent.split('\n').map(s => s.trim()).filter(s => s);

  // 对每个缺失的标记，尝试找到最相似的翻译行
  missingMarkers.forEach(markerIndex => {
    const originalText = originalBatch[markerIndex]?.text;
    if (!originalText) return;

    // 计算与每个翻译行的相似度
    let bestMatch = '';
    let bestScore = -1;
    let bestLineIndex = -1;

    translatedLines.forEach((line, lineIndex) => {
      // 计算相似度
      const score = calculateSimilarity(originalText, line);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = line;
        bestLineIndex = lineIndex;
      }
    });

    // 如果相似度足够高，使用匹配的翻译；否则使用原文
    if (bestScore > 0.5) {
      result[markerIndex] = bestMatch;
      console.warn(`[Background] 段落 ${markerIndex}: using heuristic match (score: ${bestScore.toFixed(2)})`);
    } else {
      result[markerIndex] = originalText;
      console.warn(`[Background] 段落 ${markerIndex}: no good match found, using original text`);
    }
  });

  return result;
}

/**
 * 计算两个文本的相似度
 *
 * 使用简单的长度相似度算法
 * TODO: 可以升级为更复杂的算法（编辑距离、余弦相似度等）
 *
 * @param text1 - 文本1
 * @param text2 - 文本2
 * @returns 相似度分数（0-1）
 */
function calculateSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;

  // 长度相似度
  const lengthRatio = Math.min(text1.length, text2.length) / Math.max(text1.length, text2.length);

  // 简单的相似度：长度比例
  // TODO: 可以添加更多维度，如：
  // - 标点符号数量相似度
  // - 词数相似度
  // - 编辑距离相似度
  return lengthRatio;
}

/**
 * 回退到基于行数的匹配（原始逻辑）
 *
 * @param originalBatch - 原始段落信息
 * @param translatedContent - 翻译内容
 * @returns 匹配后的段落数组
 */
function fallbackToLineBased(
  originalBatch: ParagraphInfo[],
  translatedContent: string
): string[] {
  const translatedLines = translatedContent.split('\n').map(s => s.trim()).filter(s => s);

  return originalBatch.map((para, index) => {
    const translatedText = translatedLines[index] || para.text;

    if (index >= translatedLines.length) {
      console.warn(`[Background] 段落 ${index}: using original text (no translation available)`);
    }

    return translatedText;
  });
}
