// entrypoints/injected.ts
// 注入到 MetaSo 页面的主世界脚本，用于拦截 fetch 和 XHR 请求

import { parseMetaSoUrl, generateContentId } from '@/utils/urlParser';

export default defineUnlistedScript(() => {
  console.log('[MetaSo Translator] 注入成功');

  const { fetch: originalFetch } = window;

  // 翻译缓存（内存中）
  const translationCache = new Map<string, any>();

  // 待处理的翻译请求（用于阻塞等待）
  const pendingTranslations = new Map<string, Promise<any>>();

  // ============================================================================
  // 等待翻译完成
  // ============================================================================
  function waitForTranslation(id: string, timeout: number = 30000): Promise<any> {
    // 如果已存在待处理的请求，返回同一个 Promise
    if (pendingTranslations.has(id)) {
      return pendingTranslations.get(id)!;
    }

    // 创建新的翻译等待 Promise
    const translationPromise = new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        pendingTranslations.delete(id);
        window.removeEventListener('message', messageHandler);
        reject(new Error(`Translation timeout for ${id}`));
      }, timeout);

      const messageHandler = (event: MessageEvent) => {
        if (event.source !== window) return;
        if (event.data.type === 'TRANSLATION_READY' && event.data.payload?.id === id) {
          clearTimeout(timeoutId);
          window.removeEventListener('message', messageHandler);
          resolve(event.data.payload.translation);
        }
      };

      window.addEventListener('message', messageHandler);
    });

    pendingTranslations.set(id, translationPromise);
    return translationPromise;
  }

  // ============================================================================
  // 拦截 fetch 请求
  // ============================================================================
  window.fetch = async (...args) => {
    const url = args[0].toString();
    const parsed = parseMetaSoUrl(url);

    // 如果不是 MetaSo API URL，直接返回原始请求
    if (!parsed) {
      return originalFetch(...args);
    }

    const { fileId, pageId, hasLangParam } = parsed;
    const id = generateContentId(url)!;

    console.log('[MetaSo Translator] Fetch 拦截:', { url, id, hasLangParam });

    if (!hasLangParam) {
      // 原始请求
      const response = await originalFetch(...args);
      const clone = response.clone();
      const data = await clone.json();

      window.postMessage({
        type: 'ORIGINAL_REQUEST',
        payload: { id, url, fileId, pageId, content: data }
      }, '*');

      return response;
    } else {
      // 翻译请求
      if (translationCache.has(id)) {
        const cached = translationCache.get(id);
        return new Response(JSON.stringify(cached), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      window.postMessage({
        type: 'GET_TRANSLATION',
        payload: { id }
      }, '*');

      try {
        const translation = await waitForTranslation(id);
        translationCache.set(id, translation.translatedContent);

        return new Response(JSON.stringify(translation.translatedContent), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return originalFetch(...args);
      }
    }
  };

  // ============================================================================
  // 拦截 XMLHttpRequest
  // ============================================================================
  const OriginalXHR = window.XMLHttpRequest;

  // @ts-ignore
  window.XMLHttpRequest = function() {
    const xhr = new OriginalXHR();
    let _url: string | null = null;
    let _hasLangParam = false;

    // 拦截 open 方法
    xhr.open = function(method: string, url: string | URL, ...rest: any[]) {
      _url = url.toString();

      const parsed = parseMetaSoUrl(_url);
      if (parsed) {
        _hasLangParam = parsed.hasLangParam;
        console.log('[MetaSo Translator] XHR 打开:', { method, url: _url, hasLangParam: _hasLangParam });
      }

      // @ts-ignore
      return OriginalXHR.prototype.open.call(this, method, url, ...rest);
    };

    // 拦截 send 方法
    xhr.send = function(...args: any[]) {
      const parsed = parseMetaSoUrl(_url || '');

      // 如果不是 MetaSo API URL，直接发送
      if (!parsed) {
        // @ts-ignore
        return OriginalXHR.prototype.send.apply(this, args);
      }

      const { fileId, pageId, hasLangParam } = parsed;
      const id = generateContentId(_url!)!;

      console.log('[MetaSo Translator] XHR 发送:', { url: _url, id, hasLangParam });

      if (!hasLangParam) {
        // 原始请求 - 监听响应并发送给 content script
        xhr.addEventListener('load', function() {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const responseText = xhr.responseText;
              const data = JSON.parse(responseText);
              console.log('[MetaSo Translator] XHR 原始响应:', id);
              console.log('[MetaSo Translator] 响应数据:', data);

              window.postMessage({
                type: 'ORIGINAL_REQUEST',
                payload: { id, url: _url!, fileId, pageId, content: data }
              }, '*');
            } catch (error) {
              console.error('[MetaSo Translator] XHR 解析失败:', error);
            }
          }
        });

        // @ts-ignore
        return OriginalXHR.prototype.send.apply(this, args);
      } else {
        // 翻译请求 - 检查缓存或返回翻译结果
        if (translationCache.has(id)) {
          const cached = translationCache.get(id);
          console.log('[MetaSo Translator] XHR 返回缓存翻译:', id);

          // 模拟响应
          setTimeout(() => {
            Object.defineProperty(xhr, 'response', { value: JSON.stringify(cached) });
            Object.defineProperty(xhr, 'responseText', { value: JSON.stringify(cached) });
            Object.defineProperty(xhr, 'status', { value: 200 });
            Object.defineProperty(xhr, 'readyState', { value: 4 });
            xhr.dispatchEvent(new Event('load'));
            xhr.dispatchEvent(new Event('loadend'));
          }, 0);

          // @ts-ignore
          return OriginalXHR.prototype.send.apply(this, args);
        }

        // 请求翻译
        console.log('[MetaSo Translator] XHR 请求翻译:', id);

        window.postMessage({
          type: 'GET_TRANSLATION',
          payload: { id }
        }, '*');

        // 等待翻译并返回结果
        waitForTranslation(id)
          .then(translation => {
            translationCache.set(id, translation.translatedContent);
            console.log('[MetaSo Translator] XHR 翻译完成:', id);

            Object.defineProperty(xhr, 'response', { value: JSON.stringify(translation.translatedContent) });
            Object.defineProperty(xhr, 'responseText', { value: JSON.stringify(translation.translatedContent) });
            Object.defineProperty(xhr, 'status', { value: 200 });
            Object.defineProperty(xhr, 'readyState', { value: 4 });
            xhr.dispatchEvent(new Event('load'));
            xhr.dispatchEvent(new Event('loadend'));
          })
          .catch(error => {
            console.error('[MetaSo Translator] XHR 翻译失败:', error);
            // 失败时发送原始请求
            // @ts-ignore
            OriginalXHR.prototype.send.apply(this, args);
          });

        // @ts-ignore
        return OriginalXHR.prototype.send.apply(this, args);
      }
    };

    return xhr;
  } as any;

  // 保持原型链
  window.XMLHttpRequest.prototype = OriginalXHR.prototype;
  window.XMLHttpRequest.prototype.constructor = window.XMLHttpRequest;

  // ============================================================================
  // 监听来自 content script 的消息
  // ============================================================================
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;

    switch (event.data.type) {
      case 'CONTENT_SCRIPT_READY':
        console.log('[MetaSo Translator] Content script 已就绪');
        break;

      case 'TRANSLATION_READY':
        // 翻译完成，缓存结果
        const { id, translation } = event.data.payload;
        translationCache.set(id, translation.translatedContent);
        console.log('[MetaSo Translator] 翻译已缓存:', id);
        break;
    }
  });

  // 通知 content script 注入脚本已就绪
  window.postMessage({
    type: 'INJECTED_SCRIPT_READY'
  }, '*');
});
