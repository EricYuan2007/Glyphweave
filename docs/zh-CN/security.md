# 安全模型

Phase 1 默认 Typst 作者可信，但仍保护 HTML 注入边界。

默认会删除或拒绝：

- `<script>`、`iframe`、`object`、`embed`、表单和 style 标签。
- `onclick`、`onerror` 等事件属性。
- `style` 属性。
- `javascript:` 和 `file:` URL。
- `/Users/...`、`/home/...`、`~/...` 等本地绝对路径。
- 越过文章 `assets/` 目录边界的资源引用。

## 部署建议

- 提交源文章、示例、测试和文档。
- 不提交 `.glyphweave`、Astro `dist`、Pagefind 输出、本地 `.npmrc` 或复制后的 public 产物。
- 合并前运行 `pnpm check` 和 `pnpm run verify:demo`。
- 升级 Typst 时，把 HTML export 变化视为兼容性事件，重新验证 fixture 和示例站。

Phase 1 不是给不可信 Typst 文档使用的服务端沙箱。未来服务端编译需要加入文件系统隔离、时间限制、包控制和产物校验。
