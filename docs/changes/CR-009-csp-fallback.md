# CR-009: CSP 注入兜底与提示

- 状态：Done
- 负责人：Codex Agent
- 创建日期：2026-05-18
- 完成日期：2026-05-18
- 依赖：CR-005（preview 面板用作参考的视觉锚点）

## 1. 背景与目标

bookmarklet 在严格 CSP 站点（GitHub、Twitter、银行类）的运行风险：

- `<style>` inline 注入被 `style-src` 拦截 → 面板无样式 / 错位 / 不可见
- `javascript:` URL 被 `script-src` 拦截 → IIFE 不执行
- 用户拿不到任何反馈，看起来像「书签坏了」

目标：

1. 监听 `securitypolicyviolation`，识别 style/script 类违规，自动进入降级模式
2. 主动检测：requestAnimationFrame 后用 `getComputedStyle(panel).position` 判断样式是否生效，否则也进降级
3. 降级模式：给 panel / hoverBox 打 inline `style.cssText`，至少能用；显示左下角 banner 告知用户
4. install 页 (`index.html`) 增加 FAQ 说明，引导用户在自家页面使用

不做：

- 不绕 CSP（合规）
- 不实现 chrome-extension 替代（超出 bookmarklet 边界）
- 不做 violation 详情面板（一行 banner 已足够）

## 2. 变更点

- [x] `assets/clickask.js`：
  - i18n.zh / i18n.en 增加 `cspWarning` / `cspDismiss`
  - 顶部新增状态：`cspBanner` / `cspDegraded` / `cspViolations`
  - 新增 5 个函数：`handleCspViolation` / `verifyStylesApplied` / `enterDegradedMode` / `applyInlineFallback` / `showCspBanner`
  - `init()` 末尾挂 `securitypolicyviolation` 监听 + rAF 验证回调
  - `destroy()` 清理 banner 与状态
  - banner 节点 className 含 `ca-root`，避免被 `handleClick` 的 capture-stage `stopPropagation` 吞掉 dismiss 点击
- [x] `index.html`：
  - i18n copy 添加 `cspTitle` / `cspBody`
  - 新增 `<section class="grid">` + `<article class="card">` 节点（id=`csp-title` / `csp-body`），并在文案绑定区赋值
- [x] `tests/unit/cr009-csp-fallback.test.js`：7 个用例
- [x] `tests/manual/CR-009.md`：3 条手动用例

## 3. 影响范围

- 行为变化：在严格 CSP 站点会出现一个左下角降级 banner（含「知道了 / Got it」按钮）
- 性能：仅一次 rAF + 1 个事件监听器，零开销
- 兼容性：jsdom（已测）、Safari、Chrome 均支持 `securitypolicyviolation` + `getComputedStyle`
- 不影响：CR-001~008 全部回归通过（47/47 tests）

## 4. 验收标准

1. dispatch `securitypolicyviolation` w/ `style-src` → banner 出现，文案匹配 i18n
2. dispatch w/ `img-src` → banner 不出现
3. dismiss 按钮点击后 banner 消失（不被 capture handler 拦截）
4. 关闭 panel（destroy）时 banner 同时被清理
5. `getComputedStyle(panel).position !== "fixed"` 时 rAF 回调自动进入降级
6. install 页含 `id="csp-title"` / `id="csp-body"`，文案含 "CSP"

## 5. 测试用例

### 5.1 自动用例（vitest）

- `tests/unit/cr009-csp-fallback.test.js`：7 个 case 覆盖上述全部验收点

### 5.2 手动用例

见 `tests/manual/CR-009.md`。

## 6. 回归校验

- [x] `node --check assets/clickask.js`
- [x] `npm test` → 9 文件 / 47 用例全绿
- [ ] 部署后在 GitHub / Twitter 实测降级 banner（生产验证 TODO）

## 7. 实施记录

实际改动：i18n + 5 函数 + init/destroy 接入 + index.html FAQ。

发现一个隐藏 bug：banner 默认不在 `.ca-root` 内，会被 `handleClick`（capture）的 `stopPropagation` 吞掉 dismiss 点击。修复方式是给 banner 加 `ca-root` class（让 `isToolElement(banner)` 返回 true，handleClick 直接 return）。这个 fix 对其他 CR 也是个有用的契约：**所有需要响应 click 的 ClickAsk 自有 UI 元素必须挂在 `.ca-root` 子树内或自身带 `ca-root` class**。

后续 TODO：

- 部署后到 GitHub / Twitter 实地验证（需要真 CSP 头才能触发 violation event）
- 可选：把 `cspViolations` Set 暴露给开发者 console（调试用）
