// MetaSo MD Translator - Type Definitions

// ============================================================================
// IndexedDB Data Structures
// ============================================================================

/**
 * MetaSo API 响应格式中的单个 markdown 项
 */
export interface MetaSoMarkdownItem {
  markdown_lang: string[];  // 翻译后的内容数组
  markdown: string[];        // 原始内容数组
  page: number;
  could_translate: boolean;
}

/**
 * MetaSo API 响应数据格式
 */
export interface MetaSoApiResponse {
  errCode: number;
  errMsg: string;
  data: {
    total_page?: number;
    lang: string | null;
    markdown: MetaSoMarkdownItem[];
  };
}

/**
 * 原始内容条目
 */
export interface ContentEntry {
  id: string; // 主键: "fileId-pageId"
  url: string;
  fileId: string;
  pageId: string;
  originalContent: MetaSoApiResponse;
  timestamp: number;
  hash: string; // 内容哈希，用于检测变更
}

/**
 * 翻译结果条目
 */
export interface TranslationEntry {
  id: string; // 主键: "fileId-pageId"
  contentId: string; // 关联到 contents.id
  translatedContent: MetaSoApiResponse;
  meta: {
    translatedAt: number;
    model: string;
    provider: 'openai' | 'anthropic' | 'custom';
    tokenCount: number;
    duration: number;
  };
  status: 'pending' | 'completed' | 'failed';
  error?: string;
}

/**
 * 用户配置条目
 */
