<script lang="ts" setup>
// Header 组件 - 无需额外逻辑
</script>

<template>
  <header class="header">
    <div class="header-content">
      <div class="logo">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="8" fill="url(#gradient)"/>
          <path d="M16 8L20 12L18 14L16 12L14 14L12 12L16 8Z" fill="white"/>
          <path d="M16 24L12 20L14 18L16 20L18 18L20 20L16 24Z" fill="white"/>
          <path d="M8 16L12 12L14 14L12 16L14 18L12 20L8 16Z" fill="white"/>
          <path d="M24 16L20 20L18 18L20 16L18 14L20 12L24 16Z" fill="white"/>
          <circle cx="16" cy="16" r="2" fill="white"/>
          <defs>
            <linearGradient id="gradient" x1="0" y1="0" x2="32" y2="32">
              <stop offset="0%" stop-color="#667eea"/>
              <stop offset="100%" stop-color="#764ba2"/>
            </linearGradient>
          </defs>
        </svg>
        <div>
          <h1>MetaSo 翻译器</h1>
          <p class="subtitle">AI 驱动的智能翻译</p>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
/* Header */
.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
  border-radius: 16px 16px 0 0;
}

.header-content h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.5px;
}

.subtitle {
  margin: 4px 0 0 0;
  font-size: 12px;
  opacity: 0.9;
  font-weight: 400;
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
}
</style>
