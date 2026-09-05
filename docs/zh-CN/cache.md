# 增量缓存

默认启用 `cache.enabled`。`glyphweave build --no-cache` 强制重新编译；CLI 和
`--json` 分别报告复用与编译数量。`built` 仍包含所有可发布文章。

缓存按整篇文章目录的实际字节计算 SHA-256，包含元数据、正文、include、图片、
参考文献和其他文件。配置、编译器及其二进制、程序与 prelude、锁文件、字体、
Typst 包目录和相关环境变化都会失效。修改时间相同但内容不同也会重新编译。
未使用文件的变化也可能触发重建，因此不要在文章目录存放无关的大文件。

复用前校验全部产物摘要，将其复制到新 generation 后再次验证，并更新 manifest
路径。缓存损坏自动退回编译；可选 PDF 失败不缓存，下次继续尝试。删除或改为
非公开发布状态的文章不会残留在新索引中。构建过程中输入或环境变化会中止提交，
保留上一次完整结果；首次下载 Typst 包后如提示环境变化，重新运行构建即可。

Typst 时间固定为文章 updated/date 的 UTC 零点，可用 SOURCE_DATE_EPOCH 覆盖，
因此 datetime.today() 与 PDF 时间不再随构建时间变化。HTML、TOC、资源与 PDF
在相同工具链和环境下验证字节一致；generation 路径与 manifest.createdAt 仍会变化。

旧 generation 保留到 clean，避免破坏正在使用旧索引的读取者。应在没有构建或读取
进行时清理并重新构建；部署时仅导出当前索引对应的站点资源，不上传整个缓存目录。
每次构建都会计算字体等输入的实际字节，因此空构建也有固定开销。

运行 `pnpm test:integration`、`pnpm test:package` 和 `pnpm benchmark 100` 验证
真实编译、跨进程复用及冷构建/热构建/单篇修改/强制重建性能。
完整技术契约见[英文说明](../cache.md)。
