/**
 * Background script 常量配置
 */

export const CONFIG = {
  RATE_LIMIT: {
    MAX_REQUESTS: 60,
    WINDOW_MS: 60000,
  },
  TRANSLATION: {
    MAX_CONTEXT_TOKENS: 2048,
    SAFE_TOKEN_MARGIN: 0,
    PROGRESS_UPDATE_INTERVAL: 3000,
    MAX_TOKENS: 8192,
    TEMPERATURE: 0.07,
  },
  DEFAULTS: {
    API_PROVIDER: 'openai' as const,
    MODEL: 'gpt-3.5-turbo',
    LANGUAGE: 'zh-CN',
  },
} as const;
