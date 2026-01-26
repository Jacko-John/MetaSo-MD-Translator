import { CONFIG } from '@/entrypoints/background/constants';

/**
 * API 频率限制器
 */
export class RateLimiter {
  private requests: number[] = [];
  private maxRequests: number;
  private windowMs: number;

  constructor(
    maxRequests: number = CONFIG.RATE_LIMIT.MAX_REQUESTS,
    windowMs: number = CONFIG.RATE_LIMIT.WINDOW_MS
  ) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  canMakeRequest(): boolean {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    return this.requests.length < this.maxRequests;
  }

  recordRequest(): void {
    this.requests.push(Date.now());
  }

  getWaitTime(): number {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.windowMs);

    if (this.requests.length < this.maxRequests) {
      return 0;
    }

    const oldestRequest = this.requests[0];
    return oldestRequest + this.windowMs - now;
  }

  async waitIfNeeded(): Promise<void> {
    const waitTime = this.getWaitTime();
    if (waitTime > 0) {
      console.log(`[RateLimiter] 达到频率限制，等待 ${Math.ceil(waitTime / 1000)} 秒...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

export const rateLimiter = new RateLimiter();
