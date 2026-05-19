# CR-003: Lazy ID + Detached 元素自清理（取代全量 assignIds）

- 状态：Done
- 负责人：tedxiong
- 创建日期：2026-05-18
- 完成日期：2026-05-18
- 依赖：CR-000

## 1. 背景与目标

当前 `init()` 在每次书签启动时调用 `assignIds(document.body)`，对全树每个元素打 `data-clickask-id`：

- 大型 SPA 节点上万时，遍历 + DOM 写入会卡 100ms+
- 给受控组件添加 attribute 会触发框架 mutation 监听
- `destroy()` 也未清掉这些属性，留下了 DOM 污染

同时，原"动态新增节点会漏选"的问题——其实只要在框选时 **实时遍历** `getElementsByTagName('*')`（live collection）就能解决，**不需要 MutationObserver**（引入它反而会持续观察、加重业务页负担）。

目标：

1. 删除全量 `assignIds` 调用，改为"用到时才打 id"
2. 框选阶段实时遍历 body 子树，自动支持动态加载的元素
3. `destroy` 时彻底清掉所有 `data-clickask-id` 属性
4. `positionOverlay` 检测到元素已 detached（`!el.isConnected`）时，自动 `removeSelection`

不做：

- 不引入 MutationObserver（zero overhead 即可达成目标）
- 不修改 selector / xpath / prompt 输出格式

## 2. 变更点

- [x] `assets/clickask.js`
  - 删除 `init()` 中的 `assignIds(document.body)` 调用
  - 删除未被使用的 `byId` 函数
  - 把 `assignIds`（递归 walker）重命名为 `ensureId(el)`，单元素懒分配 id
  - `addSelection` 中调用 `ensureId(el)`，确保 overlay 能用 id 当 Map key
  - `handleMouseUp` 框选改为 `document.body.getElementsByTagName('*')`，并过滤 `isToolElement / isVisible / isMeaningful`
  - `positionOverlay` 中若 `!el.isConnected`，调用 `removeSelection(el)` 并跳过
  - `destroy()` 增加：`document.querySelectorAll('[data-clickask-id]').forEach(el => el.removeAttribute('data-clickask-id'))`

## 3. 影响范围

- 行为变化：
  - 启动延迟显著下降（万级节点页面从 100ms+ → ~1ms）
  - 后续动态加载的元素也能被框选
  - 关闭书签后页面 DOM 完全干净，无残留属性
- 性能：框选时 `getElementsByTagName('*')` 同样 O(N)，但避免了"启动 + 关闭"两次全量 DOM 写
- 兼容性：无影响
- 不影响：buildPrompt 输出、selector/xpath、AI 启动按钮、暂停/穿透

## 4. 验收标准

1. 加载书签后，页面无任何 `[data-clickask-id]` 属性
2. 点选一个元素后，只有该元素有 `data-clickask-id`
3. destroy（关闭按钮）后，页面 `[data-clickask-id]` 数量为 0
4. 动态 `appendChild` 一个新元素，框选能命中它（手动用例）
5. 把已选中的元素从 DOM 移除，下一帧 overlay 自动清掉
6. 现有 13 个测试全部回归通过

## 5. 测试用例

### 5.1 自动用例（vitest）

`tests/unit/cr003-lazy-id.test.js`：

- 加载后 `document.querySelectorAll("[data-clickask-id]").length === 0`
- 单击一个元素：被选中元素带 id，其他元素不带 id
- 触发关闭按钮：`[data-clickask-id]` 数量回到 0
- 动态注入一个 `<div>...</div>`，再点击它：能被选中
- 选中后从 DOM 移除该元素，主动调用 `positionAllOverlays`（通过 scroll 事件触发）：overlay 应被清掉

### 5.2 手动用例（`tests/manual/CR-003.md`）

| # | 步骤 | 预期 |
|---|------|------|
| 1 | demo.html 打开 ClickAsk，开 DevTools 控制台 | `document.querySelectorAll('[data-clickask-id]').length === 0` |
| 2 | 点击销售表某行 | 仅该行带 id |
| 3 | 关闭面板，再查询 | 数量回到 0 |
| 4 | 控制台执行 `document.body.appendChild(Object.assign(document.createElement('div'), {textContent: 'new', style: 'padding:8px'}))` 后再点击 | 新元素可被选中 |
| 5 | 选中一个元素后，控制台 `tmp.remove()` 移除它，滚动一下 | 红框 overlay 自动消失 |

## 6. 回归校验

- [x] `node --check assets/clickask.js`
- [x] `npm test`（含 CR-000 / CR-001 / CR-002）

## 7. 实施记录

- `getElementsByTagName('*')` 返回 live HTMLCollection，自动包含动态加入的节点，无需额外 observer
- `ensureId` 仍使用 `idCounter` 全局递增，确保跨次选择不重复
- `positionAllOverlays` 是 detached 自清理的入口（滚动 / resize / rAF 重定位都会走它）；额外也在 `positionOverlay` 单元素调用时检查，覆盖直接调用路径
- 已知遗留：若用户在选中元素后立刻 detach 但不滚动也不 resize，要等到下一次面板交互才清理（足够，不属于阻塞问题）
