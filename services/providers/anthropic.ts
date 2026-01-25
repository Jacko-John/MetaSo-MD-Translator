// Anthropic Provider

import type { TranslationProvider, TranslationConfig } from '@/types';
import { getDefaultSystemPrompt, buildUserPrompt } from '../translation';

/**
 * Anthropic Claude API 提供商
 */
export class AnthropicProvider implements TranslationProvider {
  name = 'Anthropic';
  readonly baseUrl = 'https://api.anthropic.com/v1/messages';

  async translate(content: string, config: TranslationConfig): Promise<string> {
    const systemPrompt = config.systemPrompt || getDefaultSystemPrompt(config.targetLanguage);

    const requestBody = {
      model: config.model,
      max_tokens: config.maxTokens || 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: buildUserPrompt(content, config.targetLanguage)
        }
      ]
    };

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Anthropic API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();

    if (!data.content || data.content.length === 0) {
      throw new Error('No translation returned from Anthropic');
    }

    return data.content[0].text;
  }

  estimateTokens(text: string): number {
    // Anthropic 粗略估算：与 OpenAI 类似
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 2) + Math.ceil(otherChars / 4);
  }
}
