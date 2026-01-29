# Project Summary

**Auto-Generated** - Last Updated: 2026-01-29

## Core Purpose

MetaSo MD 翻译器 - 一个为 MetaSo (metaso.cn) 网站提供 AI 翻译功能的浏览器扩展。该扩展拦截 MetaSo API 返回的 Markdown 内容，使用 AI 模型（OpenAI/Anthropic/自定义）进行翻译，并自动替换页面显示的翻译结果。

## Tech Stack

| Category | Technology |
|----------|------------|
| **Extension Framework** | [WXT](https://wxt.dev) v0.20.6 |
| **Frontend** | Vue 3.5.25 + TypeScript 5.9.3 |
| **Storage** | IndexedDB (via custom utils) |
| **AI APIs** | OpenAI, Anthropic, Custom endpoints |
| **Build Tool** | WXT (Vite-based) |

## Project Structure

```
entrypoints/
├── background.ts          # 后台服务：消息处理、存储管理、翻译调度
├── content.ts             # 内容脚本：injected script 与 background 的桥梁
├── injected.ts            # 注入脚本：拦截 MetaSo API、DOM 操作
├── background/
│   ├── handlers/          # 消息处理器模块化
│   └── utils/             # 后台工具函数
├── popup/                 # 弹出窗口 UI
│   ├── App.vue            # 主应用组件
│   ├── components/        # Vue 组件
│   └── constants/         # 常量配置
├── ui/                    # 页面 UI（同意弹窗、通知）
services/
├── translation.ts         # 翻译服务核心逻辑
└── providers/             # AI 提供商实现
    ├── openai.ts
    ├── anthropic.ts
    └── custom.ts
types/
└── index.ts               # TypeScript 类型定义
utils/
├── indexedDB.ts           # IndexedDB 封装
├── urlParser.ts           # MetaSo URL 解析
└── ...                    # 其他工具函数
```

## Key Features

1. **AI 翻译** - 支持 OpenAI/Anthropic/自定义 API 翻译 Markdown 内容
2. **断点续传** - 翻译任务支持批次进度保存和恢复
3. **实时进度** - 显示翻译速度、剩余时间、百分比进度
4. **翻译缓存** - 已翻译内容自动缓存，避免重复翻译
5. **历史管理** - 翻译历史记录、删除、重试失败任务
6. **导入/导出** - 支持翻译历史数据的导入和导出
7. **多模型配置** - 灵活的提供商和模型配置系统

## Architecture Patterns

- **消息传递**: Content Script ↔ Background ↔ Popup 通过 Chrome Extension Message API 通信
- **三层脚本架构**:
  - `injected.ts` - 注入到页面上下文，拦截 API 调用
  - `content.ts` - 隔离上下文，作为桥梁
  - `background.ts` - 后台服务，处理数据和翻译任务
- **状态管理**: 使用 IndexedDB 持久化存储
- **模块化处理**: Background handlers 按功能模块化（config、history、progress、translation）

## Build Commands

```bash
npm run dev          # 开发模式 (Chrome)
npm run dev:firefox  # 开发模式 (Firefox)
npm run build        # 构建生产版本
npm run zip          # 打包扩展
npm run compile      # TypeScript 类型检查
```

## Version

Current: v1.2.0
