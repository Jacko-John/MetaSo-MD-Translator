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
    // 默认使用流式传输以便更新进度
    const useStream = config.useStream !== false;

    if (useStream) {
      return this.translateWithStream(content, config);
    }

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

  /**
   * 使用流式传输进行翻译
   */
  async translateWithStream(content: string, config: TranslationConfig): Promise<string> {
    const systemPrompt = config.systemPrompt || getDefaultSystemPrompt(config.targetLanguage);

    // 用于追踪 token 更新的变量
    let lastUpdateTime = 0;
    const UPDATE_INTERVAL = 500; // 每 500ms 更新一次
    let estimatedTokens = 0;

    const requestBody = {
      model: config.model,
      max_tokens: config.maxTokens || 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: buildUserPrompt(content, config.targetLanguage)
        }
      ],
      stream: true
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
        // Anthropic 使用 event: 和 data: 格式
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (!data || data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);

            // 检查是否是内容增量事件
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              result += parsed.delta.text;

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
    // Anthropic 粗略估算：与 OpenAI 类似
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 2) + Math.ceil(otherChars / 4);
  }
}
