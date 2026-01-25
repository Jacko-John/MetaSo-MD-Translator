<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import type { ConfigEntry, TranslationEntry } from '@/types';

const activeTab = ref<'config' | 'history'>('config');
const config = ref<Partial<ConfigEntry>>({});
const history = ref<TranslationEntry[]>([]);
const saving = ref(false);
const message = ref<{ type: 'success' | 'error', text: string } | null>(null);

// 模型选项
const openaiModels = [
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4-turbo',
  'gpt-4',
  'gpt-3.5-turbo'
];

const anthropicModels = [
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
  'claude-3-opus-20240229',
  'claude-3-sonnet-20240229'
];

onMounted(() => {
  loadConfig();
  loadHistory();
});

async function loadConfig() {
  try {
    const response = await browser.runtime.sendMessage({ type: 'GET_CONFIG' });
    if (response.success) {
      config.value = response.data || {};
    }
  } catch (error) {
    console.error('Failed to load config:', error);
  }
}

async function loadHistory() {
  try {
    const response = await browser.runtime.sendMessage({ type: 'GET_HISTORY' });
    if (response.success) {
      history.value = response.data || [];
    }
  } catch (error) {
    console.error('Failed to load history:', error);
  }
}

async function saveConfig() {
  saving.value = true;
  try {
    const response = await browser.runtime.sendMessage({
      type: 'UPDATE_CONFIG',
      payload: config.value
    });

    if (response.success) {
      showMessage('success', '配置已保存');
    } else {
      showMessage('error', '保存失败: ' + response.error);
    }
  } catch (error) {
    console.error('Failed to save config:', error);
    showMessage('error', '保存失败');
  } finally {
    saving.value = false;
  }
}

async function deleteTranslation(id: string) {
  if (!confirm('确定要删除这条翻译记录吗？')) return;

  try {
    const response = await browser.runtime.sendMessage({
      type: 'DELETE_TRANSLATION',
      payload: { id }
    });

    if (response.success) {
      showMessage('success', '已删除');
      await loadHistory();
    } else {
      showMessage('error', '删除失败: ' + response.error);
    }
  } catch (error) {
    console.error('Failed to delete translation:', error);
    showMessage('error', '删除失败');
  }
}

async function clearAll() {
  if (!confirm('确定要清空所有数据吗？此操作不可恢复！')) return;

  try {
    const response = await browser.runtime.sendMessage({ type: 'CLEAR_ALL' });

    if (response.success) {
      showMessage('success', '已清空所有数据');
      await loadHistory();
      await loadConfig();
    } else {
      showMessage('error', '清空失败: ' + response.error);
    }
  } catch (error) {
    console.error('Failed to clear all:', error);
    showMessage('error', '清空失败');
  }
}

function showMessage(type: 'success' | 'error', text: string) {
  message.value = { type, text };
  setTimeout(() => {
    message.value = null;
  }, 3000);
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN');
}

function getProviderModels() {
  switch (config.value.apiProvider) {
    case 'openai':
      return openaiModels;
    case 'anthropic':
      return anthropicModels;
    default:
      return [];
  }
}
</script>

