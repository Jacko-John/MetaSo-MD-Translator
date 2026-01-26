import type { ConfigEntry, ModelConfig, ProviderConfig } from '@/types';
import { CONFIG } from '../constants';

/**
 * 从配置中获取选中的模型
 */
export function getSelectedModel(config: ConfigEntry | null): ModelConfig | null {
  if (!config || !config.models || config.models.length === 0) {
    return null;
  }

  const selectedModel = config.models.find(m => m.id === config.selectedModelId);
  return selectedModel || config.models[0] || null;
}

/**
 * 根据模型获取对应的提供商配置
 */
export function getProviderForModel(config: ConfigEntry | null, model: ModelConfig): ProviderConfig | null {
  if (!config || !config.providers) {
    return null;
  }

  const provider = config.providers.find(p => p.id === model.providerId);
  return provider || null;
}

/**
 * 获取模型ID用于翻译
 */
export function getModelIdForTranslation(config: ConfigEntry | null): string {
  const selectedModel = getSelectedModel(config);
  if (!selectedModel) {
    return CONFIG.DEFAULTS.MODEL;
  }
  return selectedModel.id;
}
