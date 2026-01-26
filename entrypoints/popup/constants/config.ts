/**
 * 配置相关常量
 */

/**
 * API 提供商类型选项
 */
export const PROVIDER_TYPES = [
  { value: 'openai', label: 'OpenAI', desc: '兼容 OpenAI API 的提供商' },
  { value: 'anthropic', label: 'Anthropic', desc: '兼容 Anthropic API 的提供商' },
  { value: 'custom', label: '自定义', desc: '使用自定义 API 格式' }
] as const;

/**
 * 目标语言选项
 */
export const LANGUAGE_OPTIONS = [
  { value: 'zh-CN', label: '简体中文', flag: '🇨🇳' },
  { value: 'zh-TW', label: '繁体中文', flag: '🇹🇼' },
  { value: 'en', label: 'English', flag: '🇺🇸' },
  { value: 'ja', label: '日本語', flag: '🇯🇵' },
  { value: 'ko', label: '한국어', flag: '🇰🇷' }
];
