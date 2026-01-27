import { indexedDB } from '@/utils/indexedDB';
import { generateObjectHash } from '@/utils/hash';
import { translationService } from '@/services/translation';
import { rateLimiter } from '@/utils/rateLimiter';
import type { MessageResponse, ContentEntry, MetaSoApiResponse, TranslationEntry, ConfigEntry } from '@/types';
import type { MessageSender } from '../types';
import { CONFIG } from '../constants';
import { getSelectedModel, getProviderForModel } from '../utils/configHelpers';
import {
  extractMarkdownText,
  flattenMarkdownItems,
  batchParagraphs,
  assembleTranslatedContent,
  cleanEmptyParagraphs
} from '../utils/markdownProcessor';
import {
  createPendingTranslation,
  updatePendingTranslation,
  saveFailedTranslation,
  saveBatchProgress
} from '../utils/translationHelpers';
import { notifyTranslationReady } from '../utils/notification';
import { injectMarkers, extractTranslatedParagraphs } from '../utils/markerUtils';
import { applyFallbackStrategy } from '../utils/alignmentFallback';
import type { TranslationBatchProgress } from '@/types';

/**
 * 检查并显示批次进度
 */
function logBatchProgress(batchProgress: TranslationBatchProgress | undefined, context: string): void {
  if (!batchProgress) {
    console.log(`[Background] ${context}: 未检测到批次进度，将从头开始翻译`);
    return;
  }

  console.log(`[Background] ${context}: 检测到翻译进度`);
  console.log(`[Background]   已完成批次: ${batchProgress.completedBatchCount}/${batchProgress.totalBatchCount}`);
  console.log(`[Background]   已翻译段落: ${Object.keys(batchProgress.translatedParagraphs).length} 个`);
  console.log(`[Background]   消耗 tokens: ${batchProgress.totalTokens}`);
  console.log(`[Background]   将从第 ${batchProgress.completedBatchCount + 1} 批次继续`);
}

/**
 * 保存批次进度并抛出错误
 */
async function saveProgressAndThrow(
  id: string,
  config: ConfigEntry,
  batchIndex: number,
  batches: any[],
  translatedParagraphs: Map<string, string>,
  totalTokens: number,
  error: string
): Promise<never> {
  const progress: TranslationBatchProgress = {
    completedBatchCount: batchIndex,
    totalBatchCount: batches.length,
    translatedParagraphs: Object.fromEntries(translatedParagraphs),
    totalTokens
  };
  await saveBatchProgress(id, config, progress);
  throw new Error(`批次 ${batchIndex + 1} 翻译失败: ${error}，已保存进度，下次可从该批次继续`);
}

/**
 * 处理原始请求
 */
export async function handleOriginalRequest(payload: {
  id: string;
  url: string;
  fileId: string;
  pageId: string;
  content: MetaSoApiResponse;
}): Promise<MessageResponse> {
  console.log('[Background] 处理原始请求:', payload.id);

  // 清理空段落
  const cleanedContent = cleanEmptyParagraphs(payload.content);

  const contentEntry: ContentEntry = {
    id: payload.id,
    url: payload.url,
    fileId: payload.fileId,
    pageId: payload.pageId,
    originalContent: cleanedContent,
    timestamp: Date.now(),
    hash: generateObjectHash(cleanedContent)
  };

  await indexedDB.setContent(contentEntry);

  const existingTranslation = await indexedDB.getTranslation(payload.id);

  if (existingTranslation) {
    if (existingTranslation.status === 'completed') {
      console.log('[Background] 翻译已完成，无需重复翻译');
      return { success: true, data: { needTranslation: false } };
    } else if (existingTranslation.status === 'pending') {
      console.log('[Background] 翻译正在进行中，无需重复提示');
      return { success: true, data: { needTranslation: false } };
    }
  }

  const { estimatedTokens } = extractMarkdownText(cleanedContent);
  console.log('[Background] 需要翻译，估算 tokens:', estimatedTokens);

  return {
    success: true,
    data: {
      needTranslation: true,
      estimatedTokens
    }
  };
}

/**
 * 检查翻译是否存在
 */
export async function checkTranslation(payload: { id: string }): Promise<MessageResponse<TranslationEntry | null>> {
  const translation = await indexedDB.getTranslation(payload.id);

  if (translation && translation.status === 'completed') {
    return { success: true, data: translation };
  }

  return { success: true, data: null };
}

/**
 * 获取翻译结果
 */
export async function getTranslation(payload: { id: string }): Promise<MessageResponse<TranslationEntry | null>> {
  const translation = await indexedDB.getTranslation(payload.id);

  if (translation?.status === 'completed') {
    return { success: true, data: translation };
  }

  return { success: false, error: 'Translation not found' };
}

