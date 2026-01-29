// entrypoints/content.ts
// 内容脚本：作为 injected script 和 background 之间的桥梁

import type { Message, MessageResponse, MetaSoApiResponse } from '@/types';
import { renderConsentModal, removeConsentModal } from './ui/consentModal';
import {
  showTranslatingNotification,
  showCacheDetectedNotification,
  showTranslationSuccessNotification,
  showErrorNotification
} from './ui/notificationManager';

// ============================================================================
// 常量配置
// ============================================================================
const CONFIG = {
  MESSAGE_TYPES: {
    INJECTED_SCRIPT_READY: 'INJECTED_SCRIPT_READY',
    CONTENT_SCRIPT_READY: 'CONTENT_SCRIPT_READY',
    ORIGINAL_REQUEST: 'ORIGINAL_REQUEST',
    GET_TRANSLATION: 'GET_TRANSLATION',
    TRANSLATION_READY: 'TRANSLATION_READY',
    SHOW_CONSENT_PROMPT: 'SHOW_CONSENT_PROMPT',
  } as const,
} as const;

// ============================================================================
// 类型定义
// ============================================================================
interface PostedMessage {
  type: string;
  payload?: unknown;
}

interface OriginalRequestPayload {
  id: string;
  url: string;
  fileId: string;
  pageId: string;
  content: MetaSoApiResponse;
  estimatedTokens?: number;
}

interface TranslationRequestPayload {
  id: string;
  url: string;
  fileId: string;
  pageId: string;
  content: MetaSoApiResponse;
}

interface GetTranslationPayload {
  id: string;
}

