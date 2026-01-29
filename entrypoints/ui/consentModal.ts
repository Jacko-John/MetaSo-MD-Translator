// entrypoints/ui/consentModal.ts
// UI 组件：同意弹窗和 Toast 通知

import type { MetaSoApiResponse } from '@/types';

// ============================================================================
// 常量配置
// ============================================================================
const CONFIG = {
  UI: {
    MODAL: {
      PREVIEW_MAX_LENGTH: 300,
      Z_INDEX: 999999,
    },
  },
} as const;

// ============================================================================
// 类型定义
// ============================================================================
export interface ConsentModalData {
  id: string;
  url: string;
  fileId: string;
  pageId: string;
  content: MetaSoApiResponse;
  estimatedTokens?: number;
}

let consentModalContainer: HTMLElement | null = null;

// ============================================================================
// 工具函数
// ============================================================================
function extractPreviewContent(content: MetaSoApiResponse, maxLength: number = CONFIG.UI.MODAL.PREVIEW_MAX_LENGTH): string {
  try {
    const responseData = content.data;

    if (!responseData?.markdown) {
      return '(无法预览内容)';
    }

    const markdown = responseData.markdown;

    // 处理数组类型
    if (Array.isArray(markdown)) {
      const allMarkdown: string[] = [];
      markdown.forEach((item) => {
        if (item.markdown && Array.isArray(item.markdown)) {
          allMarkdown.push(...item.markdown);
        }
      });
      const text = allMarkdown.join('\n');
      return truncateText(text, maxLength);
    }

    // 处理字符串类型
    if (typeof markdown === 'string') {
      return truncateText(markdown, maxLength);
    }

    return '(无法预览内容)';
  } catch (error) {
    console.error('[MetaSo Translator] 无法提取预览内容:', error);
    return '(无法预览内容)';
  }
}

function truncateText(text: string, maxLength: number): string {
  return text.length > maxLength
    ? text.substring(0, maxLength) + '...'
    : text;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================================================
// 同意弹窗
// ============================================================================
export function renderConsentModal(data: ConsentModalData): HTMLElement {
  const previewContent = extractPreviewContent(data.content);

  const container = document.createElement('div');
  container.id = 'metaso-translator-consent-modal';

  container.innerHTML = `
    ${getModalStyles()}

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

  consentModalContainer = container;
  return container;
}

export function removeConsentModal(): void {
  if (consentModalContainer?.parentNode) {
    consentModalContainer.parentNode.removeChild(consentModalContainer);
    consentModalContainer = null;
  }
}

function getModalStyles(): string {
  return `
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
        z-index: ${CONFIG.UI.MODAL.Z_INDEX};
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
  `;
}
