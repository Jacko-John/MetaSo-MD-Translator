// entrypoints/injected.ts
// 注入到 MetaSo 页面的主世界脚本，用于拦截 fetch 和 XHR 请求

import { parseMetaSoUrl, generateContentId } from '@/utils/urlParser';
import type { MetaSoApiResponse, TranslationEntry } from '@/types';
import { showCacheLoadedNotification } from './ui/notificationManager';

// ============================================================================
// 常量定义
// ============================================================================
const TRANSLATION_TIMEOUT = 30000;
const MESSAGE_TYPES = {
  CONTENT_SCRIPT_READY: 'CONTENT_SCRIPT_READY',
  INJECTED_SCRIPT_READY: 'INJECTED_SCRIPT_READY',
  ORIGINAL_REQUEST: 'ORIGINAL_REQUEST',
  GET_TRANSLATION: 'GET_TRANSLATION',
  TRANSLATION_READY: 'TRANSLATION_READY',
} as const;

// ============================================================================
// 类型定义
// ============================================================================
type MessagePayloadType = typeof MESSAGE_TYPES[keyof typeof MESSAGE_TYPES];

interface PostedMessage {
  type: MessagePayloadType;
  payload?: PostedMessagePayload;
}

interface PostedMessagePayload {
  id?: string;
  url?: string;
  fileId?: string;
  pageId?: string;
  content?: MetaSoApiResponse;
  translation?: TranslationEntry;
}

interface WindowMessageEvent extends MessageEvent {
  source: Window;
  data: PostedMessage;
}

// ============================================================================
// 状态管理
// ============================================================================
interface State {
  translationCache: Map<string, MetaSoApiResponse>;
  pendingTranslations: Map<string, Promise<TranslationEntry>>;
  isExtensionContextValid: boolean;
}

const state: State = {
  translationCache: new Map(),
  pendingTranslations: new Map(),
  isExtensionContextValid: true,
};

