<script lang="ts" setup>
import { ref, onMounted, computed } from 'vue';
import type { ConfigEntry, TranslationEntry } from '@/types';
import Header from './components/Header.vue';
import Tabs from './components/Tabs.vue';
import ConfigTab from './components/ConfigTab.vue';
import HistoryTab from './components/HistoryTab.vue';
import Toast from './components/Toast.vue';

const activeTab = ref<'config' | 'history'>('config');
const config = ref<Partial<ConfigEntry>>({});
const history = ref<TranslationEntry[]>([]);
const saving = ref(false);
const message = ref<{ type: 'success' | 'error', text: string } | null>(null);

const stats = computed(() => ({
  completed: history.value.filter(h => h.status === 'completed').length,
  totalTokens: history.value.reduce((sum, h) => sum + (h.meta?.tokenCount || 0), 0),
  total: history.value.length
}));

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
</script>

<template>
  <div class="popup">
    <!-- Toast Message -->
    <Toast :message="message" />

    <!-- Header -->
    <Header />

    <!-- Tabs -->
    <Tabs
      v-model:activeTab="activeTab"
      :historyCount="stats.total"
      @refreshHistory="loadHistory"
    />

    <!-- Content -->
    <main class="main">
      <Transition name="fade" mode="out-in">
        <!-- Config Tab -->
        <ConfigTab
          v-if="activeTab === 'config'"
          key="config"
          :config="config"
          :saving="saving"
          @update:config="config = $event"
          @save="saveConfig"
          @clearAll="clearAll"
        />

        <!-- History Tab -->
        <HistoryTab
          v-else
          key="history"
          :history="history"
          @delete="deleteTranslation"
        />
      </Transition>
    </main>
  </div>
</template>

<style scoped>
/* Base Styles */
.popup {
  width: 100%;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', sans-serif;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
}

/* Main Content */
.main {
  flex: 1;
  overflow-y: auto;
  background: #f8fafc;
}

/* Animations */
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
