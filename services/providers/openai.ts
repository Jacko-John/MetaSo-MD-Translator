// OpenAI Provider

import type { TranslationProvider, TranslationConfig, TranslationResult } from '@/types';

/**
 * OpenAI API 提供商
 */
export class OpenAIProvider implements TranslationProvider {
  name = 'OpenAI';
  readonly baseUrl = 'https://api.openai.com/v1/chat/completions';

  async translate(content: string, config: TranslationConfig): Promise<string> {
    const systemPrompt = config.systemPrompt || this.getDefaultSystemPrompt();

    const requestBody = {
      model: config.model,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: this.buildUserPrompt(content, config.targetLanguage)
        }
      ],
      temperature: config.temperature || 0.3,
      max_tokens: config.maxTokens || 4096
    };

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();

    if (!data.choices || data.choices.length === 0) {
      throw new Error('No translation returned from OpenAI');
    }

    return data.choices[0].message.content;
  }

  estimateTokens(text: string): number {
    // OpenAI 粗略估算：英文 1 token ≈ 4 characters，中文 1 token ≈ 2 characters
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 2) + Math.ceil(otherChars / 4);
  }

  private buildUserPrompt(content: string, targetLanguage: string): string {
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

  private getDefaultSystemPrompt(): string {
    return `你是一个专业的技术文档翻译专家。请将给定的 Markdown 内容翻译为目标语言。

翻译要求：
1. 保持 Markdown 格式完整（标题、列表、代码块、链接等）
2. 专业术语保持一致性
3. 保持原文的语气和风格
4. 代码块内容不要翻译
5. 只返回翻译后的内容，不要添加任何解释或说明`;
  }
}
