# CR-001: 复制后"打开 AI 工具"快捷入口

- 状态：Done
- 负责人：tedxiong
- 创建日期：2026-05-18
- 完成日期：2026-05-18
- 依赖：CR-000（测试基建）

## 1. 背景与目标

当前用户复制完 prompt 后，还要自己切到 ChatGPT / Claude / Gemini / Kimi / 豆包，
打开新对话，粘贴。这一步是高频且无差异化的体力活。

目标：让用户在 ClickAsk 面板里选好 AI 后一键完成"复制 + 打开新标签页"，
打开后用户只需 ⌘V 粘贴。

不做：

- 不做 AI 工具自定义配置（先固化 5 个主流）
- 不做"打开后自动粘贴"——浏览器安全策略不允许跨站脚本注入
- 不收集 / 记录用户选择了哪个工具

## 2. 变更点

- [x] `assets/clickask.js`
  - 新增常量 `AI_TOOLS`（5 个工具的 id / label / url）
  - 新增 i18n 字段：`aiLaunchLabel` / `aiLaunchHint`（zh + en）
  - `createPanel` 末尾追加 `.ca-launch` 区块（标签 + 按钮组）
  - 新增 `renderLaunchButtons()` 和 `launchAiTool(toolId)` 函数
  - `updatePanel` 中根据 `selectedElements.length` 启用/禁用按钮
- [x] `assets/clickask.css`
  - 新增 `.ca-launch` / `.ca-launch-label` / `.ca-launch-row` / `.ca-launch-btn` 样式

## 3. 影响范围

- 行为变化：面板高度增加约 60px；旧用户首次看到不会感到困惑（按钮组带语义标题）
- 性能：可忽略（5 个按钮，无监听爆炸）
- 兼容性：`window.open` 在严格弹窗拦截的浏览器可能被拦——已加 `noopener,noreferrer` 提示用户用户行为驱动
- 不影响：`buildPrompt` 输出格式、`copyPrompt` 主流程、键盘快捷键

## 4. 验收标准

1. 未选中元素时，5 个 AI 按钮处于 disabled 状态
2. 选中至少一个元素后，5 个按钮变为可点击
3. 点击任一按钮：剪贴板被写入（与"复制 Prompt"完全一致的内容） + 新标签页打开对应 AI URL
4. 中文 UA 显示"在 AI 中打开"，英文 UA 显示"Open in AI tool"
5. `npm test` 全部通过；`node --check` 通过

## 5. 测试用例

### 5.1 自动用例（vitest）

`tests/unit/cr001-ai-launch.test.js`：

- 加载后断言 5 个 `.ca-launch-btn[data-ca-tool=...]` 存在且 disabled
- 模拟点击 body 内某元素 → 按钮变为可用
- mock `navigator.clipboard.writeText` + spy `window.open`，点击 ChatGPT chip：
  - `writeText` 被调用且内容包含 `# Page Context Question` 或本地化标题
  - `window.open` 被调用且第一个参数为 `https://chat.openai.com/`，第三个参数包含 `noopener`

### 5.2 手动用例（`tests/manual/CR-001.md`）

| # | 步骤 | 预期 |
|---|------|------|
| 1 | demo.html 中点击销售表的某一行 | 面板出现该行的 tag，5 个 AI 按钮变亮 |
| 2 | 点击 `ChatGPT` 按钮 | 浏览器新开 chat.openai.com，剪贴板中已是 prompt |
| 3 | 在 ChatGPT 输入框 ⌘V | 完整的 Markdown prompt 被粘贴出来 |
| 4 | 不选元素时点击按钮 | 按钮无响应（disabled），不会打开新标签 |
| 5 | 在 Safari 切换中文系统语言 | 标题显示"在 AI 中打开" |

## 6. 回归校验

- [x] `node --check assets/clickask.js`
- [x] `npm test`
- [x] CR-000 的 smoke 测试仍通过（未破坏面板加载/销毁）

## 7. 实施记录

- 按钮组使用 chip 形式（圆角胶囊），与现有米色主题一致
- `window.open` 的第三参数显式带 `noopener,noreferrer`，防止打开的 AI 站点反向操作我们的页面
- `豆包` 文案在中英两个版本都保留中文品牌名（产品官方名）
- 已知遗留：弹窗拦截器拦截 `window.open` 时仅在 console 报错——计划留到 CR-009（CSP 兜底提示）一起处理
