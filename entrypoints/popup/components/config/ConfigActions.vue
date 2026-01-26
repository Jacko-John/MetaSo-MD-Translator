<script setup lang="ts">
interface Props {
  saving: boolean;
}

interface Emits {
  (e: 'save'): void;
  (e: 'clearAll'): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();
</script>

<template>
  <div>
    <!-- Actions -->
    <div class="actions">
      <button
        class="btn-primary"
        :disabled="saving"
        @click="emit('save')"
      >
        <svg v-if="saving" class="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        保存配置
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
/* Actions */
.actions {
  margin-top: 28px;
  display: flex;
  gap: 12px;
}

.btn-primary {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
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
