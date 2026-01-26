<script setup lang="ts">
import type { ModelConfig, ProviderConfig } from '@/types';

interface Props {
  show: boolean;
  modelData: Partial<ModelConfig>;
  providers: ProviderConfig[];
  mode: 'add' | 'edit';
  validationErrors?: Record<string, string>;
}

interface Emits {
  (e: 'update:show', value: boolean): void;
  (e: 'update:modelData', value: Partial<ModelConfig>): void;
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

function updateModelData(field: keyof ModelConfig, value: string) {
  emit('update:modelData', { ...props.modelData, [field]: value });
}
</script>

<template>
  <Transition name="modal">
    <div v-if="props.show" class="modal-overlay" @click.self="closeOnClickOutside">
      <div class="modal-dialog">
        <h3>{{ props.mode === 'edit' ? '编辑模型' : '添加模型' }}</h3>

        <div class="modal-form">
          <div class="form-group">
            <label>模型ID *</label>
            <input
              :value="props.modelData.id"
              type="text"
              placeholder="例如: gpt-4o, claude-3-5-sonnet-20241022"
              :class="{ error: validationErrors?.id }"
              @input="updateModelData('id', ($event.target as HTMLInputElement).value)"
            />
            <div v-if="validationErrors?.id" class="error-text">{{ validationErrors.id }}</div>
          </div>

          <div class="form-group">
            <label>模型名称 *</label>
            <input
              :value="props.modelData.name"
              type="text"
              placeholder="例如: GPT-4o, Claude 3.5 Sonnet"
              :class="{ error: validationErrors?.name }"
              @input="updateModelData('name', ($event.target as HTMLInputElement).value)"
            />
            <div v-if="validationErrors?.name" class="error-text">{{ validationErrors.name }}</div>
          </div>

          <div class="form-group">
            <label>提供商 *</label>
            <select
              :value="props.modelData.providerId"
              class="modal-select"
              :class="{ error: validationErrors?.providerId }"
              @change="updateModelData('providerId', ($event.target as HTMLSelectElement).value)"
            >
              <option value="">选择提供商</option>
              <option v-for="provider in props.providers" :key="provider.id" :value="provider.id">
                {{ provider.name }}
              </option>
            </select>
            <div v-if="validationErrors?.providerId" class="error-text">{{ validationErrors.providerId }}</div>
          </div>

          <div class="form-group">
            <label>API Key *</label>
            <input
              :value="props.modelData.apiKey"
              type="password"
              placeholder="输入你的 API Key"
              autocomplete="off"
              :class="{ error: validationErrors?.apiKey }"
              @input="updateModelData('apiKey', ($event.target as HTMLInputElement).value)"
            />
            <div v-if="validationErrors?.apiKey" class="error-text">{{ validationErrors.apiKey }}</div>
          </div>

          <div class="form-group">
            <label>描述（可选）</label>
            <input
              :value="props.modelData.description"
              type="text"
              placeholder="例如: 最新的多模态模型"
              @input="updateModelData('description', ($event.target as HTMLInputElement).value)"
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

.form-group input.error,
.modal-select.error {
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