export interface ConfigEntry {
  id: 'config'; // 固定主键
  apiKey: string;
  apiProvider: 'openai' | 'anthropic' | 'custom';
  apiEndpoint?: string; // 自定义端点
  model: string;
  language: string; // 默认: 'zh-CN'
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// Message Types
// ============================================================================

export type MessageType =
  | 'ORIGINAL_REQUEST' // 存储原始内容请求
  | 'CHECK_TRANSLATION' // 检查翻译是否存在
  | 'REQUEST_TRANSLATION' // 请求翻译
  | 'TRANSLATION_READY' // 翻译完成通知
  | 'GET_TRANSLATION' // 获取翻译结果
  | 'SHOW_CONSENT_PROMPT' // 显示用户同意弹窗
  | 'USER_CONSENT_RESPONSE' // 用户同意响应
  | 'GET_CONFIG' // 获取配置
  | 'UPDATE_CONFIG' // 更新配置
  | 'GET_HISTORY' // 获取历史记录
  | 'DELETE_TRANSLATION' // 删除翻译记录
  | 'CLEAR_ALL' // 清空所有数据
  | 'ERROR' // 错误消息
  ;

export interface BaseMessage {
  type: MessageType;
  id?: string; // 消息唯一ID
  timestamp?: number;
}

// 存储原始内容
export interface OriginalRequestMessage extends BaseMessage {
  type: 'ORIGINAL_REQUEST';
  payload: {
    id: string;
    url: string;
    fileId: string;
    pageId: string;
    content: ContentEntry['originalContent'];
  };
}

// 检查翻译是否存在
export interface CheckTranslationMessage extends BaseMessage {
  type: 'CHECK_TRANSLATION';
  payload: {
    id: string;
  };
}

// 请求翻译
export interface RequestTranslationMessage extends BaseMessage {
  type: 'REQUEST_TRANSLATION';
  payload: {
    id: string;
    url: string;
    fileId: string;
    pageId: string;
    content: ContentEntry['originalContent'];
  };
}

// 翻译完成通知
export interface TranslationReadyMessage extends BaseMessage {
  type: 'TRANSLATION_READY';
  payload: {
    id: string;
    translation: TranslationEntry;
  };
}

// 获取翻译结果
export interface GetTranslationMessage extends BaseMessage {
  type: 'GET_TRANSLATION';
  payload: {
    id: string;
  };
}

// 显示用户同意弹窗
export interface ShowConsentPromptMessage extends BaseMessage {
  type: 'SHOW_CONSENT_PROMPT';
  payload: {
    id: string;
    url: string;
    previewContent: string;
    estimatedTokens: number;
  };
}

// 用户同意响应
export interface UserConsentResponseMessage extends BaseMessage {
  type: 'USER_CONSENT_RESPONSE';
  payload: {
    id: string;
    approved: boolean;
  };
}

// 获取配置
export interface GetConfigMessage extends BaseMessage {
  type: 'GET_CONFIG';
}

// 更新配置
export interface UpdateConfigMessage extends BaseMessage {
  type: 'UPDATE_CONFIG';
  payload: Partial<Omit<ConfigEntry, 'id'>>;
}

// 获取历史记录
export interface GetHistoryMessage extends BaseMessage {
  type: 'GET_HISTORY';
}

// 删除翻译记录
export interface DeleteTranslationMessage extends BaseMessage {
  type: 'DELETE_TRANSLATION';
  payload: {
    id: string;
  };
}

// 清空所有数据
export interface ClearAllMessage extends BaseMessage {
  type: 'CLEAR_ALL';
}

// 错误消息
export interface ErrorMessage extends BaseMessage {
  type: 'ERROR';
  payload: {
    code: string;
    message: string;
    details?: any;
  };
}

// 消息联合类型
export type Message =
  | OriginalRequestMessage
  | CheckTranslationMessage
  | RequestTranslationMessage
  | TranslationReadyMessage
  | GetTranslationMessage
  | ShowConsentPromptMessage
  | UserConsentResponseMessage
  | GetConfigMessage
  | UpdateConfigMessage
  | GetHistoryMessage
  | DeleteTranslationMessage
  | ClearAllMessage
  | ErrorMessage
  ;

// 消息响应
export interface MessageResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================================
// Translation Types
// ============================================================================

/**
 * 翻译配置
 */
export interface TranslationConfig {
  apiKey: string;
  apiProvider: 'openai' | 'anthropic' | 'custom';
  apiEndpoint?: string;
  model: string;
  targetLanguage: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

/**
 * 翻译结果
 */
export interface TranslationResult {
  success: boolean;
  content?: string;
  meta?: {
    translatedAt: number;
    translatedBy: string;
    tokenCount: number;
    duration: number;
  };
  error?: string;
}

/**
 * 翻译提供商接口
 */
export interface TranslationProvider {
  name: string;
  translate(content: string, config: TranslationConfig): Promise<string>;
  estimateTokens(text: string): number;
}

// ============================================================================
// URL Parser Types
// ============================================================================

/**
 * 解析后的 MetaSo URL
 */
export interface ParsedMetaSoUrl {
  fileId: string;
  pageId: string;
  hasLangParam: boolean;
  lang?: string;
}

// ============================================================================
// Component Types
// ============================================================================

/**
 * 同意弹窗 Props
 */
export interface ConsentModalProps {
  id: string;
  url: string;
  previewContent: string;
  estimatedTokens: number;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

/**
 * 配置面板数据
 */
export interface ConfigPanelData {
  apiKey: string;
  apiProvider: 'openai' | 'anthropic' | 'custom';
  apiEndpoint?: string;
  model: string;
  language: string;
}

/**
 * 历史记录项
 */
export interface HistoryItem {
  id: string;
  url: string;
  fileId: string;
  pageId: string;
  translatedAt: number;
  model: string;
  provider: string;
  status: 'completed' | 'failed';
}

// ============================================================================
// IndexedDB Schema Types
// ============================================================================

/**
 * IndexedDB 数据库结构
 */
export interface MetaSoTranslatorDB extends IDBDatabase {
  transaction(
    storeNames: ['contents' | 'translations' | 'config'],
    mode?: IDBTransactionMode
  ): IDBTransaction;
}

/**
 * Object Store 名称
 */
export const ObjectStores = {
  CONTENTS: 'contents',
  TRANSLATIONS: 'translations',
  CONFIG: 'config'
} as const;

/**
 * Index 名称
 */
export const IndexNames = {
  CONTENTS_URL: 'url',
  CONTENTS_TIMESTAMP: 'timestamp',
  TRANSLATIONS_CONTENT_ID: 'contentId',
  TRANSLATIONS_STATUS: 'status',
  TRANSLATIONS_TRANSLATED_AT: 'translatedAt'
} as const;
