<script lang="ts" setup>
import type { ConfigEntry } from '@/types';

interface Props {
  config: Partial<ConfigEntry>;
  saving: boolean;
}

interface Emits {
  (e: 'update:config', value: Partial<ConfigEntry>): void;
  (e: 'save'): void;
  (e: 'clearAll'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

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

function updateConfig<K extends keyof ConfigEntry>(key: K, value: ConfigEntry[K]) {
  emit('update:config', { ...props.config, [key]: value });
}

function getProviderModels() {
  switch (props.config.apiProvider) {
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
  <div class="config-tab">
    <!-- Provider Selection -->
    <div class="section">
      <h2 class="section-title">API 提供商</h2>
      <div class="provider-grid">
        <button
          v-for="provider in providerOptions"
          :key="provider.value"
          :class="['provider-card', { active: config.apiProvider === provider.value }]"
          :style="{ '--provider-color': provider.color }"
          @click="updateConfig('apiProvider', provider.value as any)"
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
          :value="config.apiKey"
          @input="updateConfig('apiKey', ($event.target as HTMLInputElement).value)"
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
        :value="config.apiEndpoint"
        @input="updateConfig('apiEndpoint', ($event.target as HTMLInputElement).value)"
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
        :value="config.model"
        @input="updateConfig('model', ($event.target as HTMLInputElement).value)"
        type="text"
        placeholder="例如: gpt-4o, claude-3-5-sonnet-20241022"
        class="custom-input"
      />

      <!-- 预设提供商使用下拉选择 -->
      <select v-else :value="config.model" @change="updateConfig('model', ($event.target as HTMLSelectElement).value)" class="model-select">
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
          @click="updateConfig('language', lang.value)"
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
        @click="emit('save')"
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
      <button class="btn-danger" @click="emit('clearAll')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 6h18"/>
          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
        </svg>
        清空所有数据
      </button>
    </div>
  </div>
</template>

<style scoped>
.config-tab {
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

/* Animations */
.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
