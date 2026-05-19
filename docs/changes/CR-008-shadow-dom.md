# CR-008: Shadow DOM 支持

- 状态：Done
- 负责人：tedxiong
- 创建日期：2026-05-18
- 完成日期：2026-05-18
- 依赖：CR-003（Lazy ID）

## 1. 背景与目标

ClickAsk 之前完全没有处理 shadow DOM：grep `shadow` / `composedPath` / `getRootNode` 全 0 命中。后果：

- 用户点 `<my-card>` 内部元素，浏览器把事件 target 重定向到宿主 `<my-card>`，prompt 描述就错位
- selector 只走 `parentElement`，遇到 shadow root 直接断链，AI 拿到的 selector 在浏览器里 `document.querySelector` 不出来
- 框选只遍历 light DOM，shadow tree 里的节点选不到
- React/Lit/Stencil/Web Components 页面整体可用性差

目标：让选择、定位、prompt 上下文都能正确穿越 open shadow root。closed shadow root 无能为力（无 API），降级为 host 视角即可，不报错。

不做：

- 暴力突破 closed shadow root（无合规 API）
- iframe 跨域 / 同源递归（独立 CR）

## 2. 变更点

- [x] `assets/clickask.js`：新增 4 个 helper（约 60 行）
  - `getEventTarget(event)`：用 `composedPath()[0]` 拿到 shadow 内真实节点，fallback 到 `event.target`
  - `parentAcrossShadow(node)`：跨 shadow boundary 上探，`parentElement || getRootNode().host`
  - `getShadowHostChain(el)`：返回 host 链（可能 0~N 层嵌套）
  - `walkAllElements(root, cb)`：DFS 遍历 light + shadow 全部子树
- [x] 接入点：
  - 5 个事件 handler（mousemove / mousedown / mouseup 框选 / click / keydown）改用 `getEventTarget`
  - `resolveTarget` 改用 `parentAcrossShadow` 上探
  - `handleMouseUp` 框选额外用 `walkAllElements` 扫描 shadow tree
  - `destroy` 清理 shadow tree 内残留的 `data-ai-id`
- [x] 输出格式：
  - `buildSelector` 跨 shadow 时按 host 边界分段，用 ` >>> ` 连接（如 `my-card >>> div > .title`）
  - `buildXPath` 跨 shadow 时分段用 ` ::shadow ` 连接
  - `buildElementContext` 元素位于 shadow tree 时新增字段 `shadowPath`：`my-card > inner-card ::shadow`

## 3. 影响范围

- 性能：`walkAllElements` 在 mouseup 框选时多走一次。绝大多数页面 shadow tree 节点 << light DOM 总量，可忽略
- 输出：light DOM 元素的 selector / xpath 行为与之前**完全一致**（无 shadow chain 时走原路径），只有 shadow 元素才出 `>>>` / `::shadow`
- 不影响：CR-001~007 现有测试

## 4. 验收标准

1. open shadow root 内点击 → 选中节点是 shadow 内的真实元素，不是 host
2. shadow 内元素的 `selector` 含 `>>>`，`xpath` 含 `::shadow`
3. shadow 内元素 element context 含 `shadowPath` 字段
4. 嵌套 shadow（host A → host B → div）路径包含两层 boundary
5. 框选可命中 shadow tree 内的元素
6. light DOM 元素的输出与 CR-007 之前完全相同（回归）
7. `npm test` 全绿（CR-000~006 + CR-008）

## 5. 测试用例

### 5.1 自动用例（`tests/unit/cr008-shadow-dom.test.js`）

- composedPath 修正：dispatch click 携带 shadow 内 target，最终选中 shadow 内 element
- selector 包含 ` >>> `
- xpath 包含 ` ::shadow `
- buildElementContext 输出含 `shadowPath`
- 嵌套 shadow → path 含两段
- light DOM 元素回归：selector / xpath 不含 shadow 标记

### 5.2 手动用例 `tests/manual/CR-008.md`

- 在 demo.html 加临时 `<my-card>` web component 验证 hover/click
- 验证 closed shadow root 不报错（仅 host 维度）
- 验证 selector 在 DevTools 用 `document.querySelector` 拷贝段无法直接定位（预期，因 `>>>` 非标准），但 `shadowPath` 字段可读

## 6. 回归校验

- [x] `node --check assets/clickask.js`
- [x] `npm test`

## 7. 实施记录

- composedPath 是规范方法（DOM Living Standard），所有现代浏览器支持。jsdom 也支持
- closed shadow root 检测策略：`element.shadowRoot` 为 null 即可能是 closed 也可能根本没有，无法可靠区分；不做特别提示
- ` >>> ` 是历史 deep combinator，已废弃但作为可读标记最直观；`::shadow` 也曾是伪元素
- xpath 在 shadow 内本就没有标准，`::shadow` 仅作可读分隔
