# CR-010: i18n 拆分 + 意图关键词按语言分桶

- 状态：Done
- 负责人：Codex
- 创建日期：2026-05-18
- 完成日期：2026-05-18

## 1. 背景与目标

到 CR-009 为止 `assets/clickask.js` 顶部有一个 240+ 行的 `translations`
内联对象（en/zh 各占一半），意图检测器 `intentRules` 把中英关键词混在同一个
`keywords: [...]` 数组里。这带来两个问题：

1. **可维护性差**：增删一条文案得在巨大的对象中间反复定位，PR diff 噪声大。
2. **关键词误判**：英文用户随手输入 "对比"（恰好是 analyze 中文关键词），或中文
   用户输入 "compare"，都会按同等权重命中，无法基于语言上下文做区分。

CR-010 把这两块解耦：
- **拆 i18n**：把 en/zh 字符串提到独立常量 `STRINGS_EN` / `STRINGS_ZH`，再由
  `translations` 组合，便于后续改造或抽出独立模块。
- **关键词分桶**：每条 `intentRule.keywords` 改为 `{ zh: [...], en: [...] }`。
  匹配时当前 locale 用全权重，另一种语言用半权重（向上取整）作为 fallback，
  保证双语用户也能拿到合理推荐，但不再被误打分。

不做的事：
- 不抽外部 i18n JSON / runtime 远程加载（仍是单文件 IIFE）。
- 不改 `t.fields` / 模板正文结构。
- 不改 `getIntentContext` 中基于 DOM 结构的额外加分规则（数字、表格、source）。

## 2. 变更点

- [x] `assets/clickask.js`
  - 把 `const translations = { en: {...}, zh: {...} }` 拆为顶层 `STRINGS_EN`、
    `STRINGS_ZH`，再 `const translations = { en: STRINGS_EN, zh: STRINGS_ZH };`
  - `t.lang = locale;` 让模板 / 后续模块拿到当前语言。
  - `intentRules.<type>.keywords` 改为 `{ zh: [...], en: [...] }`。
  - `detectIntentType` 改为：当前 locale 关键词全权重打分；另一种 locale 关键词
    用 `Math.ceil(weight / 2)` 半权重打分。
- [x] `tests/unit/cr010-i18n-intent.test.js`：7 个用例。
- [x] `tests/manual/CR-010.md`：4 个手动用例。
- [x] `docs/changes/README.md`：把 CR-010 状态置 Done。

## 3. 影响范围

- 行为变化：
  - 双语混合输入时，推荐结果更贴合当前 locale。
  - 仅一种语言关键词时不变。
- 性能：可忽略（关键词总量不变，多了一层 split）。
- 兼容性：纯运行时逻辑改动，无需新 API；Safari / Chrome 一致。
- 不影响：CR-001~CR-009 全部测试通过。

## 4. 验收标准

1. `assets/clickask.js` 顶部声明顺序为 `STRINGS_EN` → `STRINGS_ZH` → `translations`。
2. en/zh 顶层字段集合完全一致（避免漏翻）。
3. 每条 intent rule 都拆出 `zh` 和 `en` 两个非空数组。
4. zh locale 输入纯中文关键词时推荐对应模板；en locale 输入纯英文关键词时同上。
5. en locale 输入只在 zh 桶里出现的关键词（如 "崩溃"），仍能 fallback 到 debug。
6. 所有现有测试（CR-001~CR-009、smoke）依旧通过。

## 5. 测试用例

### 5.1 自动用例（vitest）

`tests/unit/cr010-i18n-intent.test.js`：

1. 源码声明 `STRINGS_EN` / `STRINGS_ZH` / `translations` 三件套。
2. en/zh 顶层字段集合一致，且包含 `templates` / `snapAction` 等关键字段。
3. 每条 intentRule 都按 `{ zh: [...], en: [...] }` 结构拆出双桶。
4. zh locale + 中文输入 "帮我总结一下" → `.ca-recommendation` 文案为「推荐: 总结内容」。
5. en locale + 英文输入 "brief recap" → 文案为 `Recommended: Summarize`。
6. en locale + 中文输入 "崩溃 崩溃" → fallback 半权重仍能识别为 `Recommended: Debug issue`。
7. 切换 locale 后 `.ca-field-label` 文案随之切换。

### 5.2 手动用例

见 `tests/manual/CR-010.md`。

## 6. 回归校验

- [x] `node --check assets/clickask.js`
- [x] `npm test`（10 file / 61 tests，包括 CR-010 的 7 个）
- [x] demo.html 本地手测：英文输入纯英文请求、中文输入纯中文请求、双语混输

## 7. 实施记录

- 用一次大块 search_replace 改掉 `translations` 外层结构，避免多次替换误删换行。
- 在原 `intentRules` 上原地把 `keywords:[...]` 改为 `keywords:{ zh:[...], en:[...] }`，
  分桶时把"异常"保留在 debug、analyze 两个 zh 桶（与原版混合数组保持一致语义）。
- 第一版测试 fixture 文本里有 "Revenue dropped 12% this month." 命中了 analyze 的
  `\d+%` / `drop` 上下文加分规则，导致中文测试断言失败 —— 改用中性 fixture
  "Hello and welcome to the page." 后通过。
- search_replace 中文 `\u8b32` 被错误使用，把"讲一下"写成了"謲一下"，二次替换
  修正为 `\u8bb2`。后续所有含中文字符的批量替换都改用 `\u` 转义形式书写。