// ============================================================================
// 主脚本
// ============================================================================
export default defineContentScript({
  matches: ['*://metaso.cn/*'],

  main() {
    console.log('[MetaSo Translator] Content script 已加载');

    // 捕获所有未处理的 Promise rejection
    window.addEventListener('unhandledrejection', (event) => {
      if (event.reason instanceof Error && event.reason.message.includes('Extension context invalidated')) {
        console.warn('[MetaSo Translator] Extension context invalidated (caught by unhandledrejection)');
        event.preventDefault();
      } else {
        console.error('[MetaSo Translator] Unhandled promise rejection:', event.reason);
      }
    });

    injectScript('/injected.js', {
      keepInDom: true,
    });

    // ========================================================================
    // 消息通信
    // ========================================================================

    function sendMessageToBackground(message: Message): Promise<MessageResponse> {
      return new Promise((resolve) => {
        const handleResponse = (response: unknown) => {
          if (browser.runtime.lastError) {
            console.error('[MetaSo Translator] Background communication error:', browser.runtime.lastError);
            resolve({ success: false, error: browser.runtime.lastError.message || 'Communication error' });
            return;
          }

          if (response && typeof response === 'object') {
            resolve(response as MessageResponse);
          } else {
            console.error('[MetaSo Translator] Invalid response from background:', response);
            resolve({ success: false, error: 'Invalid response from background' });
          }
        };

        try {
          browser.runtime.sendMessage(message, handleResponse);
        } catch (error) {
          // 扩展上下文失效时，sendMessage 会抛出错误
          console.warn('[MetaSo Translator] Extension context invalidated:', error);
          resolve({ success: false, error: 'Extension context invalidated' });
        }
      });
    }

    // ========================================================================
    // 监听 injected script 消息
    // ========================================================================
    window.addEventListener('message', async (event: MessageEvent) => {
      if (event.source !== window) return;

      const message = event.data as PostedMessage;

      try {
        switch (message.type) {
          case CONFIG.MESSAGE_TYPES.INJECTED_SCRIPT_READY:
            console.log('[MetaSo Translator] Injected script 已就绪');
            break;

          case CONFIG.MESSAGE_TYPES.ORIGINAL_REQUEST:
            await handleOriginalRequest(message.payload as OriginalRequestPayload);
            break;

          case CONFIG.MESSAGE_TYPES.GET_TRANSLATION:
            await handleGetTranslation(message.payload as GetTranslationPayload);
            break;
        }
      } catch (error) {
        // 扩展上下文失效时静默处理
        if (error instanceof Error && error.message.includes('Extension context invalidated')) {
          console.warn('[MetaSo Translator] 扩展上下文失效，请刷新页面');
        } else {
          console.error('[MetaSo Translator] Message handling error:', error);
        }
      }
    });

    // ========================================================================
    // 监听 background 消息
    // ========================================================================
    try {
      browser.runtime.onMessage.addListener((message: Message, _sender: unknown, sendResponse: (response: MessageResponse) => void) => {
        handleMessage(message)
          .then((response) => {
            try {
              sendResponse(response);
            } catch (e) {
              // 扩展上下文失效时静默处理
              console.warn('[MetaSo Translator] Failed to send response:', e);
            }
          })
          .catch((error) => {
            console.error('[MetaSo Translator] Message handling error:', error);
            try {
              sendResponse({ success: false, error: error.message });
            } catch {
              // sendResponse 也失败时，忽略错误
            }
          });
        return true;
      });
    } catch (error) {
      console.warn('[MetaSo Translator] Failed to add message listener:', error);
    }

    // ========================================================================
    // 消息处理函数
    // ========================================================================

    async function handleOriginalRequest(payload: OriginalRequestPayload): Promise<void> {
      console.log('[MetaSo Translator] 处理原始请求:', payload.id);

      // 首先检查是否已有翻译缓存（场景 B）
      const translationResponse = await sendMessageToBackground({
        type: 'GET_TRANSLATION',
        payload: { id: payload.id }
      });

      if (translationResponse.success && translationResponse.data) {
        console.log('[MetaSo Translator] 场景 B: 发现已存在翻译缓存，显示通知');
        // 场景 B: 显示缓存检测通知，并直接使用缓存
        showCacheDetectedNotification();

        // 通知 injected script 返回缓存翻译
        window.postMessage({
          type: 'TRANSLATION_READY',
          payload: {
            id: payload.id,
            translation: translationResponse.data
          }
        }, '*');
        return;
      }

      // 没有缓存，存储原始内容并检查是否需要翻译
      const response = await sendMessageToBackground({
        type: 'ORIGINAL_REQUEST',
        payload
      });

      if (!response.success) {
        console.error('[MetaSo Translator] 存储失败:', response.error);
        return;
      }

      if (response.data?.needTranslation) {
        showConsentModal({
          id: payload.id,
          url: payload.url,
          fileId: payload.fileId,
          pageId: payload.pageId,
          content: payload.content,
          estimatedTokens: response.data.estimatedTokens
        });
      }
    }

    async function handleGetTranslation(payload: GetTranslationPayload): Promise<void> {
      console.log('[MetaSo Translator] 获取翻译:', payload.id);

      const response = await sendMessageToBackground({
        type: 'GET_TRANSLATION',
        payload
      });

      if (response.success && response.data) {
        console.log('[MetaSo Translator] 找到已存在的翻译');
        window.postMessage({
          type: 'TRANSLATION_READY',
          payload: {
            id: payload.id,
            translation: response.data
          }
        }, '*');
      } else {
        console.log('[MetaSo Translator] 翻译不存在，需要先翻译');
      }
    }

    async function handleMessage(message: Message): Promise<MessageResponse> {
      switch (message.type) {
        case 'TRANSLATION_READY':
          showTranslationSuccessNotification();
          window.postMessage(message, '*');
          return { success: true };

        case 'SHOW_CONSENT_PROMPT':
          console.log('[MetaSo Translator] 收到显示同意弹窗请求');
          return { success: true };

        default:
          return { success: false, error: 'Unknown message type' };
      }
    }

    // ========================================================================
    // UI 处理函数
    // ========================================================================

    function showConsentModal(data: OriginalRequestPayload): void {
      removeConsentModal();

      const modalElement = renderConsentModal(data);

      document.body.appendChild(modalElement);

      const cancelBtn = document.getElementById('metaso-translation-btn-cancel');
      const approveBtn = document.getElementById('metaso-translation-btn-approve');

      cancelBtn?.addEventListener('click', () => {
        console.log('[Metaso Translator] 用户取消翻译');
        removeConsentModal();
      });

      approveBtn?.addEventListener('click', () => {
        console.log('[MetaSo Translator] 用户同意翻译');
        requestTranslation(data);
        removeConsentModal();

        // 场景 A: 显示"正在翻译"通知
        showTranslatingNotification();
      });
    }

    async function requestTranslation(data: TranslationRequestPayload): Promise<void> {
      const response = await sendMessageToBackground({
        type: 'REQUEST_TRANSLATION',
        payload: data
      });

      if (!response.success) {
        console.error('[MetaSo Translator] 请求翻译失败:', response.error);
        showErrorNotification('翻译失败: ' + response.error);
      }
    }

    // ========================================================================
    // 初始化
    // ========================================================================
    window.postMessage({
      type: CONFIG.MESSAGE_TYPES.CONTENT_SCRIPT_READY
    }, '*');
  },
});
