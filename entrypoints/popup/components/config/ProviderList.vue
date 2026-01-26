<script setup lang="ts">
import type { ProviderConfig } from '@/types';
import { PROVIDER_TYPES } from '../../constants/config';

interface Props {
  providers: ProviderConfig[];
  validationErrors?: Record<string, string>;
}

interface Emits {
  (e: 'add'): void;
  (e: 'edit', index: number): void;
  (e: 'delete', index: number): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

function getProviderLabel(type: string): string {
  return PROVIDER_TYPES.find(t => t.value === type)?.label || type;
}
</script>

<template>
  <div class="section">
    <div class="section-header">
      <h2 class="section-title">API 提供商</h2>
      <button class="btn-add-small" @click="emit('add')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        添加提供商
      </button>
    </div>

    <div v-if="providers.length === 0" class="empty-state">
      <p>还没有配置任何提供商</p>
      <button class="btn-primary" @click="emit('add')">添加第一个提供商</button>
    </div>

    <div v-else class="providers-list">
      <div
        v-for="(provider, index) in providers"
        :key="provider.id"
        class="provider-item"
      >
        <div class="provider-info">
          <div class="provider-name">{{ provider.name }}</div>
          <div v-if="provider.description" class="provider-desc">{{ provider.description }}</div>
          <div class="provider-meta">
            <span class="provider-type">{{ getProviderLabel(provider.type) }}</span>
            <span class="provider-endpoint">{{ provider.apiEndpoint }}</span>
          </div>
        </div>
        <div class="provider-actions">
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
    </div>
    <div v-if="validationErrors?.providers" class="error-text">{{ validationErrors.providers }}</div>
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

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

/* Providers List */
.providers-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.provider-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  transition: all 0.2s;
}

.provider-item:hover {
  border-color: #d1d5db;
}

.provider-info {
  flex: 1;
  min-width: 0;
}

.provider-name {
  font-size: 15px;
  font-weight: 600;
  color: #374151;
}

.provider-desc {
  font-size: 13px;
  color: #6b7280;
  margin-top: 4px;
}

.provider-meta {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.provider-type {
  font-size: 11px;
  font-weight: 600;
  color: #667eea;
  background: #667eea10;
  padding: 2px 8px;
  border-radius: 4px;
}

.provider-endpoint {
  font-size: 11px;
  color: #9ca3af;
  font-family: monospace;
}

.provider-actions {
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
