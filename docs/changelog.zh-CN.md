# 更新日志

[English](changelog.md)

开发历程与里程碑。

| 提交 | 里程碑 |
|------|--------|
| `8dd0dc5` | **初始提交** — 核心架构：Agent、AgenticLoop、ToolRegistry、9 个工具、React 界面 |
| `e911ba9` | Ollama 本地 LLM 支持（无需 API Key） |
| `0571246` | 仓库重组 + 代码质量改进（共享组件、类型安全、i18n 修复） |
| `7088d54` | 新增技能：decision / security / perf |
| `d79391e` | ZPower 五行技能体系（7 个技能） |
| `bf9c883` | `/auto on` 权限策略联动 |
| `0c3358b` | 工具参数校验 + AgenticLoop 重复失败检测 |
| `381a87b` | 修复 /auto 模式权限同步（根因：权限等级未注入） |
| `f932ea5` | jetbot.md 灵魂文件（混合加载：编译默认 + VirtualFS 可编辑） |
| `8cce74b` | 文件桥接：VirtualFS 与真实文件系统双向传输（拖拽导入 + 下载导出） |
| `bc7e340` | `/export` 命令：快速下载 VirtualFS 文件 |
| `f75bc02` | 重写 jetbot.md，深度感知运行环境与约束 |
| `8d3841a` | 两个展示 Demo：SaaS 仪表盘 + 番茄钟 |
| `ac741c2` | 修复布局：DropZone 不再破坏 Chat/Preview 分栏 |
| `09d5479` | **宇宙视图** — 力引导画布、跨轮次连线、断链切换 |
| `c340dc7` | 权限对话框美化、默认 Ollama 模型更新、局域网开发服务器 |
| `cda1898` | 文档重组：精简 README + 拆分 docs/ 子目录 |
| `f3ff305` | GitHub Pages 部署工作流（CI 构建 + 发布到 gh-pages） |
| `1053fde` | Cosmos 节点详情卡片渲染 markdown |
| `ef307ce` | 智谱（GLM）服务商支持，标签按 locale 切换 |
| `c4766d9` | **IndexedDB 持久化层** — 统一 `lib/db.ts` 封装，版本化 store 创建 |
| `f737fb6` | **SessionStore / SessionIndex / MemoryStore / SkillDistiller** — Agent 获得长期记忆 |
| `243c2b3` | 技能生命周期：质量评分、使用次数、阶段追踪、IndexedDB 持久化 |
| `86721aa` | DistillCard UI + SystemPromptBuilder 注入 memory/recall 段 |
| `4407664` | Agent 端到端整合 SessionStore + MemoryStore + SkillDistiller |
| `b9dd8a7` | **Skills Panel** — 生命周期可视化、粘贴导入、`/skill status` |
| `5a03567` | `/skill export`、`/clear` 自动归档会话、整合收尾 |
| `e0659ec` | IndexedDB 初始化加固（重试循环、版本递增、store 存在性检查） |
| `86be80d` | 流式崩溃兜底——response.body null 守卫 |
| `6e484ee` | 自动把 CORS proxyUrl 默认为当前 origin |
| `05970da` | 防止空 assistant 消息污染上下文 |
| `fdd3caa` | **Cosmos 体验** — 八向缩放的 NodeCard、每边均匀粒子 |
| `1a01c24` | **Cosmos 融合** — memory & skill 节点种类、`derives` 边、Agent 状态全貌 |
| `425ec5d` | dev `/proxy` 中间件镜像 Cloudflare Worker，dev 期 LLM 调用不再 404 |
