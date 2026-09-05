# Glyphweave 架构与工程化评估

评估日期：2026-09-05。代码基线：`f6b7b07`。评估对象：六个 packages、Astro 示例、Typst prelude、测试、CI/CD、配置及中英文工程文档。本文保留初次评估时的代码证据，属于历史快照。后续整改见[工程验收记录](../engineering-validation.md)、[变更记录](../../CHANGELOG.md)及[迁移说明](migration.md)，不要把下文的原始缺陷描述当成当前状态。

## 1. 结论与判断依据

Glyphweave 的方向正确：以构建时流水线把 Typst 与站点运行时隔离，以 HTML/JSON/PDF 为跨框架契约。代码规模可控、职责命名清晰，已经是有实际功能的原型，而非随意拼接的脚本集合。适合继续沿现有结构演进。

当前成熟度应定位为“受信作者、受控环境下的早期工程原型”。正常示例已经可用，但发布状态变更、失败恢复、配置边界和独立分发还没有形成完整保证。因此不能把示例构建成功等同于面向一般用户的稳定工程产品。

优化的首要目标是行为可靠、产物可信、故障可解释，然后才是分层整理、性能和扩展能力。六个包无需继续拆成更多服务，也不需要引入通用依赖注入容器或复杂插件框架。

| 维度           | 当前判断       | 依据与主要缺口                                          |
| -------------- | -------------- | ------------------------------------------------------- |
| 架构方向       | 良好           | 构建时处理、产物解耦、编译器封装合理                    |
| 模块分层       | 基础良好       | adapter 反向依赖 core 类型；文件 I/O 与 AST 变换混合    |
| 正确性与一致性 | 优先补强       | 重建残留、非事务写入、失效配置、公式误判                |
| 安全边界       | 有意识但不完整 | HTML 黑名单可绕过、符号链接越界、危险 clean 配置        |
| 类型与契约     | 部分落实       | Zod 输入验证存在，产物读取仍是类型断言，HAST 大量 any   |
| 测试与交付     | 正常路径可验证 | 36 项测试通过；缺状态迁移、故障注入、浏览器与分发验收   |
| 注释与文档     | 文档框架齐全   | 公共 API 和关键不变量缺注释，配置及安全说明与实现有偏差 |
| 使用体验       | 示例较完整     | 错误定位、预览、配置解释、迁移到独立项目仍有缺口        |
| 性能与可复现性 | 尚未建立基线   | 串行编译、重复目录复制、无实际缓存及完整输入指纹        |

这些是定性判断，不是覆盖率或成熟度的量化测量。

## 2. 本次验证

环境：macOS、Node.js v24.15.0、pnpm 11.1.1、Typst 0.15.0。CI 声明使用 Node 22，本次未实际执行远程 CI。

- `pnpm check`：lint、TypeScript 检查和全部 10 个测试文件、36 项测试通过。
- `pnpm run verify:demo`：真实 Typst 编译、Astro 构建、Pagefind 索引全部通过。根示例和 Astro 文章各报告 11/11 MathML；Astro 生成 6 个页面，Pagefind 索引 1 个正文页面。
- 首次沙箱运行的 3 项 CLI 测试因 tsx 本地 IPC 管道 `EPERM` 失败；在允许 IPC 的环境重跑通过，这是环境限制，不记为产品缺陷。
- 使用独立临时目录和合成文件复现了下文的 PDF 默认值、旧产物发布、配置吞错、标题冲突、URL 检查绕过、资源符号链接和 clean 问题。
- 用真实 Typst 验证了注释中的美元公式导致严格捕获误报；用编译器依赖注入验证了 PDF 失败后的新旧产物混合。

未验证：浏览器内脚本实际执行、跨浏览器视觉和辅助技术体验、大规模性能、Windows、外部项目安装、远程 Pages 部署、PDF 视觉及字体完整性。本报告没有声称这些能力已经通过验收。

## 3. 现有架构与设计模式

