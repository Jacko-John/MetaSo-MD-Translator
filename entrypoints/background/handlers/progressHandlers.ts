// MetaSo MD Translator - Progress Handlers

import { indexedDB } from '@/utils/indexedDB';
import { progressManager } from '../utils/progressManager';
import type { MessageResponse, RealtimeProgressData } from '@/types';

/**
 * 计算进度百分比
 * 使用总token进度：目前总token / 总预计token
 */
function calculatePercentage(
  totalTokens: number,
  estimatedTotalTokens: number
): number {
  if (estimatedTotalTokens === 0) return 0;
  return Math.min(100, (totalTokens / estimatedTotalTokens) * 100);
}

/**
 * 处理获取实时翻译进度
 */
export async function handleGetRealtimeProgress(payload: {
  id: string;
}): Promise<MessageResponse<RealtimeProgressData>> {
  const { id } = payload;

  try {
    // 从progressManager获取内存缓存的实时进度
    const progress = progressManager.getProgress(id);

    // 从IndexedDB获取翻译记录
    const translation = await indexedDB.getTranslation(id);

    if (!translation) {
      return {
        success: false,
        error: 'Translation not found'
      };
    }

    // 如果没有实时进度（已翻译完成或未开始），返回批次进度
    if (!progress) {
      const batchProgress = translation.meta?.batchProgress;
      const currentTokens = batchProgress?.totalTokens || translation.meta?.tokenCount || 0;
      const percentage = calculatePercentage(
        currentTokens,
        translation.meta?.estimatedTokenCount || 0
      );

      return {
        success: true,
        data: {
          translationId: id,
          status: translation.status,
          totalTokens: currentTokens,
          estimatedTotalTokens: translation.meta?.estimatedTokenCount || 0,
          tokensPerSecond: 0,
          estimatedRemainingTime: 0,
          percentage
        }
      };
    }

    // 聚合内存缓存和DB数据
    // progress.totalTokens 已经是总体进度（所有批次累计）
    const percentage = calculatePercentage(
      progress.totalTokens,
      progress.estimatedTotalTokens
    );

    return {
      success: true,
      data: {
        translationId: id,
        status: translation.status,
        totalTokens: progress.totalTokens,
        estimatedTotalTokens: progress.estimatedTotalTokens,
        tokensPerSecond: progress.tokensPerSecond,
        estimatedRemainingTime: progress.estimatedRemainingTime,
        percentage
      }
    };
  } catch (error) {
    console.error('[ProgressHandlers] 获取实时进度失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get progress'
    };
  }
}
