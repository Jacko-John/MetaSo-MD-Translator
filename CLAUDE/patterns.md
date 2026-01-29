# Code Patterns & Conventions

**Auto-Generated** - Last Updated: 2026-01-29

## Architecture Patterns

### 三层脚本通信模式

```
[Injected Script] ←→ [Content Script] ←→ [Background]
    (window.postMessage)    (chrome.runtime.sendMessage)
```

- **injected.ts**: 注入到页面上下文，可访问页面变量和拦截 API
- **content.ts**: 隔离上下文，作为 injected 和 background 的桥梁
- **background.ts**: 后台服务，处理持久化和翻译任务

### 消息处理模式

所有消息处理集中在 `entrypoints/background/handlers/index.ts`:

```typescript
export async function handleMessage(
  message: Message,
  sender: MessageSender
): Promise<MessageResponse>
```

模块化的处理器：
- `configHandlers.ts` - 配置相关
- `historyHandlers.ts` - 历史记录
- `progressHandlers.ts` - 进度查询
- `translationHandlers.ts` - 翻译任务

### IndexedDB 存储模式

使用自定义封装 `utils/indexedDB.ts`:

```typescript
// 初始化
await indexedDB.init()

// 操作
await indexedDB.contents.add(...)
await indexedDB.translations.get(...)
await indexedDB.config.get('config')
```

## Code Style

### TypeScript

- 严格类型检查，所有类型定义集中在 `types/index.ts`
- 使用接口定义数据结构
- 消息类型使用联合类型和枚举

### Vue 3

- 使用 Composition API (`<script setup>`)
- 组件文件按功能分组在 `components/` 子目录

### 命名约定

| Type | Convention | Example |
|------|------------|---------|
| 文件名 | camelCase | `configHandlers.ts` |
| 组件名 | PascalCase | `ConfigTab.vue` |
| 类型/接口 | PascalCase | `Message`, `TranslationEntry` |
| 常量 | UPPER_SNAKE_CASE | `MESSAGE_TYPES` |
| 函数/变量 | camelCase | `handleMessage`, `sendMessage` |

## File Organization

### Handlers Pattern

每个功能模块的 handler:
1. 导出相关类型的消息处理器函数
2. 函数签名统一: `async function handleXxx(payload: XxxMessage['payload']): Promise<MessageResponse>`
3. 错误处理统一返回 `{ success: false, error: string }`

### Provider Pattern

AI 提供商实现统一接口:
```typescript
interface TranslationProvider {
  translate(content: string, config: TranslationConfig): Promise<string>
  estimateTokens(text: string): number
}
```
