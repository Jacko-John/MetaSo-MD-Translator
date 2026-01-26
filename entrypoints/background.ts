// entrypoints/background.ts
// 后台服务：管理存储、翻译调度、消息处理

import { indexedDB } from '@/utils/indexedDB';
import type { Message, MessageResponse } from '@/types';
import type { MessageSender } from './background/types';
import { handleMessage } from './background/handlers';

export default defineBackground(() => {
  console.log('[MetaSo Translator] Background script 已启动');

  // 初始化 IndexedDB
  indexedDB.init().catch(console.error);

  // 注册消息监听器
  browser.runtime.onMessage.addListener(
    (message: Message, sender: MessageSender, sendResponse: (response: MessageResponse) => void) => {
      handleMessage(message, sender)
        .then(sendResponse)
        .catch((error) => {
          console.error('[MetaSo Translator] Message handling error:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // 保持消息通道开启以支持异步响应
    }
  );
});
