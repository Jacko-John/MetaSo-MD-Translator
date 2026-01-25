<script lang="ts" setup>
interface Props {
  message?: { type: 'success' | 'error'; text: string } | null;
}

defineProps<Props>();
</script>

<template>
  <Transition name="slide-down">
    <div v-if="message" :class="['toast', message.type]">
      {{ message.text }}
    </div>
  </Transition>
</template>

<style scoped>
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

/* Animations */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translate(-50%, -20px);
}
</style>
