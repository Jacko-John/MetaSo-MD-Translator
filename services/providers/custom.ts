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

    // 默认使用流式传输以便更新进度
    const useStream = config.useStream !== false;

    if (useStream) {
      return this.translateWithStream(content, config);
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

  /**
   * 使用流式传输进行翻译（OpenAI 兼容格式）
   */
  async translateWithStream(content: string, config: TranslationConfig): Promise<string> {
    if (!config.apiEndpoint) {
      throw new Error('Custom endpoint not configured');
    }

    const systemPrompt = config.systemPrompt || getDefaultSystemPrompt(config.targetLanguage);

    // 用于追踪 token 更新的变量
    let lastUpdateTime = 0;
    const UPDATE_INTERVAL = 500; // 每 500ms 更新一次
    let estimatedTokens = 0;

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
      max_tokens: config.maxTokens || 4096,
      stream: true
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

    // 读取流式响应
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body reader');
    }

    const decoder = new TextDecoder();
    let result = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              result += content;

              // 估算当前 token 数量并定期更新
              const now = Date.now();
              if (now - lastUpdateTime > UPDATE_INTERVAL) {
                estimatedTokens = this.estimateTokens(result);
                lastUpdateTime = now;

                // 调用更新回调
                if (config.onTokenUpdate) {
                  config.onTokenUpdate(estimatedTokens);
                }
              }
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }

    // 最终更新一次，确保返回准确的 token 数
    estimatedTokens = this.estimateTokens(result);
    if (config.onTokenUpdate) {
      config.onTokenUpdate(estimatedTokens);
    }

    return result;
  }

  estimateTokens(text: string): number {
    // 默认估算
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 2) + Math.ceil(otherChars / 4);
  }
}
