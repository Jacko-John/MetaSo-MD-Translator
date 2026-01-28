<script lang="ts" setup>
import type { TranslationEntry } from '@/types';
import ProgressCard from './ProgressCard.vue';

interface Props {
  history: TranslationEntry[];
}

interface Emits {
  (e: 'delete', id: string): void;
  (e: 'retry', id: string): void;
  (e: 'refresh'): void;
  (e: 'progressComplete'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const exporting = ref(false);
const importing = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const providerOptions = [
  { value: 'openai', label: 'OpenAI', icon: '🤖', color: '#10a37f' },
  { value: 'anthropic', label: 'Anthropic', icon: '🧠', color: '#d97757' },
  { value: 'custom', label: '自定义', icon: '⚙️', color: '#6b7280' }
];

const handleRetry = (id: string) => emit('retry', id);
const handleDelete = (id: string) => emit('delete', id);
const handleRefresh = () => emit('refresh');
const handleProgressComplete = () => emit('progressComplete');

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


// 下载 JSON 文件
function downloadJsonFile(data: any, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json;charset=utf-8'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// 格式化文件名
function getExportFilename(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `metaso-translations-${year}${month}${day}-${hours}${minutes}${seconds}.json`;
}

// 处理导出
async function handleExport() {
  exporting.value = true;
  try {
    const response = await browser.runtime.sendMessage({
      type: 'EXPORT_HISTORY'
    });

    if (response.success) {
      downloadJsonFile(response.data, getExportFilename());
      console.log(`✓ 已导出 ${response.data.translations.length} 条记录`);
    } else {
      console.error('✕ 导出失败:', response.error);
    }
  } catch (error) {
    console.error('Export error:', error);
  } finally {
    exporting.value = false;
  }
}

// 处理导入按钮点击
function handleImport() {
  fileInput.value?.click();
}

// 处理文件选择
async function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  // 重置 input 以允许再次选择同一文件
  target.value = '';

  importing.value = true;
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    const response = await browser.runtime.sendMessage({
      type: 'IMPORT_HISTORY',
      payload: data
    });

    if (response.success) {
      console.log(`✓ 成功导入 ${response.data.imported} 条记录，跳过 ${response.data.skipped} 条重复记录`);
      // 重新加载历史记录
      handleRefresh();
    } else {
      console.error('✕ 导入失败:', response.error);
    }
  } catch (error) {
    console.error('Import error:', error);
    if (error instanceof SyntaxError) {
      console.error('✕ 文件格式错误：不是有效的 JSON 文件');
    }
  } finally {
    importing.value = false;
  }
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
    <!-- Toolbar -->
    <div class="toolbar">
      <div class="toolbar-title">
        <h2>翻译历史</h2>
        <span class="count">{{ history.length }} 条记录</span>
      </div>
      <div class="toolbar-actions">
        <button
          class="btn-export"
          @click="handleExport"
          :disabled="exporting"
        >
          <svg v-if="!exporting" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
            <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
            <path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="1"/>
          </svg>
          {{ exporting ? '导出中...' : '导出全部' }}
        </button>
        <button
          class="btn-import"
          @click="handleImport"
          :disabled="importing"
        >
          <svg v-if="!importing" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
            <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
            <path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="1"/>
          </svg>
          {{ importing ? '导入中...' : '导入数据' }}
        </button>
        <input
          type="file"
          ref="fileInput"
          accept=".json"
          @change="handleFileSelect"
          hidden
        >
      </div>
    </div>

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

          <!-- 实时进度卡片（仅pending时显示） -->
          <ProgressCard
            v-if="item.status === 'pending'"
            :key="`${item.id}-${item.status}`"
            :translation-id="item.id"
            @complete="handleProgressComplete()"
          />

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
          <button class="btn-icon btn-delete" @click="handleDelete(item.id)" title="删除">
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

/* Toolbar */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 16px;
  background: white;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
}

.toolbar-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.toolbar-title h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #1f2937;
}

.toolbar-title .count {
  font-size: 12px;
  color: #6b7280;
  font-weight: 500;
}

.toolbar-actions {
  display: flex;
  gap: 8px;
}

.btn-export, .btn-import {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-export {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

.btn-export:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-import {
  background: white;
  color: #667eea;
  border: 1px solid #667eea;
}

.btn-import:hover:not(:disabled) {
  background: #f5f3ff;
}

.btn-export:disabled, .btn-import:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.spin {
  animation: spin 1s linear infinite;
}

@media (max-width: 480px) {
  .toolbar {
    flex-direction: column;
    gap: 12px;
  }

  .toolbar-title {
    width: 100%;
  }

  .toolbar-actions {
    width: 100%;
  }

  .btn-export, .btn-import {
    flex: 1;
  }
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
