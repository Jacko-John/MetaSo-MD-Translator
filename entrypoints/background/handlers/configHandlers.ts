import { indexedDB } from '@/utils/indexedDB';
import type { ConfigEntry, MessageResponse } from '@/types';
import { CONFIG } from '../constants';

/**
 * 获取配置
 */
export async function getConfig(): Promise<MessageResponse<ConfigEntry | null>> {
  const config = await indexedDB.getConfig();
  return { success: true, data: config };
}

/**
 * 更新配置
 */
export async function updateConfig(payload: Partial<Omit<ConfigEntry, 'id'>>): Promise<MessageResponse<ConfigEntry>> {
  const existingConfig = await indexedDB.getConfig();
  const now = Date.now();

  const newConfig: ConfigEntry = {
    id: 'config',
    providers: payload.providers || existingConfig?.providers || [],
    models: payload.models || existingConfig?.models || [],
    selectedModelId: payload.selectedModelId || existingConfig?.selectedModelId || '',
    language: payload.language || existingConfig?.language || CONFIG.DEFAULTS.LANGUAGE,
    createdAt: existingConfig?.createdAt || now,
    updatedAt: now
  };

  await indexedDB.setConfig(newConfig);
  console.log('[Background] 配置已更新');

  return { success: true, data: newConfig };
}
