// MetaSo MD Translator - Real-time Progress Manager

/**
 * 实时Token进度（内存缓存）- 总体进度管理
 */
interface RealtimeTokenProgress {
  translationId: string;
  totalTokens: number; // 总体已生成token数（所有批次累计）
  estimatedTotalTokens: number; // 总体估算token数
  startTime: number; // 翻译开始时间
  lastUpdateTime: number; // 最后更新时间
  tokensPerSecond: number; // 总体速度
  estimatedRemainingTime: number; // 总体预计剩余时间
}

/**
 * 聚合进度（用于并行翻译）
 */
interface AggregatedProgress {
  translationId: string;
  totalTokens: number;
  tokensPerSecond: number;
  estimatedRemainingTime: number;
  parallelTaskCount: number;
}

/**
 * 翻译进度管理器
 *
 * 改为总体进度管理，而不是按批次管理
 */
class TranslationProgressManager {
  private progressCache: Map<string, RealtimeTokenProgress> = new Map();
  private updateTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly SPEED_SMOOTHING = 0.7; // 速度平滑系数（指数移动平均）

  /**
   * 初始化总体进度（翻译开始时调用一次）
   */
  initOverallProgress(
    translationId: string,
    estimatedTotalTokens: number
  ): void {
    const progress: RealtimeTokenProgress = {
      translationId,
      totalTokens: 0,
      estimatedTotalTokens,
      startTime: Date.now(),
      lastUpdateTime: Date.now(),
      tokensPerSecond: 0,
      estimatedRemainingTime: 0
    };

    this.progressCache.set(translationId, progress);
    console.log(`[ProgressManager] 初始化总体进度: ${translationId}, 估算 ${estimatedTotalTokens} tokens`);
  }

  /**
   * 更新总体Token进度（由Provider调用）
   */
  updateOverallProgress(
    translationId: string,
    totalTokens: number
  ): void {
    const progress = this.progressCache.get(translationId);
    if (!progress) {
      console.warn(`[ProgressManager] 未找到翻译进度: ${translationId}`);
      return;
    }

    const now = Date.now();
    const timeDiff = now - progress.lastUpdateTime;

    // 只在有足够时间差时才计算速度（避免噪声）
    if (timeDiff > 100) {
      const tokenDiff = totalTokens - progress.totalTokens;

      // 计算瞬时速度（tokens/s）
      const instantaneousSpeed = timeDiff > 0
        ? (tokenDiff / timeDiff) * 1000
        : 0;

      // 使用指数移动平均平滑速度
      if (progress.tokensPerSecond === 0) {
        progress.tokensPerSecond = instantaneousSpeed;
      } else {
        progress.tokensPerSecond = this.SPEED_SMOOTHING * progress.tokensPerSecond +
          (1 - this.SPEED_SMOOTHING) * instantaneousSpeed;
      }

      progress.totalTokens = totalTokens;
      progress.lastUpdateTime = now;

      // 计算预计剩余时间（基于总体进度）
      if (progress.tokensPerSecond > 0 && progress.estimatedTotalTokens > 0) {
        const remainingTokens = progress.estimatedTotalTokens - totalTokens;
        progress.estimatedRemainingTime = (remainingTokens / progress.tokensPerSecond) * 1000;
      }
    }
  }

  /**
   * 完成翻译
   */
  async completeTranslation(
    translationId: string,
    finalTotalTokens: number
  ): Promise<void> {
    const progress = this.progressCache.get(translationId);
    if (!progress) {
      console.warn(`[ProgressManager] 未找到翻译进度: ${translationId}`);
      return;
    }

    // 更新最终token数
    progress.totalTokens = finalTotalTokens;
    progress.lastUpdateTime = Date.now();

    console.log(`[ProgressManager] 翻译完成: ${translationId}, 总计 ${finalTotalTokens} tokens, 平均速度 ${progress.tokensPerSecond.toFixed(1)} tokens/s`);

    // 清理缓存和定时器
    this.cleanup(translationId);
  }

  /**
   * 获取实时进度
   */
  getProgress(translationId: string): RealtimeTokenProgress | undefined {
    return this.progressCache.get(translationId);
  }

  /**
   * 清理缓存和定时器
   */
  private cleanup(translationId: string): void {
    this.progressCache.delete(translationId);

    const timer = this.updateTimers.get(translationId);
    if (timer) {
      clearTimeout(timer);
      this.updateTimers.delete(translationId);
    }
  }

  /**
   * 初始化并行翻译进度（预留，未来扩展）
   */
  initParallelProgress(
    translationId: string,
    parallelCount: number,
    batchIndices: number[]
  ): void {
    // 为每个并行任务创建子进度
    for (let i = 0; i < parallelCount; i++) {
      const subTaskId = `${translationId}-parallel-${i}`;
      this.progressCache.set(subTaskId, {
        translationId: subTaskId,
        totalTokens: 0,
        estimatedTotalTokens: 0,
        startTime: Date.now(),
        lastUpdateTime: Date.now(),
        tokensPerSecond: 0,
        estimatedRemainingTime: 0
      });
    }
    console.log(`[ProgressManager] 初始化并行进度: ${translationId}, ${parallelCount} 个并行任务`);
  }

  /**
   * 聚合并行进度（预留，未来扩展）
   */
  getAggregatedProgress(translationId: string): AggregatedProgress | undefined {
    // 查找所有子任务
    const subTasks = Array.from(this.progressCache.entries())
      .filter(([key]) => key.startsWith(`${translationId}-parallel-`))
      .map(([, progress]) => progress);

    if (subTasks.length === 0) {
      return undefined;
    }

    // 聚合统计
    const totalTokens = subTasks.reduce((sum, p) => sum + p.totalTokens, 0);
    const avgSpeed = subTasks.reduce((sum, p) => sum + p.tokensPerSecond, 0) / subTasks.length;
    const maxRemainingTime = Math.max(...subTasks.map(p => p.estimatedRemainingTime));

    return {
      translationId,
      totalTokens,
      tokensPerSecond: avgSpeed,
      estimatedRemainingTime: maxRemainingTime,
      parallelTaskCount: subTasks.length
    };
  }

  /**
   * 清理所有进度（用于测试或重置）
   */
  clearAll(): void {
    this.progressCache.clear();
    this.updateTimers.forEach((timer) => clearTimeout(timer));
    this.updateTimers.clear();
  }
}

// 导出单例
export const progressManager = new TranslationProgressManager();