export default defineUnlistedScript(() => {
  console.log('[MetaSo Translator] 注入成功');

  const { fetch: originalFetch } = window;

  // ============================================================================
  // 工具函数
  // ============================================================================
  function createJsonResponse(data: MetaSoApiResponse): Response {
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  function postMessage(type: MessagePayloadType, payload?: PostedMessagePayload): boolean {
    try {
      window.postMessage({ type, payload }, '*');
      return true;
    } catch (error) {
      console.error('[MetaSo Translator] PostMessage failed:', error);
      state.isExtensionContextValid = false;
      return false;
    }
  }

  /**
   * 检查扩展上下文是否有效
   */
  function isContextValid(): boolean {
    return state.isExtensionContextValid;
  }

  function getCachedTranslation(id: string): MetaSoApiResponse | undefined {
    return state.translationCache.get(id);
  }

  function cacheTranslation(id: string, content: MetaSoApiResponse): void {
    state.translationCache.set(id, content);
  }

  // ============================================================================
  // 翻译等待机制
  // ============================================================================
  function waitForTranslation(id: string): Promise<TranslationEntry> {
    if (state.pendingTranslations.has(id)) {
      return state.pendingTranslations.get(id)!;
    }

    const translationPromise = new Promise<TranslationEntry>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        state.pendingTranslations.delete(id);
        window.removeEventListener('message', messageHandler);
        reject(new Error(`Translation timeout for ${id}`));
      }, TRANSLATION_TIMEOUT);

      const messageHandler = (event: MessageEvent) => {
        const windowEvent = event as WindowMessageEvent;
        if (windowEvent.source !== window) return;
        if (windowEvent.data.type === MESSAGE_TYPES.TRANSLATION_READY && windowEvent.data.payload?.id === id) {
          clearTimeout(timeoutId);
          window.removeEventListener('message', messageHandler);
          resolve(windowEvent.data.payload.translation!);
        }
      };

      window.addEventListener('message', messageHandler);
    });

    state.pendingTranslations.set(id, translationPromise);
    return translationPromise;
  }

  // ============================================================================
  // XHR 响应模拟
  // ============================================================================
  function setXHRResponse(xhr: XMLHttpRequest, data: MetaSoApiResponse): void {
    const jsonData = JSON.stringify(data);
    Object.defineProperty(xhr, 'response', { value: jsonData });
    Object.defineProperty(xhr, 'responseText', { value: jsonData });
    Object.defineProperty(xhr, 'status', { value: 200 });
    Object.defineProperty(xhr, 'readyState', { value: 4 });
    xhr.dispatchEvent(new Event('load'));
    xhr.dispatchEvent(new Event('loadend'));
  }

  // ============================================================================
  // 处理原始请求
  // ============================================================================
  function handleOriginalRequest(
    id: string,
    url: string,
    fileId: string,
    pageId: string,
    content: MetaSoApiResponse
  ): void {
    if (!isContextValid()) {
      console.warn('[MetaSo Translator] Extension context invalidated, skipping original request handling');
      return;
    }
    postMessage(MESSAGE_TYPES.ORIGINAL_REQUEST, { id, url, fileId, pageId, content });
  }

  // ============================================================================
  // 处理翻译请求（通用逻辑）
  // ============================================================================
  async function handleTranslationRequest(id: string): Promise<MetaSoApiResponse> {
    if (!isContextValid()) {
      console.warn('[MetaSo Translator] Extension context invalidated, cannot process translation request');
      throw new Error('Extension context invalidated. Please refresh the page to use translation features.');
    }

    const cached = getCachedTranslation(id);
    if (cached) {
      return cached;
    }

    postMessage(MESSAGE_TYPES.GET_TRANSLATION, { id });
    const translation = await waitForTranslation(id);
    const translatedContent = translation.translatedContent;
    cacheTranslation(id, translatedContent);
    return translatedContent;
  }

  // ============================================================================
  // 拦截 fetch 请求
  // ============================================================================
  window.fetch = async function(this: Window, ...args: Parameters<typeof fetch>): Promise<Response> {
    const url = args[0]?.toString();
    if (!url) {
      return originalFetch.apply(this, args);
    }

    const parsed = parseMetaSoUrl(url);
    if (!parsed) {
      return originalFetch.apply(this, args);
    }

    const { fileId, pageId, hasLangParam } = parsed;
    const id = generateContentId(url)!;

    console.log('[MetaSo Translator] Fetch 拦截:', { url, id, hasLangParam });

    if (!hasLangParam) {
      const response = await originalFetch.apply(this, args);
      const clone = response.clone();
      const data = await clone.json() as MetaSoApiResponse;
      handleOriginalRequest(id, url, fileId, pageId, data);
      return response;
    }

    try {
      const translatedContent = await handleTranslationRequest(id);
      return createJsonResponse(translatedContent);
    } catch (error) {
      console.error('[MetaSo Translator] Fetch 翻译失败:', error);

      // 如果是扩展上下文失效的错误，给出友好提示
      if (error instanceof Error && error.message.includes('Extension context invalidated')) {
        console.warn('[MetaSo Translator] Extension was reloaded. Please refresh this page to re-enable translation.');
      }

      // 回退到原始请求
      return originalFetch.apply(this, args);
    }
  };

  // ============================================================================
  // 拦截 XMLHttpRequest
  // ============================================================================
  const OriginalXHR = window.XMLHttpRequest;

  type XMLOpenMethod = (this: XMLHttpRequest, method: string, url: string | URL, async?: boolean, user?: string | null, password?: string | null) => void;
  type XHRSendMethod = (this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) => void;

  window.XMLHttpRequest = function(this: XMLHttpRequest): XMLHttpRequest {
    const xhr = new OriginalXHR();
    let urlInfo: { url: string; hasLangParam: boolean } | null = null;

    xhr.open = function(this: XMLHttpRequest, method: string, url: string | URL, async?: boolean, user?: string | null, password?: string | null): void {
      const urlStr = url.toString();
      const parsed = parseMetaSoUrl(urlStr);

      if (parsed) {
        urlInfo = { url: urlStr, hasLangParam: parsed.hasLangParam };
        console.log('[MetaSo Translator] XHR 打开:', { method, url: urlStr, hasLangParam: parsed.hasLangParam });
      }

      (OriginalXHR.prototype.open as XMLOpenMethod).call(this, method, url, async ?? true, user ?? null, password ?? null);
    };

    xhr.send = function(this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null): void {
      if (!urlInfo) {
        (OriginalXHR.prototype.send as XHRSendMethod).call(this, body);
        return;
      }

      const { url } = urlInfo;
      const parsed = parseMetaSoUrl(url);

      if (!parsed) {
        (OriginalXHR.prototype.send as XHRSendMethod).call(this, body);
        return;
      }

      const { fileId, pageId, hasLangParam } = parsed;
      const id = generateContentId(url)!;

      console.log('[MetaSo Translator] XHR 发送:', { url, id, hasLangParam });

      if (!hasLangParam) {
        xhr.addEventListener('load', function() {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText) as MetaSoApiResponse;
              console.log('[MetaSo Translator] XHR 原始响应:', id);
              console.log('[MetaSo Translator] 响应数据:', data);
              handleOriginalRequest(id, url, fileId, pageId, data);
            } catch (error) {
              console.error('[MetaSo Translator] XHR 解析失败:', error);
            }
          }
        });

        (OriginalXHR.prototype.send as XHRSendMethod).call(this, body);
        return;
      }

      const cached = getCachedTranslation(id);
      console.log('[MetaSo Translator] XHR 缓存检查:', { id, hasCached: !!cached });
      if (cached) {
        console.log('[MetaSo Translator] XHR 返回缓存翻译:', id);
        // 场景 C: 显示缓存加载通知
        showCacheLoadedNotification();
        setTimeout(() => setXHRResponse(xhr, cached), 0);
        (OriginalXHR.prototype.send as XHRSendMethod).call(this, body);
        return;
      }

      console.log('[MetaSo Translator] XHR 请求翻译:', id);

      handleTranslationRequest(id)
        .then(translatedContent => {
          console.log('[MetaSo Translator] XHR 翻译完成:', id);
          setXHRResponse(xhr, translatedContent);
        })
        .catch(error => {
          console.error('[MetaSo Translator] XHR 翻译失败:', error);

          // 如果是扩展上下文失效的错误，给出友好提示
          if (error instanceof Error && error.message.includes('Extension context invalidated')) {
            console.warn('[MetaSo Translator] Extension was reloaded. Please refresh this page to re-enable translation.');
          }
        });

      (OriginalXHR.prototype.send as XHRSendMethod).call(this, body);
    };

    return xhr;
  } as unknown as typeof XMLHttpRequest;

  // 保持原型链
  window.XMLHttpRequest.prototype = OriginalXHR.prototype;
  window.XMLHttpRequest.prototype.constructor = window.XMLHttpRequest;

  // ============================================================================
  // 消息监听
  // ============================================================================
  window.addEventListener('message', (event: MessageEvent) => {
    const windowEvent = event as WindowMessageEvent;
    if (windowEvent.source !== window) return;

    switch (windowEvent.data.type) {
      case MESSAGE_TYPES.CONTENT_SCRIPT_READY:
        console.log('[MetaSo Translator] Content script 已就绪');
        break;

      case MESSAGE_TYPES.TRANSLATION_READY:
        const payload = windowEvent.data.payload;
        if (payload?.id && payload.translation) {
          cacheTranslation(payload.id, payload.translation.translatedContent);
          console.log('[MetaSo Translator] 翻译已缓存:', payload.id);
        }
        break;
    }
  });

  postMessage(MESSAGE_TYPES.INJECTED_SCRIPT_READY);
});
