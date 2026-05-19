# CR-002: 暂停 / 穿透模式可见化

- 状态：Done
- 负责人：tedxiong
- 创建日期：2026-05-18
- 完成日期：2026-05-18
- 依赖：CR-000

## 1. 背景与目标

当前 ClickAsk 开启后，所有点击都被 capture 阶段劫持，用户想"先滚动到某区域 / 展开折叠 tab / 点开链接再选"时，必须先按空格暂停。
但"按空格暂停"只在 `.ca-shortcuts` 一行小字里提示，发现率低。

目标：

- 状态指示点变成显式按钮，点击即切换暂停（与空格键等价）
- 提供"Alt + 任意操作"= 临时穿透：按住 Alt 时，宿主页点击/拖拽完全不被 ClickAsk 拦截，松开 Alt 立即恢复选取
- 在 shortcuts 文案中明确这两条

不做：

- 不引入"独立穿透按钮"——用 Alt 做临时穿透比"开关"更符合直觉
- 不改变现有空格键暂停的行为

## 2. 变更点

- [x] `assets/clickask.js`
  - i18n 新增 `togglePauseTitle` / `passthroughHint`
  - shortcuts 文案追加 Alt 穿透说明
  - `createPanel` 中把 `.ca-status` 由 `div` 改成 `<button type="button" class="ca-status">`，带 `aria-pressed`
  - 状态按钮点击 → 调用现有 `togglePaused()`
  - `togglePaused` 末尾同步刷新按钮 `aria-pressed`
  - `handleMouseDown` / `handleClick` / `handleMouseMove` 在 `event.altKey === true` 时直接 `return`（不 preventDefault、不 stopPropagation、不更新 hover）
- [x] `assets/clickask.css`
  - `.ca-status` 由文本块改为按钮态（去掉 default padding，加 cursor/hover）

## 3. 影响范围

- 行为变化：按下 Alt 后，宿主页所有事件可正常通行；松开后自动恢复
- 性能：无（仅多 1 个分支判断）
- 兼容性：Alt 在 Windows/Linux 上常用作菜单激活键，但 ClickAsk 期间用户已聚焦在页面区域，不会触发系统菜单
- 不影响：buildPrompt、AI 启动按钮、复制行为、选区数据

## 4. 验收标准

1. `.ca-status` 元素是 `<button>` 且 `aria-pressed` 反映 paused 状态
2. 点击 `.ca-status`：paused 切换、按钮文字从 `Ready/就绪` 切到 `Paused/已暂停`
3. 按住 Alt 点击 body 元素：不会新增 `.ca-tag`、不会出现 `.ca-sel-box`
4. 松开 Alt 后正常点击：选区行为恢复
5. shortcuts 文案包含 "Alt" 字样
6. `npm test` 全部通过

## 5. 测试用例

### 5.1 自动用例（vitest）

`tests/unit/cr002-pause-passthrough.test.js`：

- 加载后 `.ca-status` 是 `BUTTON` 标签
- `aria-pressed` 初始为 `"false"`，点击后变 `"true"`，再点击变回 `"false"`
- `altKey:true` 的 click 事件不会创建 `.ca-tag`
- 普通 click 事件创建 `.ca-tag` （回归保护）
- shortcuts 文本包含 "Alt" 关键字

### 5.2 手动用例（`tests/manual/CR-002.md`）

| # | 步骤 | 预期 |
|---|------|------|
| 1 | demo.html 打开 ClickAsk，点击状态指示器（带圆点的"就绪"） | 圆点变灰，状态文字变成"已暂停" |
| 2 | 再点一次 | 恢复"就绪"，圆点呼吸动画恢复 |
| 3 | 按住 Alt，点击 demo 中的 `Retry sync` 按钮 | 不会被 ClickAsk 拦截选中，按钮的 onclick 正常触发（看 console） |
| 4 | 松开 Alt 后再点击 | 选区交互恢复正常 |
| 5 | 按住 Alt 滚动 | 滚动正常，hover-box 隐藏 |

## 6. 回归校验

- [x] `node --check assets/clickask.js`
- [x] `npm test`
- [x] CR-000、CR-001 测试不变

## 7. 实施记录

- `togglePaused` 中已有的视觉刷新（status-label / status-dot 加类）保留，新增 `aria-pressed` 同步
- Alt 穿透选择"放行"而非"暂停"，因为穿透是**暂态**（按住才生效），暂停是**持久态**——保留两种概念便于不同场景
- 已知遗留：在按住 Alt 状态下，ClickAsk 内部 dragState 不会被启动（已通过 mousedown 直接 return 跳过），无遗留
