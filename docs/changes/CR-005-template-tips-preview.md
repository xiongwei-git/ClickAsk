# CR-005: 模板悬浮说明 + Prompt 预览

- 状态：Done
- 负责人：tedxiong
- 创建日期：2026-05-18
- 完成日期：2026-05-18
- 依赖：CR-000

## 1. 背景与目标

当前模板下拉只有一个 label（如「分析原因」「排查问题」），用户难以判断该模板会让 AI 做什么。同时复制后 prompt 是黑盒——必须真打开 ChatGPT 才能看到，发现写错只能再来一遍。

目标：

1. 每个模板配一句简短 tip：把 instructions 浓缩成 ≤ 30 字的"用途说明"
2. select option 上挂 title（鼠标悬浮提示）
3. 当前选中模板的 tip 在面板里以小字显示，让用户随时看到
4. 在面板内增加 `<details>` 折叠的 Prompt 预览，按当前选中元素 + intent + template 实时渲染

不做：

- 不改 buildPrompt 输出格式（预览 = buildPrompt 直接渲染）
- 不引入额外 markdown 渲染库（`<pre>` 显示原始文本即可）

## 2. 变更点

- [x] `assets/clickask.js`
  - `translations.zh.templates.*` / `translations.en.templates.*` 各模板新增 `tip` 字段
  - 新增顶级 i18n key：`previewLabel`、`previewEmpty`
  - createPanel 模板里 `.ca-recommendation` 下追加：
    - `.ca-template-tip`（一行小字，显示当前 effective type 的 tip）
    - `<details class="ca-preview"><summary>...</summary><pre class="ca-preview-body"></pre></details>`
  - 渲染 `<select>` 选项时给每个 option 设置 `title = tip`
  - `updateRecommendation()` 末尾同步刷新 `.ca-template-tip`
  - 新增 `refreshPreview()`：当 selectedElements.length === 0 显示 previewEmpty，否则 `pre.textContent = buildPrompt()`
  - intent textarea 的 input、type select 的 change、`updatePanel` 末尾、`clearSelection` 后都调用 refreshPreview
- [x] `assets/clickask.css`
  - `.ca-template-tip`：12px、灰色、ellipsis、max-height 让它不撑面板
  - `.ca-preview > summary`：去掉默认 marker、加 chevron、可点击
  - `.ca-preview-body`：pre + scroll + 等宽字体 + 最大高度限制

## 3. 影响范围

- 行为变化：面板高度增加 ~36px（tip 一行）+ details 折叠默认收起
- 不影响：buildPrompt 输出、AI 启动、暂停/穿透、id 分配
- i18n：新增字段不破坏现有结构

## 4. 验收标准

1. 打开面板，select 下拉每个 option 都有 title 属性
2. 切换 select 值，`.ca-template-tip` 文本随之更新
3. 选中一个元素 + 输入 intent，展开预览，`.ca-preview-body` 包含 intent 文本
4. 无选中元素时，预览展开后显示 previewEmpty
5. 切换 select 类型，预览首行标题（`# Page Content Summary` 等）跟随切换
6. 现有 18 个测试全部回归通过

## 5. 测试用例

### 5.1 自动用例（vitest）

`tests/unit/cr005-template-tips-preview.test.js`：

- 加载后，所有 template option 都有非空 title 属性
- 改 select.value=`summarize` 触发 change，`.ca-template-tip` 文本与 zh 模板 tip 一致
- click 一个元素 + 把 intent 文本写入 textarea + 触发 input → preview body 包含 intent 文本
- 选中元素 + select.value=`debug` → preview body 第一行包含 zh 模板 debug 的 title
- 无选中元素时 preview body 文本 === previewEmpty

### 5.2 手动用例（`tests/manual/CR-005.md`）

| # | 步骤 | 预期 |
|---|------|------|
| 1 | 打开 demo.html → 启动 ClickAsk → 鼠标悬浮 select 下拉每个选项 | 浏览器原生 tooltip 显示该模板的 tip |
| 2 | 切换"排查问题" | `.ca-template-tip` 随之更新成 zh debug 的 tip |
| 3 | 不选元素，展开"Prompt 预览" | 显示 previewEmpty 文案 |
| 4 | 选中销售表一行 + 输入"为什么数字下降" → 展开预览 | 预览中可见用户输入与选中行文本 |
| 5 | 切换模板为"总结内容" | 预览首行标题切换为"页面内容总结" |

## 6. 回归校验

- [x] `node --check assets/clickask.js`
- [x] `npm test`（含 CR-000/001/002/003）

## 7. 实施记录

- tip 字段长度约束 ≤ 30 字（中文）/ ≤ 60 chars（英），保证一行内可读
- preview 用 `<details>` 而非自实现折叠，零交互成本
- 监听点最少化：input / change / 选中变化 / 清空，覆盖所有用户态变更
