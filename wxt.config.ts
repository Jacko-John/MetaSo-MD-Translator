import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    name: 'MetaSo MD 翻译器',
    description: '为 MetaSo 网站提供 AI 翻译功能',
    // 必须声明 web_accessible_resources，否则网页无法加载注入的脚本
    web_accessible_resources: [
      {
        resources: ['injected.js'],
        matches: ['*://metaso.cn/*'],
      },
    ],
    host_permissions: [
      'https://api.openai.com/*',
      'https://api.anthropic.com/*',
    ],
  },
});