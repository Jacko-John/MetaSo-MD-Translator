// entrypoints/ui/notificationManager.ts
// 通知管理器：管理通知队列、堆叠布局、定时器

/** 默认通知显示时长（毫秒） */
const DEFAULT_NOTIFICATION_DURATION = 2000;

/** 通知离场动画时长（毫秒） */
const NOTIFICATION_LEAVE_ANIMATION_DURATION = 500;

import type { NotificationConfig } from './notificationStyles';
import {
  getNotificationStyles,
  getNotificationIconHtml,
  getNotificationTypeClass,
} from './notificationStyles';

/**
 * 通知项接口
 */
interface NotificationItem {
  id: string;
  element: HTMLElement;
  timer: number | null;
  createdAt: number;
}

/**
 * 通知管理器类
 * 单例模式，管理页面上的所有通知
 */
export class NotificationManager {
  private notifications: Map<string, NotificationItem> = new Map();
  private container: HTMLElement | null = null;
  private stylesInjected: boolean = false;
  private idCounter: number = 0;

  /**
   * 确保通知容器和样式已初始化
   */
  private ensureContainer(): HTMLElement {
    if (!this.container) {
      this.container = document.getElementById('metaso-notification-container');

      if (!this.container) {
        this.container = document.createElement('div');
        this.container.id = 'metaso-notification-container';
        this.container.style.setProperty(
          '--metaso-notification-leave-duration',
          `${NOTIFICATION_LEAVE_ANIMATION_DURATION}ms`
        );
        document.body.appendChild(this.container);
      }
    }

    // 注入样式
    if (!this.stylesInjected) {
      const styleElement = document.createElement('style');
      styleElement.textContent = getNotificationStyles();
      styleElement.id = 'metaso-notification-styles';
      document.head.appendChild(styleElement);
      this.stylesInjected = true;
    }

    return this.container;
  }

  /**
   * 生成唯一通知 ID
   */
  private generateId(): string {
    this.idCounter += 1;
    return `metaso-notification-${Date.now()}-${this.idCounter}`;
  }

  /**
   * 创建通知卡片元素
   */
  private createNotificationCard(config: NotificationConfig): HTMLElement {
    const card = document.createElement('div');
    card.className = `metaso-notification-card ${getNotificationTypeClass(config.type)}`;

    const iconHtml = getNotificationIconHtml(config.type);

    card.innerHTML = `
      ${iconHtml}
      <div class="metaso-notification-content">${this.escapeHtml(config.message)}</div>
    `;

    return card;
  }

  /**
   * HTML 转义
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 启动自动移除定时器
   */
  private startTimer(id: string, duration: number): void {
    const notification = this.notifications.get(id);
    if (!notification) return;

    notification.timer = window.setTimeout(() => {
      this.dismiss(id);
    }, duration) as unknown as number;
  }

  /**
   * 显示通知
   * @param config 通知配置
   * @returns 通知 ID
   */
  show(config: NotificationConfig): string {
    const id = this.generateId();
    const container = this.ensureContainer();

    // 创建通知卡片
    const card = this.createNotificationCard(config);
    card.dataset.id = id;

    // 添加到容器
    container.appendChild(card);

    // 存储通知信息
    const notification: NotificationItem = {
      id,
      element: card,
      timer: null,
      createdAt: Date.now(),
    };
    this.notifications.set(id, notification);

    // 启动定时器
    const duration = config.duration ?? DEFAULT_NOTIFICATION_DURATION;
    this.startTimer(id, duration);

    console.log(`[MetaSo Notification] 显示通知: ${config.message}`);

    return id;
  }

  /**
   * 移除通知
   * @param id 通知 ID
   */
  dismiss(id: string): void {
    const notification = this.notifications.get(id);
    if (!notification) return;

    // 清除定时器
    if (notification.timer !== null) {
      clearTimeout(notification.timer);
    }

    // 添加离场动画
    notification.element.classList.add('metaso-notification-leaving');

    // 动画结束后移除元素
    setTimeout(() => {
      notification.element.remove();
      this.notifications.delete(id);
    }, NOTIFICATION_LEAVE_ANIMATION_DURATION);
  }

  /**
   * 清除所有通知
   */
  dismissAll(): void {
    const ids = Array.from(this.notifications.keys());
    ids.forEach((id) => this.dismiss(id));
  }

  /**
   * 更新通知内容
   * @param id 通知 ID
   * @param config 新的配置
   */
  update(id: string, config: Partial<NotificationConfig>): void {
    const notification = this.notifications.get(id);
    if (!notification) return;

    if (config.message) {
      const contentElement = notification.element.querySelector(
        '.metaso-notification-content'
      ) as HTMLElement;
      if (contentElement) {
        contentElement.textContent = config.message;
      }
    }

    if (config.type) {
      // 移除旧类型类
      notification.element.classList.forEach((className) => {
        if (className.startsWith('metaso-notification-') && className !== 'metaso-notification-card') {
          notification.element.classList.remove(className);
        }
      });
      // 添加新类型类
      notification.element.classList.add(getNotificationTypeClass(config.type));
    }
  }
}

// 单例实例
let managerInstance: NotificationManager | null = null;

/**
 * 获取通知管理器单例
 */
export function getNotificationManager(): NotificationManager {
  if (!managerInstance) {
    managerInstance = new NotificationManager();
  }
  return managerInstance;
}

/**
 * 便捷方法：显示通知
 */
export function showNotification(config: NotificationConfig): string {
  return getNotificationManager().show(config);
}

/**
 * 便捷方法：显示"正在翻译"通知
 */
export function showTranslatingNotification(): string {
  return showNotification({
    type: 'translating',
    message: '正在翻译，请稍候...',
    duration: DEFAULT_NOTIFICATION_DURATION,
  });
}

/**
 * 便捷方法：显示"检测到缓存"通知
 */
export function showCacheDetectedNotification(): string {
  return showNotification({
    type: 'cache-detected',
    message: '检测到可用翻译缓存',
    duration: DEFAULT_NOTIFICATION_DURATION,
  });
}

/**
 * 便捷方法：显示"已加载缓存"通知
 */
export function showCacheLoadedNotification(): string {
  return showNotification({
    type: 'cache-loaded',
    message: '已加载翻译缓存',
    duration: DEFAULT_NOTIFICATION_DURATION,
  });
}

/**
 * 便捷方法：显示"翻译成功"通知
 */
export function showTranslationSuccessNotification(): string {
  return showNotification({
    type: 'translation-success',
    message: '翻译成功！',
    duration: DEFAULT_NOTIFICATION_DURATION,
  });
}

/**
 * 便捷方法：显示错误通知
 */
export function showErrorNotification(message: string): string {
  return showNotification({
    type: 'error',
    message,
    duration: DEFAULT_NOTIFICATION_DURATION,
  });
}

// 导出类型
export type { NotificationConfig };
