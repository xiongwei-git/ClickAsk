# ClickAsk 变更（CR）索引

每一项优化都以独立的 CR（Change Request）交付，互不干扰。

## CR 列表

| 编号 | 标题 | 状态 | 创建日期 | 完成日期 |
|---|---|---|---|---|
| CR-000 | 工程化基建：Vitest + jsdom + CR 模板 | Done | 2026-05-18 | 2026-05-18 |
| CR-001 | 复制后"打开 AI 工具"快捷入口 | Done | 2026-05-18 | 2026-05-18 |
| CR-002 | 暂停 / 穿透模式可见化 | Done | 2026-05-18 | 2026-05-18 |
| CR-003 | Lazy ID + Detached 元素自清理（取代全量 assignIds） | Done | 2026-05-18 | 2026-05-18 |
| CR-004 | 最近 5 条 prompt 历史（localStorage） | Done | 2026-05-18 | 2026-05-18 |
| CR-005 | 模板悬浮说明 + Prompt 预览 | Done | 2026-05-18 | 2026-05-18 |
| CR-006 | 部署 cache-busting：JS/CSS hash + manifest | Done | 2026-05-18 | 2026-05-18 |
| CR-007 | 元素截图（html2canvas 按需加载） | Done | 2026-05-18 | 2026-05-18 |
| CR-008 | Shadow DOM 支持 | Done | 2026-05-18 | 2026-05-18 |
| CR-009 | CSP 注入兜底与提示 | Done | 2026-05-18 | 2026-05-18 |
| CR-010 | i18n 拆分 + 意图关键词分桶 | Done | 2026-05-18 | 2026-05-18 |

## 工作流约定

每个 CR 必须包含：

1. 变更文档（按 `_TEMPLATE.md` 填写）
2. 代码改动（仅触达本 CR 范围）
3. 测试用例（单测优先，DOM 交互走手动用例）
4. 回归校验：`node --check assets/clickask.js` + `npm test` + demo.html 闭环

## 命名

- 变更文档：`CR-XXX-<slug>.md`
- 单测：`tests/unit/<feature>.test.js`
- 手动用例：`tests/manual/CR-XXX.md`

## 状态

- `Pending`：尚未开始
- `In Progress`：正在执行
- `Done`：代码 + 测试 + 文档全部交付
- `Rolled Back`：已回滚（变更文档保留）
