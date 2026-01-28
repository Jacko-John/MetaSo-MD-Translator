// Translation Service

import type { TranslationProvider, TranslationConfig, TranslationResult } from '@/types';
import { OpenAIProvider } from './providers/openai';
import { AnthropicProvider } from './providers/anthropic';
import { CustomProvider } from './providers/custom';

/**
 * 生成默认的系统提示词
 */
// export function getDefaultSystemPrompt(targetLanguage?: string): string {
//   const lang = targetLanguage || 'zh-CN';
//   const langMap: Record<string, string> = {
//     'zh-CN': 'Simplified Chinese',
//     'zh-TW': 'Traditional Chinese',
//     'en': 'English',
//     'ja': 'Japanese',
//     'ko': 'Korean'
//   };
//   const target = langMap[lang] || lang;

//   return `You are an expert technical translator specializing in Markdown documentation. Your task is to translate content into ${target} while STRICTLY preserving the document structure.

// ### CRITICAL RULES - READ CAREFULLY:
// 1. **Marker Preservation**: The input text contains separators like \`[[__META_SO_PARA_123__]]\`.
//    - These are anchors for software processing.
//    - You MUST append the exact separator to the end of its corresponding translated paragraph.
//    - NEVER modify, translate, or remove numbers inside the separators.

// 2. **Code Block Safety**:
//    - Content inside \`\`\` code blocks or \`inline code\` must remain COMPLETELY UNTOUCHED.
//    - Do NOT translate comments inside code blocks.
//    - Do NOT translate variable names or function names.

// 3. **Translation Quality**:
//    - **Faithfulness**: Keep the original meaning accurately.
//    - **Tone**: Professional, technical, and concise.
//    - **Formatting**: Preserve all Markdown syntax (bold, italic, links, tables).

// 4. **Output Format**:
//    - Return ONLY the translated body content.
//    - Do NOT include explanations, "Here is the translation", or XML tags.`;
// }

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

  return `You are an expert technical translator specializing in Markdown documentation converted from PDF. 
Your task is to translate content into ${target} while STRICTLY preserving the document structure and handling fragmented text.

### CRITICAL RULES - READ CAREFULLY:

1. **Marker Preservation**: The input text contains separators like \`[[__META_SO_PARA_123__]]\`.
   - These are anchors for software processing.
   - You MUST append the exact separator to the end of its corresponding translated segment.
   - NEVER modify, translate, or remove numbers inside the separators.

2. **Handling Fragmented Sentences (PDF Artifacts)**:
   - **Context**: Input text may be physically split into parts (e.g., across pages) even in the middle of a sentence.
   - **Instruction**: Translate ONLY the text visibly present in the current segment.
   - **PROHIBITION**: DO NOT autocomplete sentences. DO NOT guess what comes next. If a segment ends with "The user must", translate only "The user must", do not add "click the button" even if it's obvious.
   - **Logic**: It is better to have a grammatically incomplete sentence in the translation than to have duplicated content.

3. **Code Block Safety**:
   - Content inside \`\`\` code blocks or \`inline code\` must remain COMPLETELY UNTOUCHED.
   - Do NOT translate comments inside code blocks.

4. **Translation Quality**:
   - **Faithfulness**: Keep the original meaning accurately.
   - **Formatting**: Preserve all Markdown syntax (bold, italic, links, tables).

5. **Output Format**:
   - Return ONLY the translated body content.
   - Do NOT include explanations or XML tags.`;
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

  return `Translate the content inside the <source_text> tags into ${target}.

<source_text>
${content}
</source_text>

### EXAMPLES (Follow this pattern strictly):

**Input:**
To install the package, run the following command:
[[__META_SO_PARA_0__]]
\`\`\`bash
npm install package-name # install dependency
\`\`\`
[[__META_SO_PARA_1__]]

**Output (if target is Chinese):**
要安装该软件包，请运行以下命令：
[[__META_SO_PARA_0__]]
\`\`\`bash
npm install package-name # install dependency
\`\`\`
[[__META_SO_PARA_1__]]

### FINAL CHECKLIST:
1. Did you include ALL \`[[__META_SO_PARA_N__]]\` markers?
2. Are the markers in the EXACT same order as the input?
3. Did you leave the code blocks 100% untranslated (including comments)?
4. Is the output valid Markdown without the surrounding <source_text> tags?

Begin translation now. Return ONLY the translated content.`;
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

      // 检查是否已取消
      if (config.signal?.aborted) {
        throw new Error('Translation cancelled');
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

      // 处理取消错误（检查 AbortError 或消息）
      if (error instanceof Error && (error.name === 'AbortError' || error.message === 'Translation cancelled')) {
        return {
          success: false,
          error: 'Translation cancelled'
        };
      }

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
