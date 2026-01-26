// entrypoints/content.ts
// 内容脚本：作为 injected script 和 background 之间的桥梁

import type { Message, MessageResponse, MetaSoApiResponse } from '@/types';
import { renderConsentModal, showToast, removeConsentModal } from './ui/consentModal';

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

        browser.runtime.sendMessage(message, handleResponse);
      });
    }

    // ========================================================================
    // 监听 injected script 消息
    // ========================================================================
    window.addEventListener('message', async (event: MessageEvent) => {
      if (event.source !== window) return;

      const message = event.data as PostedMessage;

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
    });

    // ========================================================================
    // 监听 background 消息
    // ========================================================================
    browser.runtime.onMessage.addListener((message: Message, _sender: unknown, sendResponse: (response: MessageResponse) => void) => {
      handleMessage(message)
        .then(sendResponse)
        .catch((error) => {
          console.error('[MetaSo Translator] Message handling error:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true;
    });

    // ========================================================================
    // 消息处理函数
    // ========================================================================

    async function handleOriginalRequest(payload: OriginalRequestPayload): Promise<void> {
      console.log('[MetaSo Translator] 处理原始请求:', payload.id);
      console.log('[MetaSo Translator] 原始请求内容:', payload.content);

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
      });
    }

    async function requestTranslation(data: TranslationRequestPayload): Promise<void> {
      const response = await sendMessageToBackground({
        type: 'REQUEST_TRANSLATION',
        payload: data
      });

      if (!response.success) {
        console.error('[MetaSo Translator] 请求翻译失败:', response.error);
        showToast('翻译失败: ' + response.error, 'error');
      } else {
        console.log('[MetaSo Translator] 翻译请求已提交');
        showToast('正在翻译中...', 'loading');
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
