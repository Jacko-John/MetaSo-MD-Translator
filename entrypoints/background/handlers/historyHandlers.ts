import { indexedDB } from '@/utils/indexedDB';
import type { TranslationEntry, MessageResponse } from '@/types';

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
  await indexedDB.deleteTranslation(id);
  return { success: true };
}

/**
 * 清空所有数据
 */
export async function clearAll(): Promise<MessageResponse<void>> {
  await indexedDB.clearAll();
  return { success: true };
}
