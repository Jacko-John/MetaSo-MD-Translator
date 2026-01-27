<script lang="ts" setup>
import type { TranslationEntry } from '@/types';

interface Props {
  history: TranslationEntry[];
}

interface Emits {
  (e: 'delete', id: string): void;
  (e: 'retry', id: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const providerOptions = [
  { value: 'openai', label: 'OpenAI', icon: '🤖', color: '#10a37f' },
  { value: 'anthropic', label: 'Anthropic', icon: '🧠', color: '#d97757' },
  { value: 'custom', label: '自定义', icon: '⚙️', color: '#6b7280' }
];

function getProviderInfo(provider: string | undefined) {
  return providerOptions.find(p => p.value === provider) || providerOptions[0];
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return '今天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  } else if (days === 1) {
    return '昨天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  } else if (days < 7) {
    return `${days}天前`;
  } else {
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  }
}

function handleRetry(id: string) {
  emit('retry', id);
}

const stats = computed(() => {
  const completed = props.history.filter(h => h.status === 'completed').length;
  const failed = props.history.filter(h => h.status === 'failed').length;
  const pending = props.history.filter(h => h.status === 'pending').length;
  const totalTokens = props.history.reduce((sum, h) => sum + (h.meta?.tokenCount || 0), 0);
  return { completed, failed, pending, totalTokens, total: props.history.length };
});
</script>

<template>
  <div class="history-tab">
    <!-- Stats -->
    <div v-if="stats.total > 0" class="stats-row">
      <div class="stat-card">
        <div class="stat-value">{{ stats.completed }}</div>
        <div class="stat-label">已完成</div>
      </div>
      <div v-if="stats.pending > 0" class="stat-card stat-card-pending">
        <div class="stat-value">{{ stats.pending }}</div>
        <div class="stat-label">进行中</div>
      </div>
      <div v-if="stats.failed > 0" class="stat-card stat-card-failed">
        <div class="stat-value">{{ stats.failed }}</div>
        <div class="stat-label">失败</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ (stats.totalTokens / 1000).toFixed(1) }}k</div>
        <div class="stat-label">总 Tokens</div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="history.length === 0" class="empty-state">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
      <h3>暂无翻译记录</h3>
      <p>在 MetaSo 上打开 PDF 文档，开始使用翻译功能</p>
    </div>

    <!-- History List -->
    <div v-else class="history-list">
      <div
        v-for="item in history"
        :key="item.id"
        class="history-item"
      >
        <div class="history-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
        </div>
        <div class="history-content">
          <div class="history-header">
            <span class="history-id">{{ item.id }}</span>
            <span class="history-date">{{ formatDate(item.meta.translatedAt) }}</span>
          </div>
          <div class="history-meta">
            <span v-if="item.status === 'pending'" class="meta-badge meta-pending">
              ⏳ 翻译中
            </span>
            <span v-else-if="item.status === 'failed'" class="meta-badge meta-error">
              ❌ 失败
            </span>
            <span class="meta-badge" :style="{ '--badge-color': getProviderInfo(item.meta.provider).color }">
              {{ getProviderInfo(item.meta.provider).icon }} {{ item.meta.model }}
            </span>
            <span class="meta-badge meta-neutral">
              ~{{ item.meta.tokenCount }} tokens
            </span>
            <span class="meta-badge meta-neutral">
              {{ (item.meta.duration / 1000).toFixed(1) }}s
            </span>
          </div>
          <div v-if="item.status === 'failed' && item.error" class="error-message">
            {{ item.error }}
          </div>
        </div>
        <div class="action-buttons">
          <button
            v-if="item.status === 'failed' || item.status === 'pending'"
            class="btn-icon btn-retry"
            @click="handleRetry(item.id)"
            :title="item.status === 'pending' ? '重新开始' : '重试'"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
          </button>
          <button class="btn-icon btn-delete" @click="emit('delete', item.id)" title="删除">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18"/>
              <path d="M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.history-tab {
  padding: 20px;
}

/* History Tab */
.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.stat-card {
  background: white;
  padding: 16px;
  border-radius: 12px;
  text-align: center;
  border: 1px solid #e5e7eb;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #667eea;
  line-height: 1;
  margin-bottom: 4px;
}

.stat-card-failed .stat-value {
  color: #ef4444;
}

.stat-card-pending .stat-value {
  color: #3b82f6;
}

.stat-label {
  font-size: 11px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 60px 40px;
  color: #9ca3af;
}

.empty-state svg {
  color: #e5e7eb;
  margin-bottom: 16px;
}

.empty-state h3 {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
  color: #6b7280;
}

.empty-state p {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
}

/* History List */
.history-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 14px;
  transition: all 0.2s;
}

.history-item:hover {
  border-color: #667eea;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.1);
}

.history-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea15, #764ba215);
  border-radius: 10px;
  color: #667eea;
  flex-shrink: 0;
}

.history-content {
  flex: 1;
  min-width: 0;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.history-id {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  font-family: 'Monaco', 'Menlo', monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-date {
  font-size: 11px;
  color: #9ca3af;
  font-weight: 500;
  flex-shrink: 0;
  margin-left: 8px;
}

.history-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.meta-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: var(--badge-color);
  color: white;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 600;
}

.meta-neutral {
  background: #f3f4f6;
  color: #6b7280;
}

.meta-pending {
  background: #dbeafe;
  color: #2563eb;
}

.meta-error {
  background: #fee2e2;
  color: #dc2626;
}

.error-message {
  margin-top: 8px;
  padding: 8px 12px;
  background: #fef2f2;
  border-radius: 6px;
  font-size: 11px;
  color: #dc2626;
  line-height: 1.4;
}

.action-buttons {
  display: flex;
  gap: 4px;
}

/* Icon Button */
.btn-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.btn-delete {
  color: #9ca3af;
}

.btn-delete:hover {
  background: #fef2f2;
  color: #ef4444;
}

.btn-retry {
  color: #9ca3af;
}

.btn-retry:hover {
  background: #eff6ff;
  color: #3b82f6;
}
</style>
