<script lang="ts" setup>
import type { RealtimeProgressData } from '@/types';

interface Props {
  translationId: string;
}

interface Emits {
  (e: 'complete'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const progress = ref<RealtimeProgressData | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
let refreshTimer: number | null = null;

// 格式化速度
const formattedSpeed = computed(() => {
  if (!progress.value || progress.value.tokensPerSecond === 0) {
    return '计算中...';
  }
  const speed = progress.value.tokensPerSecond;
  if (speed < 1000) {
    return `${speed.toFixed(0)} tokens/s`;
  }
  return `${(speed / 1000).toFixed(1)}k tokens/s`;
});

// 格式化剩余时间
const formattedRemainingTime = computed(() => {
  if (!progress.value || progress.value.estimatedRemainingTime <= 0) {
    return '计算中...';
  }
  const seconds = Math.ceil(progress.value.estimatedRemainingTime / 1000);
  if (seconds < 60) {
    return `${seconds}秒`;
  }
  const minutes = Math.ceil(seconds / 60);
  return `${minutes}分钟`;
});

// 进度条样式
const progressStyle = computed(() => ({
  width: `${progress.value?.percentage || 0}%`,
  transition: 'width 0.3s ease'
}));

// 加载进度
async function loadProgress() {
  try {
    loading.value = true;
    error.value = null;

    const response = await browser.runtime.sendMessage({
      type: 'GET_REALTIME_PROGRESS',
      payload: { id: props.translationId }
    });

    if (response.success) {
      progress.value = response.data;

      // 如果已完成，停止刷新并通知父组件
      if (response.data.status === 'completed' || response.data.status === 'failed') {
        stopAutoRefresh();
        emit('complete');
      }
    } else {
      error.value = response.error || '加载进度失败';
    }
  } catch (err) {
    console.error('[ProgressCard] 加载进度失败:', err);
    error.value = '网络错误';
  } finally {
    loading.value = false;
  }
}

// 启动自动刷新
function startAutoRefresh() {
  // 每秒刷新一次
  refreshTimer = window.setInterval(() => {
    loadProgress();
  }, 1000);
}

// 停止自动刷新
function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

onMounted(() => {
  loadProgress();
  startAutoRefresh();
});

onUnmounted(() => {
  stopAutoRefresh();
});

// 监听翻译ID变化
watch(() => props.translationId, () => {
  stopAutoRefresh();
  loadProgress();
  startAutoRefresh();
});
</script>

<template>
  <div class="progress-card">
    <div v-if="loading && !progress" class="progress-loading">
      <span class="loading-text">加载进度中...</span>
    </div>

    <div v-else-if="error" class="progress-error">
      <span class="error-text">{{ error }}</span>
    </div>

    <div v-else-if="progress" class="progress-content">
      <!-- 进度头部 -->
      <div class="progress-header">
        <span class="progress-label">翻译中</span>
        <span class="progress-percentage">{{ progress.percentage.toFixed(1) }}%</span>
      </div>

      <!-- 进度条 -->
      <div class="progress-bar-container">
        <div class="progress-bar" :style="progressStyle"></div>
      </div>

      <!-- 详细信息 -->
      <div class="progress-details">
        <div class="detail-item">
          <span class="detail-label">速度</span>
          <span class="detail-value">{{ formattedSpeed }}</span>
        </div>

        <div class="detail-item">
          <span class="detail-label">预计剩余</span>
          <span class="detail-value">{{ formattedRemainingTime }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.progress-card {
  background: linear-gradient(135deg, #667eea15, #764ba215);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid #667eea30;
  margin-top: 12px;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.progress-loading,
.progress-error {
  padding: 12px;
  text-align: center;
}

.loading-text {
  color: #6b7280;
  font-size: 13px;
}

.error-text {
  color: #ef4444;
  font-size: 13px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.progress-label {
  font-size: 12px;
  font-weight: 600;
  color: #667eea;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.progress-percentage {
  font-size: 16px;
  font-weight: 700;
  color: #667eea;
}

.progress-bar-container {
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 12px;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #667eea, #764ba2);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-details {
  display: flex;
  justify-content: space-between;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.detail-label {
  font-size: 10px;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
}

.detail-value {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

@media (max-width: 480px) {
  .progress-details {
    grid-template-columns: 1fr;
  }
}
</style>
