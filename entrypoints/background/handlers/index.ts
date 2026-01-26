import type { Message, MessageResponse } from '@/types';
import type { MessageSender } from '../types';
import { handleOriginalRequest, checkTranslation, getTranslation, handleRequestTranslation, handleRetryTranslation } from './translationHandlers';
import { getConfig, updateConfig } from './configHandlers';
import { getHistory, deleteTranslation, clearAll } from './historyHandlers';

/**
 * 处理所有消息
 */
export async function handleMessage(message: Message, sender: MessageSender): Promise<MessageResponse> {
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
        return await deleteTranslation(message.payload.id);

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
