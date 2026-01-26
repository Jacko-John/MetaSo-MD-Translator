import type { TranslationEntry } from '@/types';

/**
 * 通知翻译完成
 */
export async function notifyTranslationReady(
  tabId: number | undefined,
  id: string,
  translation: TranslationEntry
): Promise<void> {
  if (!tabId) {
    console.warn('[Background] No tab ID, cannot notify translation ready');
    return;
  }

  try {
    const tab = await browser.tabs.get(tabId).catch(() => null);
    if (!tab) {
      console.warn('[Background] Tab no longer exists, cannot notify translation ready');
      return;
    }

    await browser.tabs.sendMessage(tabId, {
      type: 'TRANSLATION_READY',
      payload: { id, translation }
    });
  } catch (error) {
    console.debug('[Background] Failed to send translation ready message (tab may be closed):', error);
  }
}
