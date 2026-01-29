// entrypoints/ui/notificationStyles.ts
// 通知系统样式定义

/**
 * 获取通知系统的 CSS 样式
 * 返回纯 CSS 字符串（不含 style 标签）
 */
export function getNotificationStyles(): string {
  return `
    /* 通知容器 */
      #metaso-notification-container {
        --metaso-notification-leave-duration: 1000ms;
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 999999;
        display: flex;
        flex-direction: column;
        gap: 12px;
        pointer-events: none;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      /* 通知卡片 */
      .metaso-notification-card {
        pointer-events: auto;
        min-width: 280px;
        max-width: 320px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        padding: 14px 16px;
        display: flex;
        align-items: center;
        gap: 12px;
        animation: metaso-notification-slide-in 0.3s ease-out;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }

      .metaso-notification-card:hover {
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
      }

      /* 离场动画 */
      .metaso-notification-card.metaso-notification-leaving {
        animation: metaso-notification-slide-out var(--metaso-notification-leave-duration) ease-in forwards;
      }

      /* 图标 */
      .metaso-notification-icon {
        flex-shrink: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        font-size: 14px;
      }

      /* 翻译中图标 - 蓝色 + spinner */
      .metaso-notification-translating .metaso-notification-icon {
        background: #E3F2FD;
        color: #2196F3;
      }

      .metaso-notification-translating .metaso-notification-icon::before {
        content: '';
        width: 14px;
        height: 14px;
        border: 2px solid #2196F3;
        border-top-color: transparent;
        border-radius: 50%;
        animation: metaso-notification-spinner 1s linear infinite;
      }

      /* 缓存检测图标 - 绿色 */
      .metaso-notification-cache-detected .metaso-notification-icon {
        background: #E8F5E9;
        color: #10b981;
      }

      .metaso-notification-cache-detected .metaso-notification-icon::before {
        content: '✓';
        font-weight: bold;
        font-size: 16px;
      }

      /* 缓存加载图标 - 绿色 */
      .metaso-notification-cache-loaded .metaso-notification-icon {
        background: #E8F5E9;
        color: #10b981;
      }

      .metaso-notification-cache-loaded .metaso-notification-icon::before {
        content: '↻';
        font-weight: bold;
        font-size: 14px;
      }

      /* 翻译成功图标 - 绿色 */
      .metaso-notification-translation-success .metaso-notification-icon {
        background: #E8F5E9;
        color: #10b981;
      }

      .metaso-notification-translation-success .metaso-notification-icon::before {
        content: '✓';
        font-weight: bold;
        font-size: 16px;
      }

      /* 错误图标 - 红色 */
      .metaso-notification-error .metaso-notification-icon {
        background: #FFEBEE;
        color: #f44336;
      }

      .metaso-notification-error .metaso-notification-icon::before {
        content: '!';
        font-weight: bold;
        font-size: 18px;
      }

      /* 内容区域 */
      .metaso-notification-content {
        flex: 1;
        font-size: 14px;
        color: #333;
        line-height: 1.4;
      }

      /* 进度条（翻译中类型可选） */
      .metaso-notification-progress {
        position: absolute;
        bottom: 0;
        left: 0;
        height: 3px;
        background: linear-gradient(90deg, #2196F3, #64B5F6);
        border-radius: 0 0 8px 8px;
        animation: metaso-notification-progress 5s linear forwards;
      }

      /* 动画定义 */
      @keyframes metaso-notification-slide-in {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      @keyframes metaso-notification-slide-out {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(100%);
          opacity: 0;
        }
      }

      @keyframes metaso-notification-spinner {
        to {
          transform: rotate(360deg);
        }
      }

      @keyframes metaso-notification-progress {
        from {
          width: 100%;
        }
        to {
          width: 0%;
        }
      }

      /* 响应式调整 */
      @media (max-width: 480px) {
        #metaso-notification-container {
          top: 10px;
          right: 10px;
          left: 10px;
        }

        .metaso-notification-card {
          max-width: none;
          min-width: 0;
        }
      }
  `;
}

/**
 * 获取通知类型对应的图标 HTML
 * 图标通过 CSS ::before 伪元素实现
 */
export function getNotificationIconHtml(_type: NotificationType): string {
  return '<div class="metaso-notification-icon"></div>';
}

/**
 * 通知类型定义
 */
export type NotificationType = 'translating' | 'cache-detected' | 'cache-loaded' | 'translation-success' | 'error';

/**
 * 通知配置
 */
export interface NotificationConfig {
  type: NotificationType;
  message: string;
  duration?: number; // 毫秒，默认 5000
}

/**
 * 获取通知类型的 CSS 类名
 */
export function getNotificationTypeClass(type: NotificationType): string {
  return `metaso-notification-${type}`;
}
