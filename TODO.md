## Bugs and Features

- [-] 虽然当前主要功能并没有问题，但是运行报错如下，且有时候会出现无法拦截翻译的情况
```error
[MetaSo Translator] 请求翻译失败: Request timeout - no response from background
[MetaSo Translator] 请求翻译失败: Request timeout - no response from background
[Background] Failed to send progress message: Error: Could not establish connection. Receiving end does not exist.
Uncaught (in promise) InvalidStateError: Failed to execute 'send' on 'XMLHttpRequest': The object's state must be OPENED.
[MetaSo Translator] 请求翻译失败: Request timeout - no response from background
```

- [-] 对于相同的markdown，当前并没有去重，而是重复提醒用户，用户同意之后开启重复的翻译

- [-] 历史记录页的进度不是响应式的，需要手动刷新，希望可以改成自动刷新，同时希望加上进度条（以tokens为标准）
