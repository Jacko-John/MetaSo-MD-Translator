/**
 * Background script 类型定义
 */

type MessageSender = typeof browser.runtime.onMessage.addListener extends (
  cb: (msg: any, sender: infer S, ...rest: any[]) => any
) => any ? S : never;

export interface ParagraphInfo {
  text: string;
  itemIndex: number;
  paragraphIndex: number;
  estimatedTokens: number;
}

export interface MarkdownExtractionResult {
  text: string;
  estimatedTokens: number;
}

export type { MessageSender };