实际依赖关系如下，箭头表示使用或导入：

```text
cli ──────────> core ──────────> typst
                 │                │
                 ├──> html-adapter ┘
                 │        │
                 └──────> schema <── astro
                          ↑
                   typst、adapter

html-adapter --仅类型导入--> core.DiscoveredTypstPost
示例站点 --文件读取--> generated artifacts
```

运行时未见必须依赖循环初始化的环；但 core→adapter→core 的类型耦合已经使包边界不再单向。TypeScript 会擦除类型导入，这不应被误称为已发生运行时循环故障。

已有模式及评价：

| 模式                   | 现有实现                                   | 评价及建议                                                       |
| ---------------------- | ------------------------------------------ | ---------------------------------------------------------------- |
| Pipeline               | discover → compile → adapt → write → index | 与问题高度匹配；需要阶段结果、失败语义和发布事务                 |
| Facade                 | 各包 index.ts、buildAll                    | 入口易理解；避免无限扩大 core 的再导出面                         |
| Adapter                | Typst CLI 包装、HTML 归一化                | 能隔离上游变化；HTML adapter 应只接受最小上下文                  |
| 函数式依赖注入         | BuildDependencies                          | 已让构建测试不依赖真实编译器；保留，按故障测试需要补文件发布边界 |
| Strategy 的雏形        | MathML / SVG、PDF 模板开关                 | 当前分支数量少，简单函数足够；能力组合增多后再显式封装策略       |
| Schema / DTO           | Zod metadata、manifest、index              | 方向正确；必须在反序列化边界实际 parse                           |
| Functional core 的雏形 | buildTocTree、positionSidenotes            | 纯计算已经可测，值得向 HTML 变换扩展                             |

不建议为了“设计模式完整”增加抽象工厂、基类层级、事件总线或泛化仓储。应为实际变化点和不可逆副作用提供接口，而非为每个函数创建接口。

## 4. 优先修复的确定问题

优先级：P0 表示可能导致数据删除或违反发布边界；P1 表示常规正确性、完整性或核心安全契约问题；P2 表示维护、扩展和体验问题。它们是本项目的整改顺序，不是外部漏洞评级。

### F01 · P0 · clean 可删除项目本身

证据：`packages/core/src/build.ts:139` 直接对 `path.resolve(rootDir, config.output.root)` 递归删除；`packages/schema/src/config.ts:38` 接受任意字符串。

复现：仅在新建的可丢弃临时目录放置合成 source.txt，配置 `output.root: '.'` 后调用 clean，整个临时项目目录被删除。真实工作区未执行这种配置。

建议：统一输出目录校验；拒绝文件系统根、项目根、项目祖先及源码重叠目录；明确外部输出目录策略。删除前校验生成目录标记与真实路径。标记不是唯一依据，还需防止链接和路径别名绕过。build、doctor、clean 共享相同规则。

验收：正常生成目录可清理；`.`、`..`、绝对根路径、源码目录、符号链接等危险输入全部被拒绝，源码校验值保持不变。

### F02 · P0 · 状态变化后旧资源仍会发布

证据：`packages/core/src/build.ts:58` 跳过 private/archived，却不清除其既有输出；`examples/astro-blog/scripts/sync-glyphweave-public.mjs:11` 遍历整个 generated/posts，而不是当前发布清单。

复现：先构建 public 且启用 PDF 的文章，再改为 private 并重建，随后运行原有同步脚本，`public/glyphweave/posts/demo/article.pdf` 仍存在。PDF 从 true 改为 false 后，旧 article.pdf 同样残留。代码还允许 draft 生成产物，而同步阶段没有 draft 发布过滤。

建议：用“本次成功构建且满足发布策略的清单”决定导出，逐项复制清单中真实启用的资源；删除或切换旧发布目录。把 build、publish、list、search 的政策显式区分。之前已经公开过的下载无法通过源站清理追回，本项验收针对后续构建产物。

