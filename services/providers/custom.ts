// Custom Endpoint Provider

import type { TranslationProvider, TranslationConfig } from '@/types';
import { getDefaultSystemPrompt, buildUserPrompt } from '../translation';

/**
 * 自定义端点提供商（兼容 OpenAI 格式）
 */
export class CustomProvider implements TranslationProvider {
  name = 'Custom';

  async translate(content: string, config: TranslationConfig): Promise<string> {
    if (!config.apiEndpoint) {
      throw new Error('Custom endpoint not configured');
    }

    const systemPrompt = config.systemPrompt || getDefaultSystemPrompt(config.targetLanguage);

    const requestBody = {
      model: config.model,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: buildUserPrompt(content, config.targetLanguage)
        }
      ],
      temperature: config.temperature || 0.3,
      max_tokens: config.maxTokens || 4096
    };

    const response = await fetch(config.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Custom API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();

    // 尝试兼容 OpenAI 格式
    if (data.choices && data.choices.length > 0) {
      return data.choices[0].message.content;
    }

    // 尝试兼容 Anthropic 格式
    if (data.content && data.content.length > 0) {
      return data.content[0].text;
    }

    // 直接返回内容
    if (typeof data.content === 'string') {
      return data.content;
    }

    throw new Error('Unexpected response format from custom endpoint');
  }

  estimateTokens(text: string): number {
    // 默认估算
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 2) + Math.ceil(otherChars / 4);
  }
}