/**
 * 处理翻译请求
 */
export async function handleRequestTranslation(
  payload: {
    id: string;
    url: string;
    fileId: string;
    pageId: string;
    content: MetaSoApiResponse;
  },
  sender: MessageSender
): Promise<MessageResponse> {
  console.log('[Background] 收到翻译请求:', payload.id);

  const config = await indexedDB.getConfig();

  if (!config?.models || config.models.length === 0) {
    return { success: false, error: '请先在配置中添加至少一个模型' };
  }

  const selectedModel = getSelectedModel(config);
  if (!selectedModel || !selectedModel.apiKey) {
    return { success: false, error: '请先在配置中设置模型的 API Key' };
  }

  const existingTranslation = await indexedDB.getTranslation(payload.id);

  if (existingTranslation?.status === 'completed') {
    console.log('[Background] 翻译已完成，直接返回');
    await notifyTranslationReady(sender.tab?.id, payload.id, existingTranslation);
    return { success: true, data: existingTranslation };
  }

  // 清理空段落
  const cleanedContent = cleanEmptyParagraphs(payload.content);
  const { estimatedTokens } = extractMarkdownText(cleanedContent);

  await createPendingTranslation(payload.id, config, estimatedTokens);

  try {
    const translatedEntry = await performTranslation(
      { ...payload, content: cleanedContent },
      config,
      sender.tab?.id
    );
    return { success: true, data: translatedEntry };
  } catch (error) {
    await saveFailedTranslation(payload.id, config, error);
    return { success: false, error: error instanceof Error ? error.message : '翻译失败' };
  }
}

/**
 * 重试翻译（断点续传）
 * 从失败的批次继续翻译，而不是重新开始
 */
export async function handleRetryTranslation(
  payload: { id: string },
  sender: MessageSender
): Promise<MessageResponse> {
  console.log('[Background] 重试翻译（断点续传）:', payload.id);

  const content = await indexedDB.getContent(payload.id);
  if (!content) {
    return { success: false, error: '找不到原始内容' };
  }

  const config = await indexedDB.getConfig();
  if (!config?.models || config.models.length === 0) {
    return { success: false, error: '请先在配置中添加至少一个模型' };
  }

  const selectedModel = getSelectedModel(config);
  if (!selectedModel || !selectedModel.apiKey) {
    return { success: false, error: '请先在配置中设置模型的 API Key' };
  }

  // 检查现有翻译状态和进度
  const existingTranslation = await indexedDB.getTranslation(payload.id);
  if (existingTranslation?.status === 'completed') {
    console.log('[Background] 翻译已完成，无需重试');
    await notifyTranslationReady(sender.tab?.id, payload.id, existingTranslation);
    return { success: true, data: existingTranslation };
  }

  // 显示批次进度
  logBatchProgress(existingTranslation?.meta?.batchProgress, '重试翻译');

  const cleanedContent = cleanEmptyParagraphs(content.originalContent);
  const { estimatedTokens } = extractMarkdownText(cleanedContent);

  await createPendingTranslation(payload.id, config, estimatedTokens);

  try {
    const translatedEntry = await performTranslation(
      { id: payload.id, content: cleanedContent },
      config,
      sender.tab?.id
    );
    return { success: true, data: translatedEntry };
  } catch (error) {
    const batchProgress = existingTranslation?.meta?.batchProgress;
    await saveFailedTranslation(payload.id, config, error, batchProgress);
    return { success: false, error: error instanceof Error ? error.message : '翻译失败' };
  }
}

/**
 * 执行翻译核心逻辑
 * 支持断点续传：从失败的批次继续翻译
 */