验收：覆盖 public→private、published→archived、published→draft、删除文章、改 slug、关闭 PDF、PDF 降级失败；新发布目录和搜索索引均不包含不应发布的文件。

### F03 · P1 · 写入没有整体提交边界

证据：`packages/core/src/build.ts:65-135` 直接更新最终路径；HTML/TOC 在 PDF 前写入，manifest 及总索引在后面写入。

复现：首次构建成功，第二次写入新 HTML 后让 PDF 抛错，最终目录保留新 content.html 与上一轮 manifest/PDF。多文章构建还可能出现前几篇已更新、后几篇失败而总索引仍旧的状态。

建议：构建到独立 generation/staging 目录，校验全部产物后再提交。首先明确一致性目标是整次站点构建，而不仅是单篇。长期可用不可变 generation 加原子更新的小型指针文件；并发构建使用锁，读者固定 generation，旧目录延迟回收。不要假定多文件 rename 或各平台非空目录覆盖天然具有整体原子性。

验收：在编译、资源复制、PDF、manifest、index 和提交各阶段注入失败，消费者只能看到完整旧版本或完整新版本；并发构建不混写。

### F04 · P1 · 配置存在“接受但无效”以及错误被吞掉

证据：`packages/schema/src/config.ts:15` 将缺省 pdf 转成 false，`packages/core/src/build.ts:92` 再使用 `?? enabledByDefault`，全局默认永远无法覆盖缺省值。

复现：文章省略 pdf、全局 enabledByDefault=true，实际 PDF 编译调用数为 0。

另一个复现：现存配置模块 import 不存在的依赖，`loadConfig` 返回默认 `.glyphweave`，没有报错。因为 `packages/core/src/config.ts:10` 把所有 MODULE_NOT_FOUND 都解释为配置不存在。

静态确认的配置兑现情况：

| 配置                     | 当前行为                                                 |
| ------------------------ | -------------------------------------------------------- |
| cache.enabled            | 未参与构建控制，没有实际缓存                             |
| assets.copy              | 未传入 adapter，资源始终尝试复制                         |
| assets.allowedExtensions | 未被资源复制逻辑检查                                     |
| html.scopeClass          | 接受但未在 adapter 输出中使用，示例硬编码 class          |
| capture.report           | 未参与是否生成报告的逻辑                                 |
| typst.htmlFeatures       | 影响 manifest 声明，实际 HTML 编译始终传 --features html |
| typst.pdf.failure=warn   | 吞掉错误并置 pdfPath=null，缺少对应警告诊断              |

建议：为“作者原始配置”和“解析后的有效配置”分开建模，pdf 保留缺省状态，统一计算优先级。只对默认配置文件本身不存在回退；显式指定文件缺失和其依赖错误必须报错。未实现选项移除、拒绝或明确标记，避免默许。日期格式应验证，未知键策略应统一，defineConfig 使用可推断输入类型替代 unknown，以获得编辑器补全。

验收：每个公开选项都对应可观察行为测试；覆盖缺省/true/false 与全局值组合；配置拼写、文件缺失、依赖缺失、语法错误分别有明确诊断。

### F05 · P1 · HTML 安全契约与实现不相称

证据：`packages/html-adapter/src/security.ts` 使用有限标签黑名单及仅匹配字符串开头的 javascript/file 正则；SVG style 被直接保留。`adapter.ts:52` 将整个 HTML 交给该 URL 正则，不能检查 HTML 内部所有 URL。

复现：输入 `<a href="java&#x09;script:alert(1)">`，sanitize=true 时输出仍包含带制表符的协议文本。这里只验证了净化输出未移除该链接，没有在浏览器触发执行。

此外，直接在整份 raw/content 字符串搜索 `/Users/` 会把文章正常讨论路径的正文或代码示例也当成路径泄露。需要区分资源 URL、属性、诊断信息和普通文本，而不是混成一个全局字符串断言。

