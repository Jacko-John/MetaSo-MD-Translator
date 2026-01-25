// IndexedDB Manager for MetaSo Translator

import type {
  ContentEntry,
  TranslationEntry,
  ConfigEntry,
  ObjectStores,
  IndexNames
} from '@/types';

const DB_NAME = 'MetaSoTranslator';
const DB_VERSION = 1;

/**
 * 获取全局 indexedDB 对象
 * 支持多种环境：background script、content script、injected script
 */
function getIndexedDB(): IDBFactory {
  // 在 background/service worker 环境中
  if (typeof self !== 'undefined' && self.indexedDB) {
    return self.indexedDB;
  }
  // 在普通页面环境中
  if (typeof window !== 'undefined' && window.indexedDB) {
    return window.indexedDB;
  }
  throw new Error('IndexedDB is not available in this environment');
}

/**
 * IndexedDB 管理器
 */
export class IndexedDBManager {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * 初始化数据库
   */
  async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      // 获取 indexedDB 对象
      const indexedDB = getIndexedDB();
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[IndexedDB] Failed to open database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[IndexedDB] Database opened successfully');
        resolve();
      };

      request.onupgradeneeded = (event: Event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        console.log('[IndexedDB] Upgrading database to version', DB_VERSION);

        // 创建 contents store
        if (!db.objectStoreNames.contains('contents')) {
          const contentsStore = db.createObjectStore('contents', { keyPath: 'id' });
          contentsStore.createIndex('url', 'url', { unique: false });
          contentsStore.createIndex('timestamp', 'timestamp', { unique: false });
          console.log('[IndexedDB] Created contents store');
        }

        // 创建 translations store
        if (!db.objectStoreNames.contains('translations')) {
          const translationsStore = db.createObjectStore('translations', { keyPath: 'id' });
          translationsStore.createIndex('contentId', 'contentId', { unique: false });
          translationsStore.createIndex('status', 'status', { unique: false });
          translationsStore.createIndex('translatedAt', 'meta.translatedAt', { unique: false });
          console.log('[IndexedDB] Created translations store');
        }

        // 创建 config store
        if (!db.objectStoreNames.contains('config')) {
          db.createObjectStore('config', { keyPath: 'id' });
          console.log('[IndexedDB] Created config store');
        }
      };
    });

    return this.initPromise;
  }

  /**
   * 确保数据库已初始化
   */
  private async ensureInitialized(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    if (!this.db) {
      throw new Error('[IndexedDB] Database not initialized');
    }
    return this.db;
  }

  // ========================================================================
  // Contents Operations
  // ========================================================================

  /**
   * 获取原始内容
   */
  async getContent(id: string): Promise<ContentEntry | null> {
    const db = await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['contents'], 'readonly');
      const store = transaction.objectStore('contents');
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        console.error('[IndexedDB] Failed to get content:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 存储原始内容
   */
  async setContent(entry: ContentEntry): Promise<void> {
    const db = await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['contents'], 'readwrite');
      const store = transaction.objectStore('contents');
      const request = store.put(entry);

      request.onsuccess = () => {
        console.log('[IndexedDB] Content saved:', entry.id);
        resolve();
      };

      request.onerror = () => {
        console.error('[IndexedDB] Failed to save content:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 删除原始内容
   */
  async deleteContent(id: string): Promise<void> {
    const db = await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['contents'], 'readwrite');
      const store = transaction.objectStore('contents');
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log('[IndexedDB] Content deleted:', id);
        resolve();
      };

      request.onerror = () => {
        console.error('[IndexedDB] Failed to delete content:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 获取所有内容
   */
  async getAllContents(): Promise<ContentEntry[]> {
    const db = await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['contents'], 'readonly');
      const store = transaction.objectStore('contents');
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        console.error('[IndexedDB] Failed to get all contents:', request.error);
        reject(request.error);
      };
    });
  }

  // ========================================================================
  // Translations Operations
  // ========================================================================

  /**
   * 获取翻译结果
   */
  async getTranslation(id: string): Promise<TranslationEntry | null> {
    const db = await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['translations'], 'readonly');
      const store = transaction.objectStore('translations');
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        console.error('[IndexedDB] Failed to get translation:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 存储翻译结果
   */
  async setTranslation(entry: TranslationEntry): Promise<void> {
    const db = await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['translations'], 'readwrite');
      const store = transaction.objectStore('translations');
      const request = store.put(entry);

      request.onsuccess = () => {
        console.log('[IndexedDB] Translation saved:', entry.id);
        resolve();
      };

      request.onerror = () => {
        console.error('[IndexedDB] Failed to save translation:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 删除翻译结果
   */
  async deleteTranslation(id: string): Promise<void> {
    const db = await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['translations'], 'readwrite');
      const store = transaction.objectStore('translations');
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log('[IndexedDB] Translation deleted:', id);
        resolve();
      };

      request.onerror = () => {
        console.error('[IndexedDB] Failed to delete translation:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 获取所有翻译
   */
  async getAllTranslations(): Promise<TranslationEntry[]> {
    const db = await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['translations'], 'readonly');
      const store = transaction.objectStore('translations');
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        console.error('[IndexedDB] Failed to get all translations:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 获取已完成的翻译（按时间倒序）
   */
  async getCompletedTranslations(): Promise<TranslationEntry[]> {
    const db = await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['translations'], 'readonly');
      const store = transaction.objectStore('translations');
      const index = store.index('status');
      const request = index.getAll('completed');

      request.onsuccess = () => {
        const results = request.result || [];
        // 按翻译时间倒序排列
        results.sort((a, b) => b.meta.translatedAt - a.meta.translatedAt);
        resolve(results);
      };

      request.onerror = () => {
        console.error('[IndexedDB] Failed to get completed translations:', request.error);
        reject(request.error);
      };
    });
  }

  // ========================================================================
  // Config Operations
  // ========================================================================

  /**
   * 获取配置
   */
  async getConfig(): Promise<ConfigEntry | null> {
    const db = await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['config'], 'readonly');
      const store = transaction.objectStore('config');
      const request = store.get('config');

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        console.error('[IndexedDB] Failed to get config:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 存储配置
   */
  async setConfig(config: ConfigEntry): Promise<void> {
    const db = await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['config'], 'readwrite');
      const store = transaction.objectStore('config');
      const request = store.put(config);

      request.onsuccess = () => {
        console.log('[IndexedDB] Config saved');
        resolve();
      };

      request.onerror = () => {
        console.error('[IndexedDB] Failed to save config:', request.error);
        reject(request.error);
      };
    });
  }

  // ========================================================================
  // Bulk Operations
  // ========================================================================

  /**
   * 清空所有数据
   */
  async clearAll(): Promise<void> {
    const db = await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['contents', 'translations', 'config'], 'readwrite');

      transaction.oncomplete = () => {
        console.log('[IndexedDB] All data cleared');
        resolve();
      };

      transaction.onerror = () => {
        console.error('[IndexedDB] Failed to clear all data:', transaction.error);
        reject(transaction.error);
      };

      // 清空所有 store
      transaction.objectStore('contents').clear();
      transaction.objectStore('translations').clear();
      transaction.objectStore('config').clear();
    });
  }

  /**
   * 获取统计信息
   */
  async getStats(): Promise<{
    contentsCount: number;
    translationsCount: number;
    completedTranslations: number;
    hasConfig: boolean;
  }> {
    const db = await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['contents', 'translations', 'config'], 'readonly');

      const contentsRequest = transaction.objectStore('contents').count();
      const translationsRequest = transaction.objectStore('translations').count();
      const configRequest = transaction.objectStore('config').count();

      transaction.oncomplete = () => {
        resolve({
          contentsCount: contentsRequest.result,
          translationsCount: translationsRequest.result,
          completedTranslations: 0, // TODO: 可以通过 index 统计
          hasConfig: configRequest.result > 0
        });
      };

      transaction.onerror = () => {
        console.error('[IndexedDB] Failed to get stats:', transaction.error);
        reject(transaction.error);
      };
    });
  }
}

// 导出单例
export const indexedDB = new IndexedDBManager();