<template>
  <div class="popup">
    <!-- Header -->
    <header class="header">
      <h1>MetaSo 翻译器</h1>
    </header>

    <!-- Tabs -->
    <nav class="tabs">
      <button
        :class="{ active: activeTab === 'config' }"
        @click="activeTab = 'config'"
      >
        配置
      </button>
      <button
        :class="{ active: activeTab === 'history' }"
        @click="activeTab = 'history'; loadHistory()"
      >
        历史记录
      </button>
    </nav>

    <!-- Message -->
    <div v-if="message" :class="['message', message.type]">
      {{ message.text }}
    </div>

    <!-- Config Tab -->
    <div v-show="activeTab === 'config'" class="tab-content">
      <div class="form-group">
        <label>API 提供商</label>
        <select v-model="config.apiProvider">
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic (Claude)</option>
          <option value="custom">自定义端点</option>
        </select>
      </div>

      <div class="form-group">
        <label>API Key</label>
        <input
          v-model="config.apiKey"
          type="password"
          placeholder="sk-..."
          autocomplete="off"
        />
      </div>

      <div v-if="config.apiProvider === 'custom'" class="form-group">
        <label>API 端点</label>
        <input
          v-model="config.apiEndpoint"
          type="text"
          placeholder="https://api.example.com/v1/chat/completions"
        />
      </div>

      <div class="form-group">
        <label>模型</label>
        <select v-model="config.model">
          <option v-for="model in getProviderModels()" :key="model" :value="model">
            {{ model }}
          </option>
        </select>
      </div>

      <div class="form-group">
        <label>目标语言</label>
        <select v-model="config.language">
          <option value="zh-CN">简体中文</option>
          <option value="zh-TW">繁体中文</option>
          <option value="en">English</option>
          <option value="ja">日本語</option>
          <option value="ko">한국어</option>
        </select>
      </div>

      <div class="actions">
        <button
          class="btn-primary"
          :disabled="saving"
          @click="saveConfig"
        >
          {{ saving ? '保存中...' : '保存配置' }}
        </button>
      </div>

      <div class="danger-zone">
        <h3>危险操作</h3>
        <button class="btn-danger" @click="clearAll">
          清空所有数据
        </button>
      </div>
    </div>

    <!-- History Tab -->
    <div v-show="activeTab === 'history'" class="tab-content">
      <div v-if="history.length === 0" class="empty">
        暂无翻译记录
      </div>

      <div v-else class="history-list">
        <div
          v-for="item in history"
          :key="item.id"
          class="history-item"
        >
          <div class="history-header">
            <span class="history-id">{{ item.id }}</span>
            <span class="history-date">{{ formatDate(item.meta.translatedAt) }}</span>
          </div>
          <div class="history-meta">
            <span class="badge">{{ item.meta.provider }}</span>
            <span class="badge">{{ item.meta.model }}</span>
            <span class="badge">~{{ item.meta.tokenCount }} tokens</span>
            <span class="badge">{{ item.meta.duration }}ms</span>
          </div>
          <div class="history-actions">
            <button class="btn-small btn-danger" @click="deleteTranslation(item.id)">
              删除
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.popup {
  width: 400px;
  max-height: 600px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 16px 20px;
  text-align: center;
}

.header h1 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.tabs {
  display: flex;
  border-bottom: 1px solid #e0e0e0;
}

.tabs button {
  flex: 1;
  padding: 12px;
  border: none;
  background: white;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: #666;
  transition: all 0.2s;
}

.tabs button:hover {
  background: #f5f5f5;
}

.tabs button.active {
  color: #667eea;
  border-bottom: 2px solid #667eea;
}

.message {
  padding: 12px 20px;
  font-size: 14px;
  font-weight: 500;
}

.message.success {
  background: #d4edda;
  color: #155724;
}

.message.error {
  background: #f8d7da;
  color: #721c24;
}

.tab-content {
  padding: 20px;
  max-height: 450px;
  overflow-y: auto;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #333;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  box-sizing: border-box;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #667eea;
}

.actions {
  margin-top: 20px;
}

.btn-primary {
  width: 100%;
  padding: 10px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background: #5568d3;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.danger-zone {
  margin-top: 32px;
  padding-top: 20px;
  border-top: 1px solid #e0e0e0;
}

.danger-zone h3 {
  margin: 0 0 12px 0;
  font-size: 13px;
  font-weight: 600;
  color: #d32f2f;
}

.btn-danger {
  padding: 8px 16px;
  background: #f44336;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-danger:hover {
  background: #d32f2f;
}

.empty {
  text-align: center;
  padding: 40px 20px;
  color: #999;
  font-size: 14px;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-item {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 12px;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.history-id {
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

.history-date {
  font-size: 12px;
  color: #999;
}

.history-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.badge {
  padding: 4px 8px;
  background: #f5f5f5;
  border-radius: 4px;
  font-size: 11px;
  color: #666;
}

.history-actions {
  display: flex;
  justify-content: flex-end;
}

.btn-small {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-small.btn-danger {
  background: #ffebee;
  color: #d32f2f;
}

.btn-small.btn-danger:hover {
  background: #ffcdd2;
}
</style>
