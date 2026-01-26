<script setup lang="ts">
import { LANGUAGE_OPTIONS } from '../../constants/config';

interface Props {
  currentLanguage: string;
}

interface Emits {
  (e: 'select', language: string): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

function selectLanguage(language: string) {
  emit('select', language);
}
</script>

<template>
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
        v-for="lang in LANGUAGE_OPTIONS"
        :key="lang.value"
        :class="['language-card', { active: currentLanguage === lang.value }]"
        @click="selectLanguage(lang.value)"
      >
        <span class="language-flag">{{ lang.flag }}</span>
        <span class="language-label">{{ lang.label }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.section {
  margin-bottom: 24px;
}

.field-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 8px;
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
</style>
