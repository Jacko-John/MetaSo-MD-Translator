<script lang="ts" setup>
import { ref, onMounted, computed } from 'vue';
import type { ConfigEntry, TranslationEntry } from '@/types';

const activeTab = ref<'config' | 'history'>('config');
const config = ref<Partial<ConfigEntry>>({});
const history = ref<TranslationEntry[]>([]);
const saving = ref(false);
const message = ref<{ type: 'success' | 'error', text: string } | null>(null);

// 模型选项
const openaiModels = [
  { id: 'gpt-4o', name: 'GPT-4o', desc: '最新的多模态模型' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', desc: '快速且经济' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', desc: '高性能版本' },
  { id: 'gpt-4', name: 'GPT-4', desc: '经典版本' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', desc: '经济实惠' }
];

const anthropicModels = [
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', desc: '最新且强大' },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', desc: '快速响应' },
  { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', desc: '最强性能' },
  { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', desc: '平衡性能' }
];

const languageOptions = [
  { value: 'zh-CN', label: '简体中文', flag: '🇨🇳' },
  { value: 'zh-TW', label: '繁体中文', flag: '🇹🇼' },
  { value: 'en', label: 'English', flag: '🇺🇸' },
  { value: 'ja', label: '日本語', flag: '🇯🇵' },
  { value: 'ko', label: '한국어', flag: '🇰🇷' }
];

const providerOptions = [
  { value: 'openai', label: 'OpenAI', icon: '🤖', color: '#10a37f' },
  { value: 'anthropic', label: 'Anthropic', icon: '🧠', color: '#d97757' },
  { value: 'custom', label: '自定义', icon: '⚙️', color: '#6b7280' }
];

const stats = computed(() => {
  const completed = history.value.filter(h => h.status === 'completed').length;
  const totalTokens = history.value.reduce((sum, h) => sum + (h.meta?.tokenCount || 0), 0);
  return { completed, totalTokens, total: history.value.length };
});

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
      showMessage('success', '✓ 配置已保存');
    } else {
      showMessage('error', '✕ 保存失败: ' + response.error);
    }
  } catch (error) {
    console.error('Failed to save config:', error);
    showMessage('error', '✕ 保存失败');
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
      showMessage('success', '✓ 已删除');
      await loadHistory();
    } else {
      showMessage('error', '✕ 删除失败: ' + response.error);
    }
  } catch (error) {
    console.error('Failed to delete translation:', error);
    showMessage('error', '✕ 删除失败');
  }
}

async function clearAll() {
  if (!confirm('确定要清空所有数据吗？此操作不可恢复！')) return;

  try {
    const response = await browser.runtime.sendMessage({ type: 'CLEAR_ALL' });

    if (response.success) {
      showMessage('success', '✓ 已清空所有数据');
      await loadHistory();
      await loadConfig();
    } else {
      showMessage('error', '✕ 清空失败: ' + response.error);
    }
  } catch (error) {
    console.error('Failed to clear all:', error);
    showMessage('error', '✕ 清空失败');
  }
}

