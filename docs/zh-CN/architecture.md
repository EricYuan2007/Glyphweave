# 架构

Glyphweave 面向受信作者，在构建时把 Typst 转成 HTML、TOC、manifest、索引和可选 PDF。站点运行时不调用编译器。

| 包           | 职责                             | 内部依赖                    |
| ------------ | -------------------------------- | --------------------------- |
| schema       | 输入、产物运行时校验及推导类型   | 无                          |
| typst        | 编译进程、诊断和临时模板         | schema                      |
| html-adapter | HTML/MathML/SVG 归一化和受限资源 | schema、typst               |
| core         | 发现、构建、校验与提交           | schema、typst、html-adapter |
| cli          | 命令与错误展示                   | core、schema、typst、astro  |
| astro        | 索引读取与当前资源导出           | schema                      |

每包有编译后的 JavaScript/类型声明和显式依赖。适配器接收最小文章上下文，不反向引用 core。编译器操作可注入，以便进行失败测试。

构建获取输出锁，在 `generations/<id>/generated/posts/<slug>/` 生成独立版本；全部产物和索引校验成功后原子替换 `content-index.json`。失败保留上一版索引，旧版本保留到显式 clean。消费者必须固定一次索引快照并读取其中路径，不能扫描历史目录。clean 要求安全的项目内路径与归属标记，使用时须停止构建和读取。

published/public 进入页面、列表和搜索；published/unlisted 仅允许直接访问；private、draft、archived 不导出。资源发布只复制当前 manifest 的条目。PDF warn 会保留 HTML、移除本次 PDF 并记录警告。

HTML 使用允许列表净化，再执行受信的代码高亮与控件生成。源公式数量是词法提示，严格模式依据编译器确认的内容丢失失败。原始 HTML 和日志不部署。缓存目前明确禁用；引入增量优化前需建立性能和等价性证据。

参见[迁移说明](migration.md)、[安全模型](security.md)及 [ADR](../decisions/0001-build-and-publication-contract.md)。
