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
 * 翻译批次进度信息
 */
export interface TranslationBatchProgress {
  /** 已完成的批次数 */
  completedBatchCount: number;
  /** 总批次数 */
  totalBatchCount: number;
  /** 已翻译的段落映射（key: "itemIndex-paragraphIndex", value: 翻译文本） */
  translatedParagraphs: Record<string, string>;
  /** 已消耗的 token 数 */
  totalTokens: number;
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
    estimatedTokenCount?: number; // 估算的总 token 数量
    duration: number;
    /** 批次进度信息（用于断点续传） */
    batchProgress?: TranslationBatchProgress;
  };
  status: 'pending' | 'completed' | 'failed';
  error?: string;
}

/**
 * API 提供商配置
 */
export interface ProviderConfig {
  id: string;                    // 唯一标识符 (如: 'openai', 'anthropic', 'custom-provider')
  name: string;                  // 显示名称 (如: 'OpenAI', 'Anthropic', 'MyProvider')
  type: 'openai' | 'anthropic' | 'custom';  // 提供商类型，决定 API 调用方式
  apiEndpoint: string;           // API 端点
  description?: string;          // 可选描述
}

/**
 * 单个模型配置
 */
export interface ModelConfig {
  id: string;                    // 唯一标识符 (如: 'gpt-4o', 'claude-3-5-sonnet')
  name: string;                  // 显示名称 (如: 'GPT-4o', 'Claude 3.5 Sonnet')
  providerId: string;            // 关联的提供商 ID
  apiKey: string;                // 该模型的 API Key
  description?: string;          // 可选描述
}

/**
 * 用户配置条目
 */
export interface ConfigEntry {
  id: 'config'; // 固定主键
  providers: ProviderConfig[];   // 提供商配置数组
  models: ModelConfig[];         // 模型配置数组
  selectedModelId: string;       // 当前选中的模型ID
  language: string;              // 默认: 'zh-CN'
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
  | 'RETRY_TRANSLATION' // 重试失败的翻译
  | 'CLEAR_ALL' // 清空所有数据
  | 'EXPORT_HISTORY' // 导出历史记录
  | 'IMPORT_HISTORY' // 导入历史记录
  | 'GET_REALTIME_PROGRESS' // 获取实时翻译进度
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

// 重试翻译
export interface RetryTranslationMessage extends BaseMessage {
  type: 'RETRY_TRANSLATION';
  payload: {
    id: string;
  };
}

// 清空所有数据
export interface ClearAllMessage extends BaseMessage {
  type: 'CLEAR_ALL';
}

// 导出历史记录
export interface ExportHistoryMessage extends BaseMessage {
  type: 'EXPORT_HISTORY';
}

// 导入历史记录
export interface ImportHistoryMessage extends BaseMessage {
  type: 'IMPORT_HISTORY';
  payload: ExportData;
}

// 获取实时翻译进度
export interface GetRealtimeProgressMessage extends BaseMessage {
  type: 'GET_REALTIME_PROGRESS';
  payload: {
    id: string; // 翻译ID
  };
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
  | RetryTranslationMessage
  | ClearAllMessage
  | ExportHistoryMessage
  | ImportHistoryMessage
  | GetRealtimeProgressMessage
  | ErrorMessage
  ;

// 消息响应
export interface MessageResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// 实时翻译进度数据
export interface RealtimeProgressData {
  translationId: string;
  status: 'pending' | 'completed' | 'failed';
  totalTokens: number; // 目前总token
  estimatedTotalTokens: number; // 预计总token
  tokensPerSecond: number; // 翻译速度
  estimatedRemainingTime: number; // 预计剩余时间(ms)
  percentage: number; // 进度百分比 0-100
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
  useStream?: boolean; // 是否使用流式传输
  onTokenUpdate?: (tokenCount: number) => void; // token 更新回调（用于更新 IndexedDB）
  signal?: AbortSignal; // 用于取消请求
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
  translateWithStream?(content: string, config: TranslationConfig): Promise<string>;
  estimateTokens(text: string): number;
}

// ============================================================================
// Paragraph Alignment Types
// ============================================================================

/**
 * 标记提取结果
 */
export interface MarkerExtractionResult {
  /** 提取的翻译段落 */
  paragraphs: string[];
  /** 缺失的标记索引 */
  missingMarkers: number[];
  /** 重复的标记索引 */
  duplicateMarkers: number[];
  /** 找到的所有标记索引 */
  foundMarkers: Set<number>;
}

/**
 * 回退级别枚举
 */
export enum FallbackLevel {
  PERFECT = 'perfect',           // 所有标记完整
  MINOR_ISSUES = 'minor',        // 少量标记缺失（< 10%）
  MODERATE_ISSUES = 'moderate',  // 中等标记缺失（10-30%）
  SEVERE_ISSUES = 'severe',      // 严重标记缺失（> 30%）
  COMPLETE_FAILURE = 'failure'   // 所有标记缺失
}

/**
 * 回退结果
 */
export interface FallbackResult {
  /** 应用的回退级别 */
  level: FallbackLevel;
  /** 最终的段落数组 */
  paragraphs: string[];
  /** 缺失的标记数量 */
  missingCount: number;
  /** 总标记数量 */
  totalCount: number;
  /** 应用的策略描述 */
  appliedStrategy: string;
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

// ============================================================================
// Import/Export Types
// ============================================================================

/**
 * 导出数据格式
 */
export interface ExportData {
  version: string;           // 数据格式版本 "1.0.0"
  exportDate: number;        // 导出时间戳
  exportDateFormatted: string; // 格式化的导出时间
  stats: {
    total: number;           // 总记录数
    completed: number;       // 已完成数量
    failed: number;          // 失败数量
    pending: number;         // 进行中数量
  };
  translations: TranslationEntry[];  // 翻译记录数组
}
