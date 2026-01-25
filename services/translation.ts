// Translation Service

import type { TranslationProvider, TranslationConfig, TranslationResult } from '@/types';
import { OpenAIProvider } from './providers/openai';
import { AnthropicProvider } from './providers/anthropic';
import { CustomProvider } from './providers/custom';

/**
 * 生成默认的系统提示词
 */
export function getDefaultSystemPrompt(targetLanguage?: string): string {
  const lang = targetLanguage || 'zh-CN';
  const langMap: Record<string, string> = {
    'zh-CN': '简体中文',
    'zh-TW': '繁体中文',
    'en': '英文',
    'ja': '日文',
    'ko': '韩文'
  };
  const target = langMap[lang] || lang;

  return `你是一个专业的技术文档翻译专家。请将给定的 Markdown 内容翻译为${target}。

要求：
1. 保持 Markdown 格式不变
2. 保留专业术语的准确性
3. 确保翻译流畅自然
4. 不要添加或删除任何内容
5. 只返回翻译后的内容，不要有任何解释或说明`;
}

/**
 * 构建用户提示词
 */
export function buildUserPrompt(content: string, targetLanguage: string): string {
  return `请将以下 Markdown 内容翻译为${targetLanguage}，保持 Markdown 格式不变：

\`\`\`markdown
${content}
\`\`\`

要求：
1. 保持所有 Markdown 格式（标题、列表、代码块、链接等）
2. 专业术语保持一致性
3. 保持原文的语气和风格
4. 代码块中的代码不要翻译
5. 只返回翻译后的内容，不要添加任何解释`;
}

/**
 * 翻译服务管理器
 */
export class TranslationService {
  private providers: Map<string, TranslationProvider> = new Map();

  constructor() {
    this.providers.set('openai', new OpenAIProvider());
    this.providers.set('anthropic', new AnthropicProvider());
    this.providers.set('custom', new CustomProvider());
  }

  /**
   * 翻译内容
   */
  async translate(content: string, config: TranslationConfig): Promise<TranslationResult> {
    const startTime = Date.now();

    try {
      const provider = this.getProvider(config.apiProvider);

      if (!provider) {
        return {
          success: false,
          error: `Unknown provider: ${config.apiProvider}`
        };
      }

      // 调用提供商的翻译方法
      const translatedContent = await provider.translate(content, config);

      const duration = Date.now() - startTime;
      const tokenCount = provider.estimateTokens(content);

      return {
        success: true,
        content: translatedContent,
        meta: {
          translatedAt: Date.now(),
          translatedBy: config.model,
          tokenCount,
          duration
        }
      };
    } catch (error) {
      console.error('[TranslationService] Translation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 估算 Token 数量
   */
  estimateTokens(text: string, providerType: string): number {
    const provider = this.getProvider(providerType);
    if (!provider) {
      // 默认估算
      return Math.ceil(text.length / 3);
    }
    return provider.estimateTokens(text);
  }

  /**
   * 估算成本（美元）
   */
  estimateCost(content: string, config: TranslationConfig): number {
    const tokens = this.estimateTokens(content, config.apiProvider);

    // 定价表（每 1K tokens 的价格，美元）
    const pricing: Record<string, number> = {
      // OpenAI 定价
      'gpt-4': 0.03,
      'gpt-4-turbo': 0.01,
      'gpt-3.5-turbo': 0.002,

      // Anthropic 定价
      'claude-3-opus': 0.015,
      'claude-3-sonnet': 0.003,
      'claude-3-haiku': 0.00025,

      // 默认
      'default': 0.002
    };

    const pricePer1kTokens = pricing[config.model] || pricing['default'];
    return (tokens / 1000) * pricePer1kTokens;
  }

  /**
   * 获取提供商
   */
  private getProvider(type: string): TranslationProvider | undefined {
    return this.providers.get(type);
  }

  /**
   * 获取可用的提供商列表
   */
  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}

// 导出单例
export const translationService = new TranslationService();
