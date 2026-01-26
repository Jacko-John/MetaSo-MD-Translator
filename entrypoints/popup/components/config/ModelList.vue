<script setup lang="ts">
import type { ModelConfig, ProviderConfig } from '@/types';

interface Props {
  models: ModelConfig[];
  providers: ProviderConfig[];
  selectedModelId: string;
  validationErrors?: Record<string, string>;
}

interface Emits {
  (e: 'select', modelId: string): void;
  (e: 'add'): void;
  (e: 'edit', index: number): void;
  (e: 'delete', index: number): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

function getProviderName(providerId: string): string {
  return props.providers.find(p => p.id === providerId)?.name || '未知提供商';
}

function handleSelectModel(event: Event) {
  const target = event.target as HTMLSelectElement;
  emit('select', target.value);
}
</script>

<template>
  <div class="section">
    <div class="section-header">
      <h2 class="section-title">模型配置</h2>
      <button class="btn-add-small" @click="emit('add')" :disabled="providers.length === 0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        添加模型
      </button>
    </div>

    <div v-if="models.length === 0" class="empty-state">
      <p>还没有配置任何模型</p>
      <button class="btn-primary" @click="emit('add')" :disabled="providers.length === 0">
        添加第一个模型
      </button>
    </div>

    <div v-else>
      <!-- Current Model Selection -->
      <div class="current-model-section">
        <label class="sub-label">当前选中模型</label>
        <select
          :value="selectedModelId"
          @change="handleSelectModel"
          :class="{ error: validationErrors?.selectedModel }"
          class="model-select"
        >
          <option value="">选择模型</option>
          <option v-for="model in models" :key="model.id" :value="model.id">
            {{ model.name }}
          </option>
        </select>
        <div v-if="validationErrors?.selectedModel" class="error-text">{{ validationErrors.selectedModel }}</div>
      </div>

      <!-- Configured Models List -->
      <div class="models-list">
        <label class="sub-label">已配置的模型 ({{ models.length }}个)</label>
        <div
          v-for="(model, index) in models"
          :key="model.id"
          :class="['model-item', { active: model.id === selectedModelId }]"
        >
          <div class="model-info">
            <div class="model-name">{{ model.name }}</div>
            <div v-if="model.description" class="model-desc">{{ model.description }}</div>
            <div class="model-meta">
              <span class="model-provider">{{ getProviderName(model.providerId) }}</span>
              <span class="model-api-key">{{ model.apiKey.slice(0, 8) }}***</span>
            </div>
          </div>
          <div class="model-actions">
            <button class="btn-icon" @click="emit('edit', index)" title="编辑">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="btn-icon btn-danger" @click="emit('delete', index)" title="删除">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>
        <div v-if="validationErrors?.models" class="error-text">{{ validationErrors.models }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.section {
  margin-bottom: 24px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.btn-add-small {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: white;
  border: 1px solid #667eea;
  border-radius: 6px;
  color: #667eea;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-add-small:hover:not(:disabled) {
  background: #667eea10;
}

.btn-add-small:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.empty-state {
  text-align: center;
  padding: 32px 16px;
  background: #f8fafc;
  border: 2px dashed #e5e7eb;
  border-radius: 12px;
}

.empty-state p {
  color: #6b7280;
  margin: 0 0 16px 0;
  font-size: 14px;
}

.btn-primary {
  padding: 10px 20px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* Models List */
.current-model-section {
  margin-bottom: 16px;
}

.models-list {
  margin-top: 16px;
}

.sub-label {
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  margin-bottom: 6px;
  display: block;
}

.model-select {
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

.model-select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.model-select.error {
  border-color: #ef4444;
}

.model-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  margin-bottom: 8px;
  transition: all 0.2s;
}

.model-item:hover {
  border-color: #d1d5db;
}

.model-item.active {
  border-color: #667eea;
  background: linear-gradient(135deg, #667eea10, #764ba210);
}

.model-info {
  flex: 1;
  min-width: 0;
}

.model-name {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.model-desc {
  font-size: 12px;
  color: #6b7280;
  margin-top: 2px;
}

.model-meta {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.model-provider,
.model-api-key {
  font-size: 10px;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.model-actions {
  display: flex;
  gap: 6px;
  margin-left: 12px;
}

.btn-icon {
  padding: 6px;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  color: #6b7280;
}

.btn-icon:hover {
  background: #f3f4f6;
  color: #374151;
}

.btn-icon.btn-danger:hover {
  background: #fef2f2;
  color: #ef4444;
}

.error-text {
  font-size: 11px;
  color: #ef4444;
  margin-top: 4px;
}
</style>
