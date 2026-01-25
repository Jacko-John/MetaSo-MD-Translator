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

export default defineBackground(() => {
  console.log('[MetaSo Translator] Background script 已启动');

  // 初始化 IndexedDB（在 background script 启动时）
  indexedDB.init().catch(console.error);

  // ========================================================================
  // 消息监听
  // ========================================================================
  browser.runtime.onMessage.addListener((message: Message, sender: any, sendResponse: (response: any) => void) => {
    handleMessage(message, sender)
      .then(sendResponse)
      .catch((error) => {
        console.error('[MetaSo Translator] Message handling error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // 保持消息通道开放以支持异步响应
  });

  // ========================================================================
  // 消息处理
  // ========================================================================
  async function handleMessage(message: Message, sender: any): Promise<MessageResponse> {
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

  // ========================================================================
  // 请求处理函数
  // ========================================================================

  /**
   * 处理原始请求：存储内容并检查是否需要翻译
   */
  async function handleOriginalRequest(payload: {
    id: string;
    url: string;
    fileId: string;
    pageId: string;
    content: MetaSoApiResponse;
  }): Promise<MessageResponse> {
    console.log('[Background] 处理原始请求:', payload.id);

    // 1. 存储原始内容
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

    // 2. 检查是否已有翻译
    const existingTranslation = await indexedDB.getTranslation(payload.id);

    if (existingTranslation && existingTranslation.status === 'completed') {
      console.log('[Background] 翻译已存在');
      return { success: true, data: { needTranslation: false } };
    }

    // 3. 估算 Token 数量
    // 提取 markdown 内容用于估算
    let markdown = '';
    try {
      const data = payload.content.data;

      if (data && Array.isArray(data.markdown)) {
        // markdown 是一个数组，每个元素包含 markdown 数组和 page
        // 将所有 markdown 数组合并成一个字符串
        const allMarkdown: string[] = [];
        data.markdown.forEach((item) => {
          if (item.markdown && Array.isArray(item.markdown)) {
            allMarkdown.push(...item.markdown);
          }
        });
        markdown = allMarkdown.join('\n');
      }
    } catch (error) {
      console.warn('[Background] 无法提取 markdown:', error, '原始数据:', payload.content);
      markdown = '';
    }

    const estimatedTokens = estimateTokens(markdown);

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
  async function checkTranslation(payload: { id: string }): Promise<MessageResponse> {
    const translation = await indexedDB.getTranslation(payload.id);

    if (translation && translation.status === 'completed') {
      return { success: true, data: translation };
    }

    return { success: true, data: null };
  }

  /**
   * 处理翻译请求
   */
  async function handleRequestTranslation(
    payload: {
      id: string;
      url: string;
      fileId: string;
      pageId: string;
      content: MetaSoApiResponse;
    },
    sender: any
  ): Promise<MessageResponse> {
    console.log('[Background] 收到翻译请求:', payload.id);

    // 1. 获取配置
    const config = await indexedDB.getConfig();

    if (!config) {
      return { success: false, error: '请先在配置中设置 API Key' };
    }

    if (!config.apiKey) {
      return { success: false, error: 'API Key 未设置，请在配置中设置' };
    }

    // 2. 检查是否已存在翻译
    const existingTranslation = await indexedDB.getTranslation(payload.id);

    if (existingTranslation && existingTranslation.status === 'completed') {
      console.log('[Background] 翻译已完成，直接返回');
      // 通知 content script
      notifyTranslationReady(sender.tab?.id, payload.id, existingTranslation);
      return { success: true, data: existingTranslation };
    }

    // 3. 开始翻译 - 按页分批翻译
    try {
      const data = payload.content.data;
      const originalMarkdownItems: MetaSoMarkdownItem[] = data.markdown || [];

      if (originalMarkdownItems.length === 0) {
        throw new Error('无法提取要翻译的内容');
      }

      console.log('[Background] 开始按段落智能分批翻译');
      console.log('[Background] 原始内容:', originalMarkdownItems.length, '个 markdown 项');
      console.log('[Background] 翻译提供商:', config.apiProvider, '模型:', config.model);

      const startTime = Date.now();
      let totalTokens = 0;

      // 1. 将所有段落展平
      const paragraphs = flattenMarkdownItems(originalMarkdownItems);
      const totalParagraphs = paragraphs.length;
      console.log('[Background] 共', totalParagraphs, '个段落待翻译');

      // 2. 智能分批（根据模型上下文窗口，默认 8192）
      // 不同模型有不同的上下文窗口，这里使用保守值
      const maxContextTokens = 8192;
      const batches = batchParagraphs(paragraphs, maxContextTokens);
      console.log('[Background] 智能分批为', batches.length, '个批次');

      // 3. 逐批翻译
      const translatedParagraphs = new Map<string, string>();
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const batchText = batch.map(p => p.text).join('\n\n');

        const batchStart = batch[0];
        const batchEnd = batch[batch.length - 1];
        console.log(`[Background] 翻译批次 ${batchIndex + 1}/${batches.length}`);
        console.log(`[Background]   包含段落 ${batchStart.itemIndex}-${batchStart.paragraphIndex} 到 ${batchEnd.itemIndex}-${batchEnd.paragraphIndex}`);
        console.log(`[Background]   批次大小: ${batch.length} 个段落, 约 ${estimateTokens(batchText)} tokens`);

        // 翻译当前批次
        const translationResult = await translationService.translate(batchText, {
          apiKey: config.apiKey,
          apiProvider: config.apiProvider,
          apiEndpoint: config.apiEndpoint,
          model: config.model,
          targetLanguage: config.language,
          maxTokens: 8192,
          temperature: 0.3
        });

        if (!translationResult.success || !translationResult.content) {
          throw new Error(`批次 ${batchIndex + 1} 翻译失败: ${translationResult.error || '未知错误'}`);
        }

        // 将翻译结果按段落分割（使用双换行符分隔）
        const translatedLines = translationResult.content.split('\n\n').map(s => s.trim()).filter(s => s);

        // 存储每个段落的翻译结果
        batch.forEach((para, index) => {
          const key = `${para.itemIndex}-${para.paragraphIndex}`;
          const translatedText = translatedLines[index] || para.text;
          translatedParagraphs.set(key, translatedText.trimEnd() + '\n\n');
        });

        totalTokens += translationResult.meta?.tokenCount || 0;
        console.log(`[Background]   批次 ${batchIndex + 1} 翻译完成`);
      }

      // 4. 重新组装为原始结构
      const translatedItems = assembleTranslatedContent(originalMarkdownItems, translatedParagraphs);

      const duration = Date.now() - startTime;
      console.log('[Background] 所有段落翻译完成，总耗时:', duration, 'ms');
      console.log('[Background] 总 token 数:', totalTokens);

      // 构造符合原始 API 格式的翻译响应
      const translatedContent: MetaSoApiResponse = {
        errCode: 0,
        errMsg: 'success',
        data: {
          lang: config.language,
          total_page: data.total_page,
          markdown: translatedItems
        }
      };

      // 存储翻译结果
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

      // 通知 content script
      notifyTranslationReady(sender.tab?.id, payload.id, translationEntry);

      return { success: true, data: translationEntry };

    } catch (error) {
      console.error('[Background] 翻译失败:', error);

      // 存储失败的翻译记录
      await indexedDB.setTranslation({
        id: payload.id,
        contentId: payload.id,
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

      return { success: false, error: error instanceof Error ? error.message : '翻译失败' };
    }
  }

  /**
   * 获取翻译结果
   */
  async function getTranslation(payload: { id: string }): Promise<MessageResponse> {
    const translation = await indexedDB.getTranslation(payload.id);

    if (translation && translation.status === 'completed') {
      return { success: true, data: translation };
    }

    return { success: false, error: 'Translation not found' };
  }

  /**
   * 获取配置
   */
  async function getConfig(): Promise<MessageResponse> {
    const config = await indexedDB.getConfig();
    return { success: true, data: config };
  }

  /**
   * 更新配置
   */
  async function updateConfig(payload: Partial<Omit<ConfigEntry, 'id'>>): Promise<MessageResponse> {
    const existingConfig = await indexedDB.getConfig();
    const now = Date.now();

    const newConfig: ConfigEntry = {
      id: 'config',
      apiKey: payload.apiKey || existingConfig?.apiKey || '',
      apiProvider: payload.apiProvider || existingConfig?.apiProvider || 'openai',
      apiEndpoint: payload.apiEndpoint || existingConfig?.apiEndpoint,
      model: payload.model || existingConfig?.model || 'gpt-3.5-turbo',
      language: payload.language || existingConfig?.language || 'zh-CN',
      createdAt: existingConfig?.createdAt || now,
      updatedAt: now
    };

    await indexedDB.setConfig(newConfig);
    console.log('[Background] 配置已更新');

    return { success: true, data: newConfig };
  }

  /**
   * 获取历史记录
   */
  async function getHistory(): Promise<MessageResponse> {
    const translations = await indexedDB.getCompletedTranslations();
    return { success: true, data: translations };
  }

  /**
   * 删除翻译记录
   */
  async function deleteTranslation(payload: { id: string }): Promise<MessageResponse> {
    await indexedDB.deleteTranslation(payload.id);
    return { success: true };
  }

  /**
   * 清空所有数据
   */
  async function clearAll(): Promise<MessageResponse> {
    await indexedDB.clearAll();
    return { success: true };
  }

  // ========================================================================
  // 工具函数
  // ========================================================================

  /**
   * 通知 content script 翻译完成
   */
  function notifyTranslationReady(tabId: number | undefined, id: string, translation: TranslationEntry) {
    if (!tabId) {
      console.warn('[Background] No tab ID, cannot notify');
      return;
    }

    browser.tabs.sendMessage(tabId, {
      type: 'TRANSLATION_READY',
      payload: {
        id,
        translation
      }
    }).catch(error => {
      console.error('[Background] Failed to send translation ready message:', error);
    });
  }

  /**
   * 估算 Token 数量
   * 粗略估计：英文 1 token ≈ 4 characters，中文 1 token ≈ 2 characters
   */
  function estimateTokens(text: string): number {
    // 统计中文字符
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    // 统计非中文字符
    const otherChars = text.length - chineseChars;

    // 中文：2 字符/token，其他：4 字符/token
    return Math.ceil(chineseChars / 2) + Math.ceil(otherChars / 4);
  }

  /**
   * 段落信息：用于跟踪每个段落的原始位置
   */
  interface ParagraphInfo {
    text: string;
    itemIndex: number;     // 在 originalMarkdownItems 中的索引
    paragraphIndex: number; // 在该 item 的 markdown 数组中的索引
    estimatedTokens: number;
  }

  /**
   * 将所有 markdown 项展平为段落列表
   */
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

  /**
   * 智能分批：根据上下文窗口大小将段落分批
   * @param paragraphs 所有段落
   * @param maxTokens 每批的最大 token 数量（包含提示词和响应的预留空间）
   * @returns 分批后的段落数组
   */
  function batchParagraphs(paragraphs: ParagraphInfo[], maxTokens: number): ParagraphInfo[][] {
    const batches: ParagraphInfo[][] = [];
    let currentBatch: ParagraphInfo[] = [];
    let currentBatchTokens = 0;

    // 预留空间给系统提示词和响应（约 1000 tokens）
    const safeMaxTokens = maxTokens - 1000;

    for (const paragraph of paragraphs) {
      const estimatedTokens = paragraph.estimatedTokens;

      // 如果单个段落就超过安全限制，仍然需要翻译（可能失败，但总比不尝试好）
      if (estimatedTokens > safeMaxTokens) {
        // 如果当前批次不为空，先保存
        if (currentBatch.length > 0) {
          batches.push(currentBatch);
          currentBatch = [];
          currentBatchTokens = 0;
        }
        // 将大段落单独作为一个批次
        batches.push([paragraph]);
        continue;
      }

      // 如果添加这个段落会超过限制，先保存当前批次
      if (currentBatchTokens + estimatedTokens > safeMaxTokens && currentBatch.length > 0) {
        batches.push(currentBatch);
        currentBatch = [];
        currentBatchTokens = 0;
      }

      currentBatch.push(paragraph);
      currentBatchTokens += estimatedTokens;
    }

    // 保存最后一个批次
    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    return batches;
  }

  /**
   * 将翻译结果重新组装为原始的 markdown 结构
   */
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
