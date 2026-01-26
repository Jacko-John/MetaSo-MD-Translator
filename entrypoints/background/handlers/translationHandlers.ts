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
  assembleTranslatedContent
} from '../utils/markdownProcessor';
import {
  createPendingTranslation,
  updatePendingTranslation,
  saveFailedTranslation
} from '../utils/translationHelpers';
import { notifyTranslationReady } from '../utils/notification';

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

  const contentEntry: ContentEntry = {
    id: payload.id,
    url: payload.url,
    fileId: payload.fileId,
    pageId: payload.pageId,
    originalContent: payload.content,
    timestamp: Date.now(),
    hash: generateObjectHash(payload.content)
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

  const { estimatedTokens } = extractMarkdownText(payload.content);
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

  const { estimatedTokens } = extractMarkdownText(payload.content);

  await createPendingTranslation(payload.id, config, estimatedTokens);

  try {
    const translatedEntry = await performTranslation(payload, config, sender.tab?.id);
    return { success: true, data: translatedEntry };
  } catch (error) {
    await saveFailedTranslation(payload.id, config, error);
    return { success: false, error: error instanceof Error ? error.message : '翻译失败' };
  }
}

/**
 * 重试翻译
 */
export async function handleRetryTranslation(
  payload: { id: string },
  sender: MessageSender
): Promise<MessageResponse> {
  console.log('[Background] 重试翻译:', payload.id);

  const content = await indexedDB.getContent(payload.id);
  if (!content) {
    return { success: false, error: '找不到原始内容' };
  }

  await indexedDB.deleteTranslation(payload.id);

  return await handleRequestTranslation(
    {
      id: content.id,
      url: content.url,
      fileId: content.fileId,
      pageId: content.pageId,
      content: content.originalContent
    },
    sender
  );
}

/**
 * 执行翻译核心逻辑
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

  console.log('[Background] 开始按段落智能分批翻译');
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
  console.log('[Background] 提供商名称:', provider.name);
  console.log('[Background] 提供商类型:', provider.type);
  console.log('[Background] 提供商端点:', provider.apiEndpoint);
  console.log('[Background] 模型名称:', selectedModel.name);
  console.log('[Background] 模型ID:', selectedModel.id);
  console.log('[Background] API Key (前8位):', selectedModel.apiKey?.substring(0, 8) + '***');
  console.log('[Background] 目标语言:', config.language);
  console.log('[Background] ===================');

  const startTime = Date.now();
  const paragraphs = flattenMarkdownItems(originalMarkdownItems);
  const totalParagraphs = paragraphs.length;
  console.log('[Background] 共', totalParagraphs, '个段落待翻译');

  const batches = batchParagraphs(paragraphs, CONFIG.TRANSLATION.MAX_CONTEXT_TOKENS);
  console.log('[Background] 智能分批为', batches.length, '个批次');

  const translatedParagraphs = new Map<string, string>();
  let totalTokens = 0;
  let currentParagraphCount = 0;
  let lastProgressUpdateTime = 0; // 用于节流进度更新

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    const batchText = batch.map(p => p.text.trim()).join('\n\n');

    const batchStart = batch[0];
    const batchEnd = batch[batch.length - 1];
    console.log(`[Background] 翻译批次 ${batchIndex + 1}/${batches.length}`);
    console.log(`[Background]   包含段落 ${batchStart.itemIndex}-${batchStart.paragraphIndex} 到 ${batchEnd.itemIndex}-${batchEnd.paragraphIndex}`);
    console.log(`[Background]   批次大小: ${batch.length} 个段落, 约 ${estimateTokens(batchText)} tokens`);

    await rateLimiter.waitIfNeeded();

    // 用于跟踪当前批次的实时 token 计数
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
        // 实时更新当前批次的 token 计数
        currentBatchTokens = tokenCount;

        // 节流：只在达到更新间隔时才更新 IndexedDB
        const now = Date.now();
        if (now - lastProgressUpdateTime > CONFIG.TRANSLATION.PROGRESS_UPDATE_INTERVAL) {
          lastProgressUpdateTime = now;
          const newTotalTokens = totalTokens + currentBatchTokens;
          updatePendingTranslation(payload.id, config, Math.floor(newTotalTokens));
        }
      }
    });

    rateLimiter.recordRequest();

    if (!translationResult.success || !translationResult.content) {
      throw new Error(`批次 ${batchIndex + 1} 翻译失败: ${translationResult.error || '未知错误'}`);
    }

    const translatedLines = translationResult.content.split('\n').map(s => s.trim()).filter(s => s);

    batch.forEach((para, index) => {
      const key = `${para.itemIndex}-${para.paragraphIndex}`;
      const translatedText = translatedLines[index] || para.text;
      translatedParagraphs.set(key, translatedText.trim() + '\n\n');
    });

    // 使用翻译结果中的 token 计数（如果有）
    const batchTokenCount = translationResult.meta?.tokenCount || currentBatchTokens;
    totalTokens += batchTokenCount;
    currentParagraphCount += batch.length;

    await updatePendingTranslation(payload.id, config, totalTokens);

    console.log(`[Background]   批次 ${batchIndex + 1} 翻译完成`);
  }

  const translatedItems = assembleTranslatedContent(originalMarkdownItems, translatedParagraphs);
  const duration = Date.now() - startTime;
  console.log('[Background] 所有段落翻译完成，总耗时:', duration, 'ms');
  console.log('[Background] 总 token 数:', totalTokens);

  const translatedContent: MetaSoApiResponse = {
    errCode: 0,
    errMsg: 'success',
    data: {
      lang: config.language,
      total_page: data.total_page,
      markdown: translatedItems
    }
  };

  const translationEntry: TranslationEntry = {
    id: payload.id,
    contentId: payload.id,
    translatedContent: translatedContent,
    meta: {
      translatedAt: Date.now(),
      model: selectedModel.id,
      provider: provider.type,
      tokenCount: totalTokens,
      duration: duration
    },
    status: 'completed'
  };

  await indexedDB.setTranslation(translationEntry);
  await notifyTranslationReady(tabId, payload.id, translationEntry);

  return translationEntry;
}

/**
 * 估算文本的 token 数量（临时函数，实际使用 markdownProcessor 中的）
 */
function estimateTokens(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars / 2) + Math.ceil(otherChars / 4);
}