function showMessage(type: 'success' | 'error', text: string) {
  message.value = { type, text };
  setTimeout(() => {
    message.value = null;
  }, 3000);
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

function getProviderInfo(provider: string | undefined) {
  return providerOptions.find(p => p.value === provider) || providerOptions[0];
}
</script>

<template>
  <div class="popup">
    <!-- Toast Message -->
    <Transition name="slide-down">
      <div v-if="message" :class="['toast', message.type]">
        {{ message.text }}
      </div>
    </Transition>

    <!-- Header -->
    <header class="header">
      <div class="header-content">
        <div class="logo">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="url(#gradient)"/>
            <path d="M16 8L20 12L18 14L16 12L14 14L12 12L16 8Z" fill="white"/>
            <path d="M16 24L12 20L14 18L16 20L18 18L20 20L16 24Z" fill="white"/>
            <path d="M8 16L12 12L14 14L12 16L14 18L12 20L8 16Z" fill="white"/>
            <path d="M24 16L20 20L18 18L20 16L18 14L20 12L24 16Z" fill="white"/>
            <circle cx="16" cy="16" r="2" fill="white"/>
            <defs>
              <linearGradient id="gradient" x1="0" y1="0" x2="32" y2="32">
                <stop offset="0%" stop-color="#667eea"/>
                <stop offset="100%" stop-color="#764ba2"/>
              </linearGradient>
            </defs>
          </svg>
          <div>
            <h1>MetaSo 翻译器</h1>
            <p class="subtitle">AI 驱动的智能翻译</p>
          </div>
        </div>
      </div>
    </header>

    <!-- Tabs -->
    <nav class="tabs">
      <button
        :class="{ active: activeTab === 'config' }"
        @click="activeTab = 'config'"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z"/>
        </svg>
        配置
      </button>
      <button
        :class="{ active: activeTab === 'history' }"
        @click="activeTab = 'history'; loadHistory()"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 3v5h5"/>
          <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/>
          <path d="M12 7v5l4 2"/>
        </svg>
        历史记录
        <span v-if="stats.total > 0" class="badge-count">{{ stats.total }}</span>
      </button>
    </nav>

    <!-- Content -->
    <main class="main">
      <!-- Config Tab -->
      <Transition name="fade" mode="out-in">
        <div v-if="activeTab === 'config'" key="config" class="tab-content config-tab">
          <!-- Provider Selection -->
          <div class="section">
            <h2 class="section-title">API 提供商</h2>
            <div class="provider-grid">
              <button
                v-for="provider in providerOptions"
                :key="provider.value"
                :class="['provider-card', { active: config.apiProvider === provider.value as any }]"
                :style="{ '--provider-color': provider.color }"
                @click="config.apiProvider = provider.value as any"
              >
                <span class="provider-icon">{{ provider.icon }}</span>
                <span class="provider-label">{{ provider.label }}</span>
              </button>
            </div>
          </div>

          <!-- API Key -->
          <div class="section">
            <label class="field-label">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              API Key
            </label>
            <div class="input-wrapper">
              <input
                v-model="config.apiKey"
                type="password"
                placeholder="输入你的 API Key"
                autocomplete="off"
              />
              <div class="input-hint">你的密钥将被安全存储在本地</div>
            </div>
          </div>

          <!-- Custom Endpoint -->
          <div v-if="config.apiProvider === 'custom'" class="section custom-endpoint">
            <label class="field-label">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v6l4 2"/>
              </svg>
              API 端点
            </label>
            <input
              v-model="config.apiEndpoint"
              type="text"
              placeholder="https://api.example.com/v1/chat/completions"
              class="custom-input"
            />
          </div>

          <!-- Model Selection -->
          <div class="section">
            <label class="field-label">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              </svg>
              模型
            </label>

            <!-- 自定义提供商使用文本输入 -->
            <input
              v-if="config.apiProvider === 'custom'"
              v-model="config.model"
              type="text"
              placeholder="例如: gpt-4o, claude-3-5-sonnet-20241022"
              class="custom-input"
            />

            <!-- 预设提供商使用下拉选择 -->
            <select v-else v-model="config.model" class="model-select">
              <option value="">选择模型</option>
              <optgroup v-for="modelGroup in [getProviderModels()]" :key="modelGroup[0]?.id" :label="config.apiProvider === 'openai' ? 'OpenAI' : 'Anthropic'">
                <option v-for="model in modelGroup" :key="model.id" :value="model.id">
                  {{ model.name }} - {{ model.desc }}
                </option>
              </optgroup>
            </select>
          </div>

          <!-- Language Selection -->
          <div class="section">
            <label class="field-label">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M2 12h20"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              目标语言
            </label>
            <div class="language-grid">
              <button
                v-for="lang in languageOptions"
                :key="lang.value"
                :class="['language-card', { active: config.language === lang.value }]"
                @click="config.language = lang.value"
              >
                <span class="language-flag">{{ lang.flag }}</span>
                <span class="language-label">{{ lang.label }}</span>
              </button>
            </div>
          </div>

          <!-- Save Button -->
          <div class="actions">
            <button
              class="btn-primary"
              :disabled="saving || !config.apiKey"
              @click="saveConfig"
            >
              <svg v-if="saving" class="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              {{ saving ? '保存中...' : '保存配置' }}
            </button>
          </div>

          <!-- Danger Zone -->
          <div class="danger-zone">
            <h3>危险操作</h3>
            <button class="btn-danger" @click="clearAll">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18"/>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
              </svg>
              清空所有数据
            </button>
          </div>
        </div>

        <!-- History Tab -->
        <div v-else key="history" class="tab-content history-tab">
          <!-- Stats -->
          <div v-if="stats.total > 0" class="stats-row">
            <div class="stat-card">
              <div class="stat-value">{{ stats.completed }}</div>
              <div class="stat-label">已完成</div>
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
              </div>
              <button class="btn-icon btn-delete" @click="deleteTranslation(item.id)" title="删除">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 6L6 18"/>
                  <path d="M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </main>
  </div>
</template>

<style scoped>
/* Base Styles */
.popup {
  width: 420px;
  height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', sans-serif;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Toast */
.toast {
  position: fixed;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  padding: 10px 20px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 500;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.toast.success {
  background: #10b981;
  color: white;
}

.toast.error {
  background: #ef4444;
  color: white;
}

/* Header */
.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
}

.header-content h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.5px;
}

.subtitle {
  margin: 4px 0 0 0;
  font-size: 12px;
  opacity: 0.9;
  font-weight: 400;
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* Tabs */
.tabs {
  display: flex;
  background: white;
  border-bottom: 1px solid #e5e7eb;
}

.tabs button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: #6b7280;
  transition: all 0.2s;
  position: relative;
}

.tabs button:hover {
  color: #374151;
  background: #f9fafb;
}

.tabs button.active {
  color: #667eea;
}

.tabs button.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, #667eea, #764ba2);
}

