/**
 * 活跃翻译任务管理器
 * 用于跟踪和取消正在进行的翻译任务
 */

export class ActiveTranslationsManager {
  private activeTranslations = new Map<string, AbortController>();

  /**
   * 注册一个新的翻译任务
   * @returns AbortController 用于取消任务
   */
  register(translationId: string): AbortController {
    // 如果已存在，先取消旧任务
    this.cancel(translationId);

    const controller = new AbortController();
    this.activeTranslations.set(translationId, controller);
    console.log(`[ActiveTranslations] 注册任务: ${translationId}`);
    return controller;
  }

  /**
   * 取消指定的翻译任务
   */
  cancel(translationId: string): void {
    const controller = this.activeTranslations.get(translationId);
    if (controller) {
      controller.abort();
      this.activeTranslations.delete(translationId);
      console.log(`[ActiveTranslations] 取消任务: ${translationId}`);
    }
  }

  /**
   * 完成任务时清理
   */
  complete(translationId: string): void {
    this.activeTranslations.delete(translationId);
    console.log(`[ActiveTranslations] 完成任务: ${translationId}`);
  }

  /**
   * 检查任务是否存在
   */
  has(translationId: string): boolean {
    return this.activeTranslations.has(translationId);
  }

  /**
   * 取消所有任务
   */
  cancelAll(): void {
    for (const [id, controller] of this.activeTranslations) {
      controller.abort();
      console.log(`[ActiveTranslations] 取消任务: ${id}`);
    }
    this.activeTranslations.clear();
  }
}

export const activeTranslationsManager = new ActiveTranslationsManager();
