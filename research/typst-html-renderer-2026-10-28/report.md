# Typst 原生 HTML 公式后端：实现与验证

日期：2026-10-28。项目：Glyphweave。新后端为可选 `html-frame`，现有默认后端保持不变。实现前的设计见 [plan.md](plan.md)，使用与协议见 [使用文档](../../docs/native-math-renderer.md)。

## 实现决策

直接使用 Typst 0.15.1 的文档求值、字体 MATH 参数与数学布局。原生桥接器在 SVG 编码之前读取 HtmlDocument 中公式的 Frame，输出字形轮廓、位置、尺寸、基线和线条。HTML 层将轮廓制成文章级 OpenType 子集字体，以 CSS 表达既有坐标。宏、导入与上下文在整篇文档中求值，未通过正则提取公式。

MathJax/KaTeX 的盒模型、字体度量和基线处理只作为研究参考，没有成为依赖，也没有代替 Typst 计算布局。新公式可视层无 SVG、MathML、Canvas 或客户端排版脚本。非公式 html.frame 仍使用 Typst 原有导出路径。

测试中发现 CoreText 在字体 descent 为零时会使用字形包围盒改变基线。最终采用覆盖所有字形的对称非零 ascent/descent，并从 line-height 推导字形容器的位置，消除了浏览器特定的像素修正。

## 验证结果

- 50 个开发公式：822 个字形实例（New Computer Modern Math 与宋体），覆盖分式、分段、多行、矩阵、伸缩括号、根式、重音和行内公式。
- Chromium、Firefox、WebKit，分别检查 1100 与 390 CSS 像素视口，共 4932 次字形位置/基线检查。最大坐标、基线、容器尺寸误差均低于 0.016 CSS 像素；回归门槛为 0.05。
- 三引擎资源检查无加载错误。50 组 HTML 与 Typst SVG 对照逐组检查；对照用 SVG 仅为验证基准。不同字形光栅化器仍可能产生笔画粗细和抗锯齿差异。
- 另有 8 个原生编译压力样例，包含宏、上划线、编号引用、中文条件、深层嵌套、颜色和固定日期；这些不计入上面的浏览器测量数量。
- 集成验证：首次编译、再次命中缓存、CSS/字体/字体许可信息导出成功；不支持的变换公式明确失败，保留上次发布索引。
- 单元测试：14 个文件、77 项通过。TypeScript 类型检查、ESLint、Rust clippy（警告视为错误）通过。独立打包安装检查通过；Rust release 构建成功。

坐标测量证明 HTML 保留了 Typst 的布局，不等于像素完全一致或所有公式审美均已得到独立验证。该样例集参与开发，属于回归语料，不是盲测。

## 查看与复现

- [50 组并排对照](comparison.html)：左侧新 HTML，右侧 Typst SVG。
- [纯 HTML 画廊](gallery.html)
- [几何测量](geometry.json)、[浏览器检查](browser.json)、[集成结果](integration.json)、[压力样例结果](stress-result.json)

在项目根目录运行 `pnpm test:native`。需要 Rust、Typst 0.15.1、Node 22、pnpm 及 Playwright 的三个浏览器。运行 `pnpm build:native` 生成 release 原生程序。版本与依赖由 Cargo.lock 和 pnpm-lock.yaml 固定。

## 边界

这是首版可选后端。变换/裁剪、渐变、公式内图片或链接、任意曲线描边等未支持绘图会明确报错，不静默丢弃或切换其他渲染器。无障碍层现已使用 Typst 输出的结构化 MathML，仍未进行 VoiceOver/NVDA/JAWS 人工朗读验收。字体加载失败的用户界面、原始 Typst 复制及自动公式换行尚未实现。验证环境为本机 macOS；其他操作系统、可变字体等没有得到同等覆盖。

字体许可信息保留在导出资源中，嵌入权限位检查不能代替许可证审查。本次未更改 InkStack 的供应商副本、默认后端或线上部署。

## 字体调整复验

最终保留原来的 New Computer Modern Math 数学字形和伸缩括号，只把中文从 Hei 改为 Songti SC。STIX Two Math 曾完成验证，但用户认为其大括号样式不如原字体，因此不采用。当前对照页与 geometry.json 已更新为最终字体的 822 字形结果。

字形行高设为零，消除 Chromium 对奇数像素字号半像素基线的取整偏差；该修复保留。最终字体重新通过三引擎两种宽度的全部坐标检查，最大误差仍低于 0.016 CSS 像素。InkStack 重建通过（48 个页面、2 个 PDF）。

## 数学无障碍补全

协议 v2 在同一次文档求值中保留 Typst MathML 结构与作者 alt、语言；可视字形保持不变，辅助技术只看到语义层。50 个公式在 Chromium 无障碍树中各出现一次，可见分数、根式、上下标、矩阵结构，没有私有字形编码泄漏。另 6 个样例验证宏参数、中文说明、语言、两条连续公式编号与引用。三浏览器 DOM 检查通过。复现：`pnpm test:native`。这不是跨屏幕阅读器人工认证。