.badge-count {
  background: #ef4444;
  color: white;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 10px;
  min-width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* Main Content */
.main {
  flex: 1;
  overflow-y: auto;
  background: #f8fafc;
}

.tab-content {
  padding: 20px;
}

/* Config Tab */
.section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin: 0 0 12px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Provider Cards */
.provider-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.provider-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 12px;
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.provider-card:hover {
  border-color: var(--provider-color);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.provider-card.active {
  border-color: var(--provider-color);
  background: linear-gradient(135deg, var(--provider-color)10, var(--provider-color)5);
}

.provider-icon {
  font-size: 24px;
}

.provider-label {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
}

/* Input Fields */
.field-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 8px;
}

.field-label svg {
  color: #9ca3af;
}

.input-wrapper {
  position: relative;
}

.input-wrapper input,
.model-select,
.custom-input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  font-size: 14px;
  box-sizing: border-box;
  transition: all 0.2s;
  background: white;
  color: #374151;
}

.input-wrapper input:focus,
.model-select:focus,
.custom-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.input-wrapper input::placeholder {
  color: #9ca3af;
}

.input-hint {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 6px;
}

.custom-endpoint {
  padding: 16px;
  background: #fef3c7;
  border-radius: 10px;
  border: 1px solid #fbbf24;
}

/* Language Grid */
.language-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.language-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 8px;
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.language-card:hover {
  border-color: #667eea;
  transform: translateY(-1px);
}

.language-card.active {
  border-color: #667eea;
  background: linear-gradient(135deg, #667eea10, #764ba210);
}

.language-flag {
  font-size: 24px;
  color: #414449;
}

.language-label {
  font-size: 11px;
  font-weight: 600;
  color: #374151;
}

/* Actions */
.actions {
  margin-top: 28px;
}

.btn-primary {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(102, 126, 234, 0.5);
}

.btn-primary:active:not(:disabled) {
  transform: translateY(0);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
}

/* Danger Zone */
.danger-zone {
  margin-top: 32px;
  padding: 20px;
  background: #fef2f2;
  border-radius: 12px;
  border: 1px solid #fecaca;
}

.danger-zone h3 {
  margin: 0 0 12px 0;
  font-size: 12px;
  font-weight: 600;
  color: #dc2626;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.btn-danger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-danger:hover {
  background: #dc2626;
  transform: translateY(-1px);
}

/* History Tab */
.stats-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
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

/* Animations */
.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translate(-50%, -20px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Scrollbar */
.main::-webkit-scrollbar {
  width: 6px;
}

.main::-webkit-scrollbar-track {
  background: transparent;
}

.main::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 3px;
}

.main::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}
</style>
