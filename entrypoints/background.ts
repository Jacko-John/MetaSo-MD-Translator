// entrypoints/background.ts
// 后台服务：管理存储、翻译调度、消息处理

import { indexedDB } from '@/utils/indexedDB';
import { generateObjectHash } from '@/utils/hash';
import { translationService } from '@/services/translation';
import type {
  Message,
  MessageResponse,
  ContentEntry,
  TranslationEntry,
  ConfigEntry,
  MetaSoApiResponse,
  MetaSoMarkdownItem
} from '@/types';

// ============================================================================
// 常量配置
// ============================================================================
const CONFIG = {
  RATE_LIMIT: {
    MAX_REQUESTS: 60,
    WINDOW_MS: 60000,
  },
  TRANSLATION: {
    MAX_CONTEXT_TOKENS: 8192,
    SAFE_TOKEN_MARGIN: 1024,
    PROGRESS_UPDATE_INTERVAL: 5000,
    MAX_TOKENS: 8192,
    TEMPERATURE: 0.07,
  },
  DEFAULTS: {
    API_PROVIDER: 'openai' as const,
    MODEL: 'gpt-3.5-turbo',
    LANGUAGE: 'zh-CN',
  },
} as const;

// ============================================================================
// 类型定义
// ============================================================================
type MessageSender = typeof browser.runtime.onMessage.addListener extends (cb: (msg: any, sender: infer S, ...rest: any[]) => any) => any ? S : never;

interface TranslationProgress {
  currentBatch: number;
  totalBatches: number;
  currentParagraph: number;
  totalParagraphs: number;
  translatedTokens: number;
}

interface ParagraphInfo {
  text: string;
  itemIndex: number;
  paragraphIndex: number;
  estimatedTokens: number;
}

interface MarkdownExtractionResult {
  text: string;
  estimatedTokens: number;
}

