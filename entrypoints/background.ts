// entrypoints/background.ts
// 后台服务：管理存储、翻译调度、消息处理

import { indexedDB } from '@/utils/indexedDB';
import { generateObjectHash } from '@/utils/hash';
import { translationService } from '@/services/translation';
import type { Message, MessageResponse, ContentEntry, TranslationEntry, ConfigEntry } from '@/types';

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
    content: any;
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
    // 安全地提取 markdown 内容
    // 实际 API 响应格式: { errCode: 0, data: { markdown: [{ markdown: ["line1", "line2"], page: 0 }] } }
    let markdown = '';
    try {
      if (payload.content && typeof payload.content === 'object') {
        // 实际格式：{ errCode: 0, data: { markdown: [...] } }
        const data = (payload.content as any).data;

        if (data && Array.isArray(data.markdown)) {
          // markdown 是一个数组，每个元素包含 markdown 数组和 page
          // 将所有 markdown 数组合并成一个字符串
          const allMarkdown: string[] = [];
          data.markdown.forEach((item: any) => {
            if (item.markdown && Array.isArray(item.markdown)) {
              allMarkdown.push(...item.markdown);
            }
          });
          markdown = allMarkdown.join('\n');
        } else if (typeof data.markdown === 'string') {
          markdown = data.markdown;
        }
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
      content: any;
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

    // 3. 开始翻译
    try {
      // 安全地提取 markdown 内容，保留原始结构
      // 实际 API 响应格式: { errCode: 0, data: { markdown: [{ markdown: ["line1", "line2"], markdown_lang: [...], page: 0 }] } }
      const data = (payload.content as any).data;
      let originalMarkdownItems: any[] = [];

      if (data && Array.isArray(data.markdown)) {
        originalMarkdownItems = data.markdown;
      }

      if (originalMarkdownItems.length === 0) {
        throw new Error('无法提取要翻译的内容');
      }

      // 提取所有原始文本进行翻译
      const allOriginalText: string[] = [];
      originalMarkdownItems.forEach((item: any) => {
        if (item.markdown && Array.isArray(item.markdown)) {
          allOriginalText.push(...item.markdown);
        }
      });

      const markdownToTranslate = allOriginalText.join('\n');
      console.log('[Background] 提取的 markdown 长度:', markdownToTranslate.length);
      console.log('[Background] 开始翻译，提供商:', config.apiProvider, '模型:', config.model);

      // 调用翻译服务
      const translationResult = await translationService.translate(markdownToTranslate, {
        apiKey: config.apiKey,
        apiProvider: config.apiProvider,
        apiEndpoint: config.apiEndpoint,
        model: config.model,
        targetLanguage: config.language,
        maxTokens: 8192,
        temperature: 0.3
      });

      if (!translationResult.success || !translationResult.content) {
        throw new Error(translationResult.error || '翻译失败');
      }

      console.log('[Background] 翻译完成');

      // 构造符合原始 API 格式的翻译响应
      // 格式: { errCode: 0, data: { markdown: [{ markdown_lang: [...翻译], markdown: [...原文], page: N }] } }
      const translatedLines = translationResult.content.split('\n');

      // 创建一个映射，将原始文本索引映射到翻译后的文本
      // 简单策略：按行数比例分配翻译结果
      const translatedContent = {
        errCode: 0,
        errMsg: 'success',
        data: {
          lang: config.language,
          total_page: data.total_page,
          markdown: originalMarkdownItems.map((originalItem: any, itemIndex: number) => {
            // 计算该项在总文本中的位置
            let startLineIndex = 0;
            for (let i = 0; i < itemIndex; i++) {
              if (originalMarkdownItems[i].markdown && Array.isArray(originalMarkdownItems[i].markdown)) {
                startLineIndex += originalMarkdownItems[i].markdown.length;
              }
            }

            // 获取对应项的翻译内容
            const itemLineCount = (originalItem.markdown && Array.isArray(originalItem.markdown))
              ? originalItem.markdown.length
              : 0;

            const itemTranslatedLines = translatedLines.slice(startLineIndex, startLineIndex + itemLineCount);

            return {
              markdown_lang: itemTranslatedLines.length > 0 ? itemTranslatedLines : [''],
              markdown: originalItem.markdown || [],
              page: originalItem.page || 0,
              could_translate: true
            };
          })
        }
      };

      // 存储翻译结果（简化格式，只存储实际的 markdown 字符串）
      const translationEntry: TranslationEntry = {
        id: payload.id,
        contentId: payload.id,
        translatedContent: translatedContent,
        meta: {
          translatedAt: translationResult.meta?.translatedAt || Date.now(),
          model: config.model,
          provider: config.apiProvider,
          tokenCount: translationResult.meta?.tokenCount || 0,
          duration: translationResult.meta?.duration || 0
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
});