建议：以 HTML/MathML/SVG 的显式允许列表、规范化 URL 协议及严格 CSS 属性策略替代分散黑名单；复用项目已声明的 rehype-sanitize，并为 Typst 特性补最小 schema 和回归语料。默认 schema 不能直接套用，否则可能破坏公式。净化后的 Shiki/按钮变换应被定义为受信代码，并检查其输入处理及最终输出。官方也明确要求审视净化后执行的变换：[rehype-sanitize](https://github.com/rehypejs/rehype-sanitize)。

验收：HTML 实体、控制字符、大小写、data URL、SVG 链接/style/动画、DOM ID 冲突均有策略测试；合法公式与代码高亮不退化。公开发布路径不允许在不知情情况下使用未净化 HTML。

### F06 · P1 · assets 目录限制只检查词法路径

证据：`packages/html-adapter/src/assets.ts:68-79` 检查 path.relative 后直接 copyFile，没有校验真实路径。

复现：assets/link.png 指向同一临时测试树内、assets 以外的合成文件，适配器成功把内容复制到产物。没有读取任何真实私密文件。

建议：在当前受信作者模型下，realpath 约束或拒绝符号链接足以显著改善契约；允许扩展名必须真正执行，下载资源 href 与媒体 src 的处理规则应统一。未来若支持不受信作者，还需要系统级隔离，不能把 realpath 检查当成完整沙箱。

验收：普通资源成功；目录内链接指向外部、嵌套链接、禁止扩展名和越界路径失败；资源复制失败有文章、源路径和阶段上下文。

### F07 · P1 · 公式捕获把启发式计数当成正确性证明

证据：`packages/typst/src/formula-scanner.ts` 逐行扫描美元符号，只特殊处理部分 raw code；adapter 只读取主文件，SVG 源码按顺序对应渲染节点；`assertCapture` 默认强制数量相等。

真实复现：合法源文件 `// $not_rendered$` 加普通标题，Typst 正常产生 HTML，Glyphweave 报 `Strict capture failed: 1 formula(s) missing, mismatch=true`。

静态可见的未覆盖情形包括：include/import、宏动态生成、多次展开、字符串/块注释、未实际显示的公式，以及显示顺序与源码顺序不同。它们需要专门实验确认具体结果。即使两个数量相等，也不能证明一一对应或语义完整。

建议：保留启发式扫描作为诊断信息，记录方法和可信度；在没有可靠映射时不要让它独立否决合法构建。优先调查编译器侧捕获或 prelude 标记的稳定标识及源位置，用实际渲染对象作对照。区分编译器明确报告丢失、映射不可判定和弱计数不一致。

另：capture.ts 同时计数 pre 和 code，会对标准代码块计数两次，并包含行内 code；数学计数在净化前统计，也不天然代表最终保留数量。指标需给出定义，在最终 AST 上验证。

验收：真实 Typst fixture 覆盖注释、字符串、include、宏、重复公式、两种数学策略；严格模式只在有可靠证据的内容丢失时失败，无法判定必须显式报告。

### F08 · P1 · 标题重命名破坏引用且仍可能重复

证据：`packages/html-adapter/src/headings.ts:17` 只统计 base 出现次数，不检查最终 ID 全局唯一，也没有 old→new 引用映射。

复现：标题 A、A、A-2 生成 a、a-2、a-2；原先 id=old 的标题重命名后，href=#old 保留，变成失效锚点。非标题元素的 ID 也没有纳入冲突集合。

建议：默认保留已有可信 ID；如需重写，预留全局 ID 集合并维护引用映射，更新片段链接及相关 ID 引用属性；TOC 从最终 AST 提取。标题文字提取应保留节点间空格。跨构建稳定性需明确是“相同输入结果相同”还是“标题改动后老链接仍可用”。

验收：重复标题、带数字后缀标题、非标题同名 ID、Typst 交叉引用、中文标题、标题内行内元素全部保持唯一且可跳转。

## 5. 分层、类型和数据契约的整理

建议保留六包，先在包内形成明确职责：

```text
cli / astro：用户入口、渲染适配
core：构建计划、发布政策、流程编排与提交
html-adapter：纯 HTML/AST 转换与验证
 typst：编译进程、模板、编译诊断
schema：共享数据契约、输入与输出验证
```

- **core**：将 buildAll 拆成 planBuild、buildPost、validateArtifacts、commitGeneration 等有语义的阶段。拆分标准是副作用与失败边界，而不是行数。文件写入接口保持少量操作即可。
- **html-adapter**：改成接受 rawHtml、source/capture 信息、slug 等最小上下文；资源重写先返回复制计划，由 core 执行。这样可独立测试纯变换，并消除对 DiscoveredTypstPost 的反向依赖。
- **schema**：可以放共享 PostIdentity、ArtifactPaths；不要机械搬入所有含文件系统细节的 core 类型。区分 config 输入与默认值解析后的输出。
- **typst**：保留 execa、30 秒编译超时和 finally 临时目录清理。HTML/PDF wrapper 的临时工作区复制逻辑可抽一个私有 helper；避免引入继承模板类。版本检测也应有超时，错误保留 cause、退出码、阶段和 logPath。
- **astro**：当前只有 11 行读取 helper，示例反而重复 JSON 读取和过滤政策。把索引验证、单篇读取、路径解析、资源导出做成可复用构建期 API，主题和交互留在示例。

`HastNode` 现在是 type:string + 大量可选属性，遍历靠 as any。建议使用正式 HAST Root/Element/Text 联合类型和类型守卫；先消除 AST 边界 any，再考虑 noUncheckedIndexedAccess 等更严格检查。全局关闭 no-explicit-any 不应成为长期默认。

`packages/astro/src/index.ts:10`、示例读取和 CLI inspect 都只 JSON.parse 后断言。应使用 ContentIndexSchema/ManifestSchema/TocItemSchema 校验，错误包含文件及字段路径；未知版本明确拒绝或迁移。共享 TypeScript 类型不等于磁盘数据已经可信。

manifest 的 generatorVersion 硬编码于 core，同时存在各 package version；应选择单一来源。features 与 renderer 能力应拆清，记录实际编译参数/返回值而非仅根据配置推导。对跨平台路径区分磁盘路径与公开 URL。

## 6. 内容政策与“好用”的差距

示例 `getGlyphweavePosts()` 仅过滤 published 和非 private，导致 unlisted 进入首页、归档、标签列表，并进入正文搜索索引。若 unlisted 的产品含义是“链接可访问但不列出”，当前实现不满足；这一语义需要在公开契约中确定，而不是让每个消费者自行猜测。

建议的默认矩阵：

| 状态                     | 生产页面/资源 | 首页/归档/标签/搜索 |
| ------------------------ | ------------- | ------------------- |
| published + public       | 允许          | 允许                |
| published + unlisted     | 允许直接访问  | 排除                |
| private、draft、archived | 默认不导出    | 排除                |

预览可单独支持 draft，但应独立于正式发布目录。unlisted 不是访问控制。

CLI 建议提供错误码、文章 slug、阶段、源文件/行号、日志路径、--verbose 和 --json。PDF warn 必须在最终摘要可见。doctor 当前使用 access 默认存在性检查却声称可写，且依据版本直接声称 MathML 支持；应使用实际写入探针和小型能力编译，并检查配置与内容路径、字体配置。

逐步补充 init/new、单篇构建、watch/preview、有效配置展示。优先让用户在文档中的最短路径完成“创建文章→预览→修改→定位错误→发布”，再增加高级选项。

Astro 示例已有语义化组件、目录、旁注、图片键盘触发及关闭后焦点恢复，是值得保留的体验投入。后续应验证重复脚注引用、多篇内容同页、窄屏、长公式、无 JavaScript、焦点顺序及 reduced-motion。组件目前多用全局 querySelector，若未来支持客户端页面切换或多实例，需显式挂载/卸载及 observer/listener 清理；当前静态整页导航不能仅因此判为内存泄露。

元数据 cover/canonicalUrl 已接受但未进入内容索引；页面语言硬编码 zh-CN。应明确哪些字段实际支持，逐步贯通 canonical、语言和封面。Pagefind 当前已生成索引，但示例没有搜索交互入口，索引成功与读者能搜索是两项能力。

## 7. 注释与文档

packages 的 TypeScript 源码几乎没有说明性注释。短小函数并不需要逐行解释，但当前最关键的“为什么”与“不变量”缺少沉淀。

建议按三类补充：

1. **公共 API 的 TSDoc**：参数路径相对于哪里；是否写文件；输出目录归属；失败是否保留旧版本；返回警告与抛错的区别。尤其 buildAll、clean、loadConfig、adaptTypstHtml、compileTypstHtml/Pdf、readGlyphweaveContentIndex。
2. **非显然实现约束**：为什么 Shiki 在 sanitize 后；为什么包装器复制文章目录；为什么某些 SVG/CSS 属性必须保留；公式扫描的适用范围；标题 ID 的兼容承诺。
3. **协议与政策**：schemaVersion 升级规则、private/unlisted/draft 矩阵、发布目录的真相来源、缓存失效条件。

推荐注释描述真实约束，例如：“只允许删除带生成标记且通过路径校验的输出目录；校验失败必须在任何删除发生前抛错。”这类注释必须等实现满足后加入，不能用注释提前宣称未实现保证。

现有 architecture/security/math/acceptance 文档结构良好，但 architecture 仍停留于理想流水线；security 的 assets 约束与符号链接行为不一致；配置示例包含未兑现选项。建议增加少量 ADR：构建期架构与信任模型、整站提交、公式验证依据、包分发策略。每条记录背景、选择、代价、复核触发条件。

中英文文档同次修改更新行为说明；配置表从 schema 元数据派生，并为示例运行 smoke test。不要以注释数量、文档页数或“所有函数必须注释”作为质量目标。

## 8. 测试、发布与运维

### 测试策略

现有 build 测试的编译器替身有效隔离了昂贵边界，adapter 测试覆盖常见净化和数学情形。当前不足在于测试主要证明首次成功构建，尚未覆盖真实生命周期。

建议按风险补齐：

- P0/P1 的状态变更、路径边界和失败注入首先成为回归测试。
- 保留纯函数单元测试；增加磁盘产物 schema 契约测试与真实 Typst 小型集成 fixture。
- 为 AST 变换加入性质测试：最终 ID 唯一、内部锚点可解析、URL 符合协议策略、净化不引入不允许节点；避免用源码字符串是否存在代替行为验证。
- CI 增加 Astro 组件检查；当前 tsc include 不包含 .astro，astro build 也不负责类型检查，官方建议独立运行 astro check：[Astro TypeScript 文档](https://docs.astro.build/en/guides/typescript/)。
- 浏览器测试覆盖目录、旁注、复制、灯箱、长公式和移动端。使用有代表性的页面做 Chromium/Firefox/WebKit 验证；截图差异需固定字体和环境。
- PDF 的字体/页数验证目前在 Pages 流程而非 PR 的普通集成流程，应把发布关键检查前移，并为版式保留人工验收。

先定义关键风险必须覆盖，不追求无依据的整体覆盖率门槛。可采集分支覆盖作为遗漏线索，不将高覆盖率当成无缺陷证明。

### 包边界与分发

六个包的 package.json 均没有声明自身依赖，集中依赖根 package.json；多个包直接 exports 源 .ts；CLI bin 指向 TypeScript 并依赖工作区解析；package 没有独立构建脚本。根 build 主要递归执行示例 build，不能证明库包构建或发布成功。

如果只维护克隆运行的模板，应明确这一支持模式，并把内部包标 private。如果目标是给别人安装使用，需补每包 dependencies/workspace 依赖、编译后的 JS/声明文件、正确 bin、files、engines 及 Typst prelude/CSS 打包清单。外部消费失败当前属于静态可见风险，本次未实际 pack/install 验证，不应描述为已经复现的安装错误。

分发验收必须在工作区外安装打包产物，直接运行 CLI、导入公开 API、生成 HTML/PDF；不能依赖 monorepo 的 tsconfig alias 或根 node_modules。

### 兼容与交付

CI 已有冻结 lockfile、Typst 固定版本、两种数学路径、Pages 部署并发控制，这是有效基础。建议建立“已验证支持范围”和“未经验证的新版本”区分；现有版本判断接受所有 0.15 之后乃至 1.x，但不能据此声称全部兼容。

编译器下载校验、统一 CI/Pages 的 Node/Typst/字体版本、发布前同一套验收，是后续交付保障。此处不包含依赖漏洞扫描结论，也不建议无理由批量升级依赖。

## 9. 性能与可复现构建

目前文章串行编译，HTML/PDF wrapper 可能分别复制文章目录；同一图片多次出现时 pending 任务没有按 source 合并；示例每篇查找会重复读解析索引。小样例可接受，大站成本尚未实测。

先测冷/热构建、单篇改动、100 篇与 1000 篇、资源密集和公式密集场景，记录耗时分布、峰值内存、进程数、复制字节数和产物大小。然后按测量结果加有上限的并发和进程内索引缓存。不要直接对全部文章 Promise.all。

当前 sourceHash 只覆盖主 .typ，metadataHash 只覆盖 YAML；它们是来源标记，不足以作为缓存键。未来缓存至少纳入依赖 .typ、图片/Bib、相关配置、Typst/生成器/prelude 版本、字体和环境影响。先可用整个受控文章目录指纹换取简单正确，之后再按编译依赖精细化。

当前没有实际缓存，所以尚无“缓存失效错误”；问题是 cache.enabled 的承诺和未来实现风险。createdAt 会导致 manifest 每次不同，应区分语义可复现与逐字节可复现，而不是要求所有时间戳消失。

## 10. 渐进实施计划

| 阶段                      | 目标与范围                                                          | 完成标准                                                      |
| ------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------- |
| A：保护用户数据与发布边界 | F01/F02/F05/F06；发布清单、clean 校验、净化与资源边界               | 危险路径不删除；状态转移不导出旧文件；边界绕过回归通过        |
| B：保证结果一致且可解释   | F03/F04/F07/F08；结构化错误、配置矩阵、产物验证                     | 故障注入无混合版本；配置均兑现；合法注释不误报；锚点全部有效  |
| C：整理架构与交付契约     | 最小 adapter 输入、HAST 类型、Astro API、API 注释/ADR、选择分发模式 | 单向依赖可检查；产物读取校验；声明的使用方式在独立环境通过    |
| D：完善使用体验           | new/preview/watch、发布政策、错误摘要、搜索 UI、浏览器/PDF 验收     | 新用户按文档完成端到端流程；目标浏览器和键盘操作验收通过      |
| E：以数据优化性能         | 基准、缓存键、有限并发、增量构建                                    | 约定数据规模下达成先制定的时间/内存预算；热构建与全量结果等价 |

每阶段拆成可独立审查的变更：先增加暴露缺陷的行为测试，再修复相应边界，更新受影响文档和契约，运行匹配风险的验证。跨阶段可并行处理不冲突的小改动，但不得用性能优化绕过前面的正确性条件。

不估算日历工期：目前没有团队规模、目标支持平台和站点规模约束。可以先按上述完成标准建立 issue/milestone，再估工。

“工程可用”的最低门槛是 A/B 完成，受支持环境明确，核心流程及关键发布检查自动化；“可独立复用”还要求 C 的外部消费验证；“好用”需要 D 的真实用户流程验证；大规模使用则要求 E 的测量证据。架构评估提供演进路线，最终保证来自逐项验收和持续回归。
