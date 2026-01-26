import { indexedDB } from '@/utils/indexedDB';
import type { TranslationEntry, ConfigEntry } from '@/types';
import { getSelectedModel, getProviderForModel, getModelIdForTranslation } from './configHelpers';

/**
 * 创建待处理的翻译记录
 */
export async function createPendingTranslation(
  id: string,
  config: ConfigEntry,
  estimatedTokens: number
): Promise<void> {
  const selectedModel = getSelectedModel(config);
  const provider = selectedModel ? getProviderForModel(config, selectedModel) : null;

  await indexedDB.setTranslation({
    id,
    contentId: id,
    translatedContent: {
      errCode: 0,
      errMsg: 'Translation in progress',
      data: {
        lang: null,
        markdown: []
      }
    },
    meta: {
      translatedAt: Date.now(),
      model: selectedModel?.id || getModelIdForTranslation(config),
      provider: provider?.type || 'openai',
      tokenCount: 0,
      estimatedTokenCount: estimatedTokens,
      duration: 0
    },
    status: 'pending'
  });
}

/**
 * 更新待处理的翻译记录
 */
export async function updatePendingTranslation(
  id: string,
  config: ConfigEntry,
  tokenCount: number
): Promise<void> {
  const selectedModel = getSelectedModel(config);
  const provider = selectedModel ? getProviderForModel(config, selectedModel) : null;

  await indexedDB.setTranslation({
    id,
    contentId: id,
    translatedContent: {
      errCode: 0,
      errMsg: 'Translation in progress',
      data: {
        lang: null,
        markdown: []
      }
    },
    meta: {
      translatedAt: Date.now(),
      model: selectedModel?.id || getModelIdForTranslation(config),
      provider: provider?.type || 'openai',
      tokenCount: tokenCount,
      duration: 0
    },
    status: 'pending'
  }).catch(console.error);
}

/**
 * 保存失败的翻译记录
 */
export async function saveFailedTranslation(
  id: string,
  config: ConfigEntry,
  error: unknown
): Promise<void> {
  console.error('[Background] 翻译失败:', error);

  const selectedModel = getSelectedModel(config);
  const provider = selectedModel ? getProviderForModel(config, selectedModel) : null;

  await indexedDB.setTranslation({
    id,
    contentId: id,
    translatedContent: {
      errCode: 1,
      errMsg: 'Translation failed',
      data: {
        lang: null,
        markdown: []
      }
    },
    meta: {
      translatedAt: Date.now(),
      model: selectedModel?.id || getModelIdForTranslation(config),
      provider: provider?.type || 'openai',
      tokenCount: 0,
      duration: 0
    },
    status: 'failed',
    error: error instanceof Error ? error.message : 'Unknown error'
  });
}
