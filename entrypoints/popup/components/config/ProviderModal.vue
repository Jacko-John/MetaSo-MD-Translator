<script setup lang="ts">
import type { ProviderConfig } from '@/types';
import { PROVIDER_TYPES } from '../../constants/config';

interface Props {
  show: boolean;
  providerData: Partial<ProviderConfig>;
  mode: 'add' | 'edit';
  validationErrors?: Record<string, string>;
}

interface Emits {
  (e: 'update:show', value: boolean): void;
  (e: 'update:providerData', value: Partial<ProviderConfig>): void;
  (e: 'save'): void;
  (e: 'cancel'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

function handleSave() {
  emit('save');
}

function handleCancel() {
  emit('cancel');
}

function closeOnClickOutside() {
  emit('update:show', false);
}

function updateProviderData(field: keyof ProviderConfig, value: string) {
  emit('update:providerData', { ...props.providerData, [field]: value });
}
</script>

<template>
  <Transition name="modal">
    <div v-if="props.show" class="modal-overlay" @click.self="closeOnClickOutside">
      <div class="modal-dialog">
        <h3>{{ props.mode === 'edit' ? '编辑提供商' : '添加提供商' }}</h3>

        <div class="modal-form">
          <div class="form-group">
            <label>提供商ID *</label>
            <input
              :value="props.providerData.id"
              type="text"
              placeholder="例如: openai, anthropic, my-provider"
              :class="{ error: validationErrors?.id }"
              @input="updateProviderData('id', ($event.target as HTMLInputElement).value)"
            />
            <div v-if="validationErrors?.id" class="error-text">{{ validationErrors.id }}</div>
          </div>

          <div class="form-group">
            <label>提供商名称 *</label>
            <input
              :value="props.providerData.name"
              type="text"
              placeholder="例如: OpenAI, Anthropic, MyProvider"
              :class="{ error: validationErrors?.name }"
              @input="updateProviderData('name', ($event.target as HTMLInputElement).value)"
            />
            <div v-if="validationErrors?.name" class="error-text">{{ validationErrors.name }}</div>
          </div>

          <div class="form-group">
            <label>API 类型</label>
            <select
              :value="props.providerData.type"
              class="modal-select"
              @change="updateProviderData('type', ($event.target as HTMLSelectElement).value as 'openai' | 'anthropic' | 'custom')"
            >
              <option v-for="type in PROVIDER_TYPES" :key="type.value" :value="type.value">
                {{ type.label }} - {{ type.desc }}
              </option>
            </select>
          </div>

          <div class="form-group">
            <label>API 端点 *</label>
            <input
              :value="props.providerData.apiEndpoint"
              type="text"
              placeholder="https://api.example.com/v1/chat/completions"
              :class="{ error: validationErrors?.apiEndpoint }"
              @input="updateProviderData('apiEndpoint', ($event.target as HTMLInputElement).value)"
            />
            <div v-if="validationErrors?.apiEndpoint" class="error-text">{{ validationErrors.apiEndpoint }}</div>
          </div>

          <div class="form-group">
            <label>描述（可选）</label>
            <input
              :value="props.providerData.description"
              type="text"
              placeholder="例如: OpenAI 官方 API"
              @input="updateProviderData('description', ($event.target as HTMLInputElement).value)"
            />
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn-secondary" @click="handleCancel">取消</button>
          <button class="btn-primary" @click="handleSave">保存</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-dialog {
  background: white;
  border-radius: 12px;
  padding: 24px;
  max-width: 450px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.modal-dialog h3 {
  margin: 0 0 20px 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

.form-group input,
.modal-select {
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

.form-group input:focus,
.modal-select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-group input.error {
  border-color: #ef4444;
}

.error-text {
  font-size: 11px;
  color: #ef4444;
  margin-top: -4px;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.btn-primary,
.btn-secondary {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 20px;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(102, 126, 234, 0.5);
}

.btn-secondary {
  background: #e5e7eb;
  color: #374151;
}

.btn-secondary:hover {
  background: #d1d5db;
}

/* Animations */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-dialog,
.modal-leave-active .modal-dialog {
  transition: transform 0.2s ease;
}

.modal-enter-from .modal-dialog,
.modal-leave-to .modal-dialog {
  transform: scale(0.95);
}
</style>
