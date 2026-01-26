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
    'zh-CN': 'Simplified Chinese',
    'zh-TW': 'Traditional Chinese',
    'en': 'English',
    'ja': 'Japanese',
    'ko': 'Korean'
  };
  const target = langMap[lang] || lang;

  return `You are a professional technical document translator. Translate the given Markdown content into ${target}.

Critical Requirements:
1. **Faithfulness**: Preserve the exact original meaning and intent without any additions, deletions, or interpretations
2. **Naturalness**: Use expressions and phrasing that are natural and idiomatic in ${target}, while maintaining the original technical accuracy
3. **Markdown Integrity**: Preserve ALL Markdown formatting exactly as is (headings, lists, code blocks, links, tables, etc.)
4. **Technical Accuracy**: Keep technical terms and API names consistent with their original form when appropriate
5. **Code Preservation**: NEVER translate text within code blocks or code fences
6. **Conciseness**: Return ONLY the translated content, with no explanations, notes, or commentary`;
}

/**
 * 构建用户提示词
 */
export function buildUserPrompt(content: string, targetLanguage: string): string {
  const langMap: Record<string, string> = {
    'zh-CN': 'Simplified Chinese',
    'zh-TW': 'Traditional Chinese',
    'en': 'English',
    'ja': 'Japanese',
    'ko': 'Korean'
  };
  const target = langMap[targetLanguage] || targetLanguage;

  return `Translate the following Markdown content into ${target}.

\`\`\`markdown
${content}
\`\`\`

Requirements:
1. Maintain ALL Markdown formatting precisely (headings, lists, code blocks, links, tables, etc.)
2. Use natural ${target} expressions that would be used by native speakers, while strictly preserving the original meaning
3. Keep technical terminology and API names intact unless they have well-established ${target} equivalents
4. NEVER translate text within code blocks or inline code
5. Preserve the original tone, style, and structure
6. Return ONLY the translated Markdown content, with no additional explanations`;
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