// ============================================================================
// API 频率限制器
// ============================================================================
class RateLimiter {
  private requests: number[] = [];
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = CONFIG.RATE_LIMIT.MAX_REQUESTS, windowMs: number = CONFIG.RATE_LIMIT.WINDOW_MS) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  canMakeRequest(): boolean {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    return this.requests.length < this.maxRequests;
  }

  recordRequest(): void {
    this.requests.push(Date.now());
  }

  getWaitTime(): number {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.windowMs);

    if (this.requests.length < this.maxRequests) {
      return 0;
    }

    const oldestRequest = this.requests[0];
    return oldestRequest + this.windowMs - now;
  }

  async waitIfNeeded(): Promise<void> {
    const waitTime = this.getWaitTime();
    if (waitTime > 0) {
      console.log(`[RateLimiter] 达到频率限制，等待 ${Math.ceil(waitTime / 1000)} 秒...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

const rateLimiter = new RateLimiter();

export default defineBackground(() => {
  console.log('[MetaSo Translator] Background script 已启动');

  indexedDB.init().catch(console.error);

  browser.runtime.onMessage.addListener(
    (message: Message, sender: MessageSender, sendResponse: (response: MessageResponse) => void) => {
      handleMessage(message, sender)
        .then(sendResponse)
        .catch((error) => {
          console.error('[MetaSo Translator] Message handling error:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true;
    }
  );

  async function handleMessage(message: Message, sender: MessageSender): Promise<MessageResponse> {
    try {
      switch (message.type) {
        case 'ORIGINAL_REQUEST':
          return await handleOriginalRequest(message.payload);

        case 'CHECK_TRANSLATION':
          return await checkTranslation(message.payload);

        case 'REQUEST_TRANSLATION':
          return await handleRequestTranslation(message.payload, sender);

        case 'GET_TRANSLATION':
          return await getTranslation(message.payload);

        case 'GET_CONFIG':
          return await getConfig();

        case 'UPDATE_CONFIG':
          return await updateConfig(message.payload);

        case 'GET_HISTORY':
          return await getHistory();

        case 'DELETE_TRANSLATION':
          return await deleteTranslation(message.payload);

        case 'RETRY_TRANSLATION':
          return await handleRetryTranslation(message.payload, sender);

        case 'CLEAR_ALL':
          return await clearAll();

        default:
          return { success: false, error: 'Unknown message type' };
      }
    } catch (error) {
      console.error('[MetaSo Translator] Error handling message:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // ==========================================================================
  // 请求处理函数
  // ==========================================================================

  async function handleOriginalRequest(payload: {
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

  async function checkTranslation(payload: { id: string }): Promise<MessageResponse> {
    const translation = await indexedDB.getTranslation(payload.id);

    if (translation && translation.status === 'completed') {
      return { success: true, data: translation };
    }

    return { success: true, data: null };
  }

  async function handleRequestTranslation(
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

    if (!config?.apiKey) {
      return { success: false, error: '请先在配置中设置 API Key' };
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

  async function getTranslation(payload: { id: string }): Promise<MessageResponse> {
    const translation = await indexedDB.getTranslation(payload.id);

    if (translation?.status === 'completed') {
      return { success: true, data: translation };
    }

    return { success: false, error: 'Translation not found' };
  }

  async function getConfig(): Promise<MessageResponse> {
    const config = await indexedDB.getConfig();
    return { success: true, data: config };
  }

  async function updateConfig(payload: Partial<Omit<ConfigEntry, 'id'>>): Promise<MessageResponse> {
    const existingConfig = await indexedDB.getConfig();
    const now = Date.now();

    const newConfig: ConfigEntry = {
      id: 'config',
      apiKey: payload.apiKey || existingConfig?.apiKey || '',
      apiProvider: payload.apiProvider || existingConfig?.apiProvider || CONFIG.DEFAULTS.API_PROVIDER,
      apiEndpoint: payload.apiEndpoint || existingConfig?.apiEndpoint,
      model: payload.model || existingConfig?.model || CONFIG.DEFAULTS.MODEL,
      language: payload.language || existingConfig?.language || CONFIG.DEFAULTS.LANGUAGE,
      createdAt: existingConfig?.createdAt || now,
      updatedAt: now
    };

    await indexedDB.setConfig(newConfig);
    console.log('[Background] 配置已更新');

    return { success: true, data: newConfig };
  }

  async function getHistory(): Promise<MessageResponse> {
    const translations = await indexedDB.getAllTranslations();
    translations.sort((a, b) => b.meta.translatedAt - a.meta.translatedAt);
    return { success: true, data: translations };
  }

  async function deleteTranslation(payload: { id: string }): Promise<MessageResponse> {
    await indexedDB.deleteTranslation(payload.id);
    return { success: true };
  }

  async function clearAll(): Promise<MessageResponse> {
    await indexedDB.clearAll();
    return { success: true };
  }

  async function handleRetryTranslation(
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

  // ==========================================================================
  // 翻译核心逻辑
  // ==========================================================================

  async function performTranslation(
    payload: { id: string; content: MetaSoApiResponse },
    config: ConfigEntry,
    tabId: number | undefined
  ): Promise<TranslationEntry> {
    const data = payload.content.data;
    const originalMarkdownItems: MetaSoMarkdownItem[] = data.markdown || [];

    if (originalMarkdownItems.length === 0) {
      throw new Error('无法提取要翻译的内容');
    }

    console.log('[Background] 开始按段落智能分批翻译');
    console.log('[Background] 原始内容:', originalMarkdownItems.length, '个 markdown 项');
    console.log('[Background] 翻译提供商:', config.apiProvider, '模型:', config.model);

    const startTime = Date.now();
    const paragraphs = flattenMarkdownItems(originalMarkdownItems);
    const totalParagraphs = paragraphs.length;
    console.log('[Background] 共', totalParagraphs, '个段落待翻译');

    const batches = batchParagraphs(paragraphs, CONFIG.TRANSLATION.MAX_CONTEXT_TOKENS);
    console.log('[Background] 智能分批为', batches.length, '个批次');

    const translatedParagraphs = new Map<string, string>();
    let totalTokens = 0;
    let currentParagraphCount = 0;

    const progressCache = { tokenCount: 0, lastUpdateTime: 0 };

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const batchText = batch.map(p => p.text).join('\n\n');

      const batchStart = batch[0];
      const batchEnd = batch[batch.length - 1];
      console.log(`[Background] 翻译批次 ${batchIndex + 1}/${batches.length}`);
      console.log(`[Background]   包含段落 ${batchStart.itemIndex}-${batchStart.paragraphIndex} 到 ${batchEnd.itemIndex}-${batchEnd.paragraphIndex}`);
      console.log(`[Background]   批次大小: ${batch.length} 个段落, 约 ${estimateTokens(batchText)} tokens`);

      await rateLimiter.waitIfNeeded();

      const translationResult = await translationService.translate(batchText, {
        apiKey: config.apiKey,
        apiProvider: config.apiProvider,
        apiEndpoint: config.apiEndpoint,
        model: config.model,
        targetLanguage: config.language,
        maxTokens: CONFIG.TRANSLATION.MAX_TOKENS,
        temperature: CONFIG.TRANSLATION.TEMPERATURE,
        onProgress: (progress) => {
          const newTokenCount = totalTokens + progress.current;
          notifyTranslationProgress(tabId, payload.id, {
            currentBatch: batchIndex + 1,
            totalBatches: batches.length,
            currentParagraph: currentParagraphCount,
            totalParagraphs: totalParagraphs,
            translatedTokens: newTokenCount
          });

          updateProgressIfNeeded(payload.id, config, newTokenCount, progressCache);
        }
      });

      rateLimiter.recordRequest();

      if (!translationResult.success || !translationResult.content) {
        throw new Error(`批次 ${batchIndex + 1} 翻译失败: ${translationResult.error || '未知错误'}`);
      }

      const translatedLines = translationResult.content.split('\n\n').map(s => s.trim()).filter(s => s);

      batch.forEach((para, index) => {
        const key = `${para.itemIndex}-${para.paragraphIndex}`;
        const translatedText = translatedLines[index] || para.text;
        translatedParagraphs.set(key, translatedText.trimEnd() + '\n\n');
      });

      totalTokens += translationResult.meta?.tokenCount || 0;
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
        model: config.model,
        provider: config.apiProvider,
        tokenCount: totalTokens,
        duration: duration
      },
      status: 'completed'
    };

    await indexedDB.setTranslation(translationEntry);
    await notifyTranslationReady(tabId, payload.id, translationEntry);

    return translationEntry;
  }

  // ==========================================================================
  // 辅助函数
  // ==========================================================================

  function extractMarkdownText(content: MetaSoApiResponse): MarkdownExtractionResult {
    try {
      const data = content.data;

      if (data && Array.isArray(data.markdown)) {
        const allMarkdown: string[] = [];
        data.markdown.forEach((item) => {
          if (item.markdown && Array.isArray(item.markdown)) {
            allMarkdown.push(...item.markdown);
          }
        });
        const text = allMarkdown.join('\n');
        return { text, estimatedTokens: estimateTokens(text) };
      }
    } catch (error) {
      console.warn('[Background] 无法提取 markdown:', error, '原始数据:', content);
    }

    return { text: '', estimatedTokens: 0 };
  }

  async function createPendingTranslation(id: string, config: ConfigEntry, estimatedTokens: number): Promise<void> {
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
        model: config.model,
        provider: config.apiProvider,
        tokenCount: 0,
        estimatedTokenCount: estimatedTokens,
        duration: 0
      },
      status: 'pending'
    });
  }

  async function updatePendingTranslation(id: string, config: ConfigEntry, tokenCount: number): Promise<void> {
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
        model: config.model,
        provider: config.apiProvider,
        tokenCount: tokenCount,
        duration: 0
      },
      status: 'pending'
    }).catch(console.error);
  }

  function updateProgressIfNeeded(
    id: string,
    config: ConfigEntry,
    tokenCount: number,
    cache: { tokenCount: number; lastUpdateTime: number }
  ): void {
    const now = Date.now();

    if (now - cache.lastUpdateTime > CONFIG.TRANSLATION.PROGRESS_UPDATE_INTERVAL) {
      cache.tokenCount = tokenCount;
      cache.lastUpdateTime = now;

      updatePendingTranslation(id, config, tokenCount);
    }
  }

  async function saveFailedTranslation(id: string, config: ConfigEntry, error: unknown): Promise<void> {
    console.error('[Background] 翻译失败:', error);

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
        model: config.model,
        provider: config.apiProvider,
        tokenCount: 0,
        duration: 0
      },
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  // ==========================================================================
  // 通知函数
  // ==========================================================================

  async function notifyTranslationReady(tabId: number | undefined, id: string, translation: TranslationEntry): Promise<void> {
    if (!tabId) {
      console.warn('[Background] No tab ID, cannot notify translation ready');
      return;
    }

    try {
      const tab = await browser.tabs.get(tabId).catch(() => null);
      if (!tab) {
        console.warn('[Background] Tab no longer exists, cannot notify translation ready');
        return;
      }

      await browser.tabs.sendMessage(tabId, {
        type: 'TRANSLATION_READY',
        payload: { id, translation }
      });
    } catch (error) {
      console.debug('[Background] Failed to send translation ready message (tab may be closed):', error);
    }
  }

  async function notifyTranslationProgress(tabId: number | undefined, id: string, progress: TranslationProgress): Promise<void> {
    if (!tabId) {
      console.debug('[Background] No tab ID, cannot notify progress');
      return;
    }

    try {
      const tab = await browser.tabs.get(tabId).catch(() => null);
      if (!tab) {
        console.debug('[Background] Tab no longer exists, skipping progress notification');
        return;
      }

      await browser.tabs.sendMessage(tabId, {
        type: 'TRANSLATION_PROGRESS',
        payload: { id, ...progress }
      });
    } catch (error) {
      console.debug('[Background] Failed to send progress message (tab may be closed):', error);
    }
  }

  // ==========================================================================
  // 工具函数
  // ==========================================================================

  function estimateTokens(text: string): number {
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 2) + Math.ceil(otherChars / 4);
  }

  function flattenMarkdownItems(items: MetaSoMarkdownItem[]): ParagraphInfo[] {
    const paragraphs: ParagraphInfo[] = [];

    items.forEach((item, itemIndex) => {
      if (item.markdown && Array.isArray(item.markdown)) {
        item.markdown.forEach((paragraph, paragraphIndex) => {
          paragraphs.push({
            text: paragraph,
            itemIndex,
            paragraphIndex,
            estimatedTokens: estimateTokens(paragraph)
          });
        });
      }
    });

    return paragraphs;
  }

  function batchParagraphs(paragraphs: ParagraphInfo[], maxTokens: number): ParagraphInfo[][] {
    const batches: ParagraphInfo[][] = [];
    let currentBatch: ParagraphInfo[] = [];
    let currentBatchTokens = 0;

    const safeMaxTokens = maxTokens - CONFIG.TRANSLATION.SAFE_TOKEN_MARGIN;

    for (const paragraph of paragraphs) {
      const estimatedTokens = paragraph.estimatedTokens;

      if (estimatedTokens > safeMaxTokens) {
        if (currentBatch.length > 0) {
          batches.push(currentBatch);
          currentBatch = [];
          currentBatchTokens = 0;
        }
        batches.push([paragraph]);
        continue;
      }

      if (currentBatchTokens + estimatedTokens > safeMaxTokens && currentBatch.length > 0) {
        batches.push(currentBatch);
        currentBatch = [];
        currentBatchTokens = 0;
      }

      currentBatch.push(paragraph);
      currentBatchTokens += estimatedTokens;
    }

    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    return batches;
  }

  function assembleTranslatedContent(
    originalItems: MetaSoMarkdownItem[],
    translatedParagraphs: Map<string, string>
  ): MetaSoMarkdownItem[] {
    return originalItems.map((item, itemIndex) => ({
      markdown_lang: item.markdown.map((_, paragraphIndex) => {
        const key = `${itemIndex}-${paragraphIndex}`;
        return translatedParagraphs.get(key) || '';
      }),
      markdown: item.markdown,
      page: item.page,
      could_translate: true
    }));
  }
});
