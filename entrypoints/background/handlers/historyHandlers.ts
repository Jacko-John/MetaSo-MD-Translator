import { indexedDB } from '@/utils/indexedDB';
import type { TranslationEntry, MessageResponse, ExportData } from '@/types';
import { validateExportData } from '@/utils/validation';
import { activeTranslationsManager } from '../utils/activeTranslations';

/**
 * 获取历史记录
 */
export async function getHistory(): Promise<MessageResponse<TranslationEntry[]>> {
  const translations = await indexedDB.getAllTranslations();
  translations.sort((a, b) => b.meta.translatedAt - a.meta.translatedAt);
  return { success: true, data: translations };
}

/**
 * 删除翻译记录
 */
export async function deleteTranslation(id: string): Promise<MessageResponse<void>> {
  // 先取消对应的翻译任务
  activeTranslationsManager.cancel(id);

  // 删除记录
  await indexedDB.deleteTranslation(id);

  // 等待一小段时间确保取消完成
  await new Promise(resolve => setTimeout(resolve, 100));

  return { success: true };
}

/**
 * 清空所有数据
 */
export async function clearAll(): Promise<MessageResponse<void>> {
  await indexedDB.clearAll();
  return { success: true };
}

/**
 * 导出历史记录
 */
export async function exportHistory(): Promise<MessageResponse<ExportData>> {
  const translations = await indexedDB.getAllTranslations();

  const stats = {
    total: translations.length,
    completed: translations.filter(t => t.status === 'completed').length,
    failed: translations.filter(t => t.status === 'failed').length,
    pending: translations.filter(t => t.status === 'pending').length
  };

  const exportData: ExportData = {
    version: '1.0.0',
    exportDate: Date.now(),
    exportDateFormatted: new Date().toLocaleString('zh-CN'),
    stats,
    translations
  };

  return { success: true, data: exportData };
}

/**
 * 导入历史记录（追加模式，跳过重复）
 */
export async function importHistory(
  data: any
): Promise<MessageResponse<{ imported: number; skipped: number }>> {
  // 验证数据
  const validation = validateExportData(data);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // 获取现有记录的所有 ID
  const existingTranslations = await indexedDB.getAllTranslations();
  const existingIds = new Set(existingTranslations.map(t => t.id));

  let imported = 0;
  let skipped = 0;

  // 批量导入（跳过已存在的 ID）
  for (const translation of data.translations) {
    if (existingIds.has(translation.id)) {
      skipped++;
      continue;
    }

    await indexedDB.setTranslation(translation);
    imported++;
    existingIds.add(translation.id); // 更新已存在 ID 集合
  }

  return {
    success: true,
    data: { imported, skipped }
  };
}