async function performTranslation(
  payload: { id: string; content: MetaSoApiResponse },
  config: ConfigEntry,
  tabId: number | undefined
): Promise<TranslationEntry> {
  const data = payload.content.data;
  const originalMarkdownItems = data.markdown || [];

  if (originalMarkdownItems.length === 0) {
    throw new Error('无法提取要翻译的内容');
  }

  // 检查批次进度
  const existingTranslation = await indexedDB.getTranslation(payload.id);
  const batchProgress = existingTranslation?.meta?.batchProgress;
  const resumeFromBatch = batchProgress?.completedBatchCount || 0;

  // 显示进度信息
  if (resumeFromBatch > 0) {
    logBatchProgress(batchProgress, '继续翻译');
  }

  console.log('[Background] 原始内容:', originalMarkdownItems.length, '个 markdown 项');

  const selectedModel = getSelectedModel(config);
  if (!selectedModel) {
    throw new Error('未配置任何模型，请先在配置中添加模型');
  }

  const provider = getProviderForModel(config, selectedModel);
  if (!provider) {
    throw new Error(`找不到模型 "${selectedModel.name}" 对应的提供商配置`);
  }

  console.log('[Background] === 翻译配置信息 ===');
  console.log('[Background] 提供商:', provider.name, '| 类型:', provider.type);
  console.log('[Background] 模型:', selectedModel.name, '| ID:', selectedModel.id);
  console.log('[Background] 目标语言:', config.language);
  console.log('[Background] ===================');

  const startTime = Date.now();
  const paragraphs = flattenMarkdownItems(originalMarkdownItems);
  const batches = batchParagraphs(paragraphs, CONFIG.TRANSLATION.MAX_CONTEXT_TOKENS);

  console.log('[Background] 共', paragraphs.length, '个段落，分', batches.length, '个批次');

  // 恢复已翻译的段落
  const translatedParagraphs = new Map<string, string>();
  let totalTokens = batchProgress?.totalTokens || 0;

  if (batchProgress?.translatedParagraphs) {
    Object.entries(batchProgress.translatedParagraphs).forEach(([key, value]) => {
      translatedParagraphs.set(key, value);
    });
    console.log('[Background] 已恢复', Object.keys(batchProgress.translatedParagraphs).length, '个段落的翻译');
  }

  // 翻译批次（从断点继续）
  for (let batchIndex = resumeFromBatch; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    const batchText = batch.length === 1
      ? batch[0].text.trim()
      : injectMarkers(batch);

    const batchStart = batch[0];
    const batchEnd = batch[batch.length - 1];
    console.log(`[Background] 批次 ${batchIndex + 1}/${batches.length}:`,
      `${batch.length} 个段落 (${batchStart.itemIndex}-${batchStart.paragraphIndex} 到 ${batchEnd.itemIndex}-${batchEnd.paragraphIndex})`);

    await rateLimiter.waitIfNeeded();

    let currentBatchTokens = 0;

    const translationResult = await translationService.translate(batchText, {
      apiKey: selectedModel.apiKey,
      apiProvider: provider.type,
      apiEndpoint: provider.apiEndpoint,
      model: selectedModel.id,
      targetLanguage: config.language,
      maxTokens: CONFIG.TRANSLATION.MAX_TOKENS,
      temperature: CONFIG.TRANSLATION.TEMPERATURE,
      onTokenUpdate: (tokenCount) => {
        currentBatchTokens = tokenCount;
      }
    });

    rateLimiter.recordRequest();

    // 翻译失败时保存进度
    if (!translationResult.success || !translationResult.content) {
      await saveProgressAndThrow(
        payload.id,
        config,
        batchIndex,
        batches,
        translatedParagraphs,
        totalTokens,
        translationResult.error || '未知错误'
      );
    }

    // 处理翻译结果
    if (batch.length === 1) {
      const key = `${batch[0].itemIndex}-${batch[0].paragraphIndex}`;
      translatedParagraphs.set(key, (translationResult.content || '').trim() + '\n\n');
    } else {
      const content = translationResult.content || '';
      const extractionResult = extractTranslatedParagraphs(content, batch.length);
      const fallbackResult = applyFallbackStrategy(extractionResult, batch, content);

      batch.forEach((para, index) => {
        const key = `${para.itemIndex}-${para.paragraphIndex}`;
        const translatedText = fallbackResult.paragraphs[index] || para.text;
        translatedParagraphs.set(key, translatedText.trim() + '\n\n');
      });
    }

    // 更新 token 统计
    totalTokens += translationResult.meta?.tokenCount || currentBatchTokens;

    // 保存进度
    const progress: TranslationBatchProgress = {
      completedBatchCount: batchIndex + 1,
      totalBatchCount: batches.length,
      translatedParagraphs: Object.fromEntries(translatedParagraphs),
      totalTokens
    };
    await saveBatchProgress(payload.id, config, progress);
    await updatePendingTranslation(payload.id, config, totalTokens);

    console.log(`[Background]   批次 ${batchIndex + 1} 完成`);
  }

  // 组装最终结果
  const translatedItems = assembleTranslatedContent(originalMarkdownItems, translatedParagraphs);
  const duration = Date.now() - startTime;

  console.log('[Background] 翻译完成! 耗时:', duration, 'ms | Tokens:', totalTokens);

  const translationEntry: TranslationEntry = {
    id: payload.id,
    contentId: payload.id,
    translatedContent: {
      errCode: 0,
      errMsg: 'success',
      data: {
        lang: config.language,
        total_page: data.total_page,
        markdown: translatedItems
      }
    },
    meta: {
      translatedAt: Date.now(),
      model: selectedModel.id,
      provider: provider.type,
      tokenCount: totalTokens,
      duration
    },
    status: 'completed'
  };

  await indexedDB.setTranslation(translationEntry);
  await notifyTranslationReady(tabId, payload.id, translationEntry);

  return translationEntry;
}
