// entrypoints/content.ts
// 内容脚本：作为 injected script 和 background 之间的桥梁

import type { Message, MessageResponse, MetaSoApiResponse } from '@/types';

export default defineContentScript({
  matches: ['*://metaso.cn/*'],

  main() {
    console.log('[MetaSo Translator] Content script 已加载');

    // 注入 injected script
    injectScript('/injected.js', {
      keepInDom: true,
    });

    // 创建同意弹窗容器
    let consentModalContainer: HTMLElement | null = null;

    // ========================================================================
    // 监听 injected script 消息
    // ========================================================================
    window.addEventListener('message', async (event) => {
      if (event.source !== window) return;

      switch (event.data.type) {
        case 'INJECTED_SCRIPT_READY':
          console.log('[MetaSo Translator] Injected script 已就绪');
          break;

        case 'ORIGINAL_REQUEST':
          await handleOriginalRequest(event.data.payload);
          break;

        case 'GET_TRANSLATION':
          await handleGetTranslation(event.data.payload);
          break;
      }
    });

    // ========================================================================
    // 监听 background 消息
    // ========================================================================
    browser.runtime.onMessage.addListener((message: Message, _sender: any, sendResponse: (response: any) => void) => {
      handleMessage(message)
        .then(sendResponse)
        .catch((error) => {
          console.error('[MetaSo Translator] Message handling error:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // 保持消息通道开放以支持异步响应
    });

    // ========================================================================
    // 消息处理函数
    // ========================================================================

    /**
     * 处理原始请求
     */
    async function handleOriginalRequest(payload: any) {
      console.log('[MetaSo Translator] 处理原始请求:', payload.id);
      console.log('[MetaSo Translator] 原始请求内容:', payload.content);

      // 发送给 background 存储并检查翻译
      const response = await sendMessageToBackground({
        type: 'ORIGINAL_REQUEST',
        payload
      });

      if (!response.success) {
        console.error('[MetaSo Translator] 存储失败:', response.error);
        return;
      }

      // 如果需要翻译，显示同意弹窗
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

    /**
     * 处理获取翻译请求
     */
    async function handleGetTranslation(payload: { id: string }) {
      console.log('[MetaSo Translator] 获取翻译:', payload.id);

      const response = await sendMessageToBackground({
        type: 'GET_TRANSLATION',
        payload
      });

      if (response.success && response.data) {
        // 翻译存在，直接返回
        console.log('[MetaSo Translator] 找到已存在的翻译');
        window.postMessage({
          type: 'TRANSLATION_READY',
          payload: {
            id: payload.id,
            translation: response.data
          }
        }, '*');
      } else {
        // 翻译不存在，需要先翻译
        console.log('[MetaSo Translator] 翻译不存在，需要先翻译');
      }
    }

    /**
     * 处理所有来自 background 的消息
     */
    async function handleMessage(message: Message): Promise<MessageResponse> {
      switch (message.type) {
        case 'TRANSLATION_READY':
          // 转发给 injected script
          window.postMessage(message, '*');
          return { success: true };

        case 'SHOW_CONSENT_PROMPT':
          // 显示同意弹窗（需要从 content 获取完整数据）
          console.log('[MetaSo Translator] 收到显示同意弹窗请求');
          return { success: true };

        default:
          return { success: false, error: 'Unknown message type' };
      }
    }

    /**
     * 发送消息到 background
     */
    async function sendMessageToBackground(message: Message): Promise<MessageResponse> {
      return new Promise((resolve) => {
        const handleResponse = (response: any) => {
          // 检查是否有错误
          if (browser.runtime.lastError) {
            console.error('[MetaSo Translator] Background communication error:', browser.runtime.lastError);
            resolve({ success: false, error: browser.runtime.lastError.message || 'Communication error' });
            return;
          }

          // 检查响应是否有效
          if (response && typeof response === 'object') {
            resolve(response);
          } else {
            console.error('[MetaSo Translator] Invalid response from background:', response);
            resolve({ success: false, error: 'Invalid response from background' });
          }
        };

        browser.runtime.sendMessage(message, handleResponse);

        // // 设置超时（60秒）- 翻译可能需要较长时间
        // setTimeout(() => {
        //   resolve({ success: false, error: 'Request timeout - no response from background' });
        // }, 60000);
      });
    }

    // ========================================================================
    // 同意弹窗 UI
    // ========================================================================

    /**
     * 显示同意弹窗
     */
    function showConsentModal(data: {
      id: string;
      url: string;
      fileId: string;
      pageId: string;
      content: MetaSoApiResponse;
      estimatedTokens?: number;
    }) {
      // 如果已存在弹窗，先移除
      removeConsentModal();

      // 安全地提取 markdown 内容用于预览
      // 实际 API 响应格式: { errCode: 0, data: { markdown: [{ markdown: ["line1", "line2"], page: 0 }] } }
      let previewContent = '';
      try {
        const responseData = data.content.data;

        if (responseData && Array.isArray(responseData.markdown)) {
          // markdown 是一个数组，每个元素包含 markdown 数组
          const allMarkdown: string[] = [];
          responseData.markdown.forEach((item) => {
            if (item.markdown && Array.isArray(item.markdown)) {
              allMarkdown.push(...item.markdown);
            }
          });
          previewContent = allMarkdown.join('\n');
        } else if (responseData && typeof responseData.markdown === 'string') {
          previewContent = responseData.markdown;
        }

        // 确保 previewContent 是字符串
        if (typeof previewContent !== 'string') {
          previewContent = JSON.stringify(previewContent);
        }

        // 截取前 300 个字符
        if (previewContent.length > 300) {
          previewContent = previewContent.substring(0, 300) + '...';
        }
      } catch (error) {
        console.error('[MetaSo Translator] 无法提取预览内容:', error);
        previewContent = '(无法预览内容)';
      }

      // 创建弹窗容器
      consentModalContainer = document.createElement('div');
      consentModalContainer.id = 'metaso-translator-consent-modal';
      consentModalContainer.innerHTML = `
        <style>
          #metaso-translator-consent-modal {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }

          #metaso-translator-consent-modal .consent-dialog {
            background: white;
            border-radius: 12px;
            padding: 24px;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
          }

          #metaso-translator-consent-modal .consent-dialog h3 {
            margin: 0 0 16px 0;
            font-size: 18px;
            font-weight: 600;
            color: #333;
          }

          #metaso-translator-consent-modal .consent-dialog .info {
            margin-bottom: 16px;
            font-size: 14px;
            color: #666;
          }

          #metaso-translator-consent-modal .consent-dialog .preview {
            background: #f5f5f5;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 16px;
            font-size: 13px;
            color: #333;
            max-height: 200px;
            overflow-y: auto;
            white-space: pre-wrap;
            word-break: break-word;
          }

          #metaso-translator-consent-modal .consent-dialog .token-info {
            margin-bottom: 16px;
            font-size: 14px;
            color: #666;
          }

          #metaso-translator-consent-modal .consent-dialog .actions {
            display: flex;
            gap: 12px;
            justify-content: flex-end;
          }

          #metaso-translator-consent-modal .consent-dialog button {
            padding: 10px 20px;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.2s;
          }

          #metaso-translator-consent-modal .consent-dialog .btn-cancel {
            background: #e0e0e0;
            color: #333;
          }

          #metaso-translator-consent-modal .consent-dialog .btn-cancel:hover {
            background: #d0d0d0;
          }

          #metaso-translator-consent-modal .consent-dialog .btn-approve {
            background: #4CAF50;
            color: white;
          }

          #metaso-translator-consent-modal .consent-dialog .btn-approve:hover {
            background: #45a049;
          }
        </style>

        <div class="consent-dialog">
          <h3>🌐 翻译内容确认</h3>

          <div class="info">
            <p><strong>页面 ID:</strong> ${data.fileId}-${data.pageId}</p>
          </div>

          <div class="preview">${escapeHtml(previewContent)}</div>

          ${data.estimatedTokens ? `
            <div class="token-info">
              预计 Token 使用量: ~${data.estimatedTokens}
            </div>
          ` : ''}

          <div class="actions">
            <button class="btn-cancel" id="metaso-translation-btn-cancel">取消</button>
            <button class="btn-approve" id="metaso-translation-btn-approve">同意翻译</button>
          </div>
        </div>
      `;

      document.body.appendChild(consentModalContainer);

      // 绑定按钮事件
      const cancelBtn = document.getElementById('metaso-translation-btn-cancel');
      const approveBtn = document.getElementById('metaso-translation-btn-approve');

      cancelBtn?.addEventListener('click', () => {
        console.log('[MetaSo Translator] 用户取消翻译');
        removeConsentModal();
      });

      approveBtn?.addEventListener('click', () => {
        console.log('[MetaSo Translator] 用户同意翻译');
        requestTranslation(data);
        removeConsentModal();
      });
    }

    /**
     * 移除同意弹窗
     */
    function removeConsentModal() {
      if (consentModalContainer && consentModalContainer.parentNode) {
        consentModalContainer.parentNode.removeChild(consentModalContainer);
        consentModalContainer = null;
      }
    }

    /**
     * 请求翻译
     */
    async function requestTranslation(data: {
      id: string;
      url: string;
      fileId: string;
      pageId: string;
      content: any;
    }) {
      const response = await sendMessageToBackground({
        type: 'REQUEST_TRANSLATION',
        payload: data
      });

      if (!response.success) {
        console.error('[MetaSo Translator] 请求翻译失败:', response.error);
        // 显示错误提示
        showError('翻译失败: ' + response.error);
      } else {
        console.log('[MetaSo Translator] 翻译请求已提交');
        // 显示加载提示
        showLoading('正在翻译中...');
      }
    }

    /**
     * 显示错误提示
     */
    function showError(message: string) {
      const toast = document.createElement('div');
      toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #f44336;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
      `;
      toast.textContent = message;
      document.body.appendChild(toast);

      setTimeout(() => {
        toast.remove();
      }, 5000);
    }

    /**
     * 显示加载提示
     */
    function showLoading(message: string) {
      const toast = document.createElement('div');
      toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #2196F3;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
      `;
      toast.textContent = message;
      document.body.appendChild(toast);

      setTimeout(() => {
        toast.remove();
      }, 3000);
    }

    /**
     * HTML 转义
     */
    function escapeHtml(text: string): string {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // 通知 injected script content script 已就绪
    window.postMessage({
      type: 'CONTENT_SCRIPT_READY'
    }, '*');
  },
});
