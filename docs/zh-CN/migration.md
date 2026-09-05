# 迁移与配置

升级后先运行 `pnpm install --frozen-lockfile && pnpm build`。

- 从 `.glyphweave/content-index.json` 读取产物路径，不能再拼接固定的 generated/posts 路径。新产物位于独立 generations 目录。
- 旧版本保留到 clean，不能把整个 .glyphweave 上传。clean 拒绝无归属标记的目录；旧项目先成功构建一次再 clean。输出必须是专用的项目内目录。
- 文章省略 pdf 时继承全局 enabledByDefault，显式 false 关闭。PDF warn 会记录诊断。
- headingIds 默认 preserve；stable 同步重写 ID 和本地引用。scopeClass 应用于片段容器。
- allowedExtensions 实际执行，资源真实路径不能越过 assets。
- cache.enabled 默认 true，build --no-cache 可强制重建，详见[增量缓存](cache.md)。sanitize、assets.copy、capture.report、htmlFeatures 仅接受 true；不支持的值会报错。
- 未知顶层字段、错误日期、显式配置文件缺失或依赖加载失败会报错。只有隐式默认配置文件不存在时回退。
- 严格捕获依据编译器确认的内容丢失；词法数量差异仅警告，因为 include 和宏会改变渲染数量。
- published/unlisted 可直接访问但不进入列表和搜索；draft/private/archived 不导出。

安装后的 TypeScript 配置需要 Node 22.18+；也可用 `--config` 指定 .mjs。工作区通过 tsx 运行 CLI。

仓库中的基础示例已移至 examples/minimal；使用 `pnpm glyphweave build --root examples/minimal`。完整站点位于 examples/astro-blog。Typst 时间固定为文章 updated/date 的 UTC 日期，可由 SOURCE_DATE_EPOCH 覆盖。

示例固定使用 Astro 7.2.10。Pagefind 在 Astro 构建后生成，其加载器位于 public/scripts/search.js，避免动态导入被打包器改写后留下未替换的占位符。`pnpm run audit` 使用官方 npm 服务审计依赖。
