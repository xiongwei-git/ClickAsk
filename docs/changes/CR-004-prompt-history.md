# CR-004: 最近 5 条 prompt 历史（localStorage）

- 状态：Done
- 负责人：tedxiong
- 创建日期：2026-05-18
- 完成日期：2026-05-18
- 依赖：CR-000

## 1. 背景与目标

每次用 ClickAsk 都要重新输入"我想问什么"，遇到反复问同类问题（每天看同一张报表）非常浪费。

目标：把最近 5 条用户**原始需求 + 模板类型**保存到 localStorage，下次再用时一键回填。

为什么不存完整 prompt：
- 完整 prompt 含页面 URL / 标题 / 选中元素 HTML / selector，**复用价值低且涉及隐私**
- 用户真正需要复用的是「我想问什么 + 用什么角度问」——textarea 文本 + 模板 select

## 2. 变更点

- [x] `assets/clickask.js`
  - 新增常量 `HISTORY_KEY = "clickask:prompt-history"`、`HISTORY_LIMIT = 5`
  - 新增 i18n key：`historyLabel` / `historyEmpty` / `historyRestore`
  - 新增工具函数：`loadHistory()` / `saveHistory(intent, type)` / `clearHistoryAt(index)` / `restoreHistory(index)`
    - localStorage 不可用（iframe 同源失败 / 隐私模式）时静默 try-catch
    - 入栈去重：完全相同的 (intent, type) 不重复写入，仅置顶
  - createPanel 模板里 `.ca-preview` 之后追加 `.ca-history` 区块（一个标题 + 一行 chip 列表 + 空态文字）
  - `copyPrompt()` 末尾：取当前 intent 文本 + effective type，调用 saveHistory，再 renderHistory
  - `launchAiTool()` 同样调用 saveHistory（保持入口对称）
  - 新增 `renderHistory()`：从 localStorage 读取，渲染每条为 chip（截断 intent + 模板 label + 删除按钮）
  - 点击 chip 主体 → 把 intent 写回 textarea + select 设到对应 type → `updateRecommendation()` 联动预览
  - 点击 × → clearHistoryAt + renderHistory
  - createPanel 末尾调用 renderHistory 进行首次渲染
- [x] `assets/clickask.css`
  - `.ca-history` / `.ca-history-label` / `.ca-history-row`：与 `.ca-launch` 同级风格
  - `.ca-history-chip`：可点击，显示截断 intent + 浅色模板标签 + 右侧删除 ×
  - `.ca-history-empty`：灰字提示

## 3. 影响范围

- 行为变化：复制 / 启动 AI 工具时会写一条 localStorage（域名级，~ 一行 JSON）
- 不影响：buildPrompt 输出、AI 启动、暂停/穿透、id 分配、预览面板
- 兼容性：localStorage 异常时整个 history 模块降级为 no-op（不报错、UI 显示空态）
- 隐私：仅持久化用户输入与模板 id，不存 URL、selector、HTML

## 4. 验收标准

1. 全新载入时 `.ca-history-row` 显示 historyEmpty 文案
2. 输入 intent + 选元素 + 复制 → 出现 1 个 chip，文本含 intent 截断
3. 同样的 (intent, type) 再复制一次，仍只有 1 条且置顶
4. 复制 6 次不同的 intent，只保留最新 5 条
5. 点击某 chip → textarea 文本 = 该 intent，select.value = 该 type，预览刷新
6. 点击 chip 的 × → 该条从 UI 和 localStorage 移除
7. 现有 23 个测试全部回归通过

## 5. 测试用例

### 5.1 自动用例（vitest）

`tests/unit/cr004-prompt-history.test.js`：

1. 加载后 `.ca-history-empty` 可见、`.ca-history-chip` 数量为 0
2. 选元素 + 写 intent + 点复制按钮 → `.ca-history-chip` 数量为 1，localStorage 中 array.length === 1
3. 重复写入相同 (intent, type)：localStorage array.length 仍为 1
4. 写入 6 条不同 intent：localStorage array.length === 5，最新一条排第一
5. 点击 chip 主体：textarea.value === 该条 intent；select.value === 该条 type
6. 点击 chip 的 × 按钮：该条从 localStorage 与 UI 移除

### 5.2 手动用例（`tests/manual/CR-004.md`）

| # | 步骤 | 预期 |
|---|------|------|
| 1 | demo.html 启动 ClickAsk，初次打开 | 历史区显示 historyEmpty |
| 2 | 选中一行 + 输入"为什么数字下降" + 复制 | 历史区出现一条 chip |
| 3 | 关闭面板再启动 | chip 仍在（持久化） |
| 4 | 点击 chip | textarea 与模板 select 自动填回 |
| 5 | 复制 6 次不同 intent | 仅留最新 5 条 |
| 6 | 点击 chip 的 × | 该条消失 |

## 6. 回归校验

- [x] `node --check assets/clickask.js`
- [x] `npm test`（含 CR-000/001/002/003/005）

## 7. 实施记录

- 选择 localStorage 而非 sessionStorage：跨标签页持久化，刚需
- 不存 URL：避免跨站串扰、压缩存储成本、避免 PII 落盘
- 去重策略：完全相同 (intent, type) 才合并，不模糊匹配，避免误覆盖
- chip 文本截断 ≤ 24 字（中文）/ ≤ 40 chars，超出 ellipsis；title 显示完整 intent 便于回看
