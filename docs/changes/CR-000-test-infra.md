# CR-000: 工程化基建：Vitest + jsdom + CR 模板

- 状态：Done
- 负责人：tedxiong
- 创建日期：2026-05-18
- 完成日期：2026-05-18
- 依赖：无

## 1. 背景与目标

当前项目仅依赖 `node --check` 做语法校验，逻辑回归全靠肉眼。
为了让后续每个 CR 都能携带可执行的测试用例，先一次性引入：

- Vitest 作为测试运行器（零配置、原生 ES Modules、内置 jsdom 环境）
- jsdom 作为 DOM 模拟环境（bookmarklet 本身就跑在浏览器里）
- 一份"加载即烟雾测试"——确保 `clickask.js` 在 jsdom 中能被注入执行、能销毁、不污染全局
- 变更文档模板（`docs/changes/_TEMPLATE.md`）和 CR 索引（`docs/changes/README.md`）

不做：

- 不引入 ESLint / Prettier（拆到独立 CR，避免一次性带入大量风格变更）
- 不重构 `clickask.js` 以暴露内部纯函数（保持互不干扰原则）

## 2. 变更点

- [x] 新增 `package.json`（仅含 devDependencies + 测试脚本，无运行时依赖）
- [x] 新增 `vitest.config.js`（环境 = jsdom）
- [x] 新增 `.gitignore` 中追加 `node_modules/`
- [x] 新增 `tests/unit/smoke.test.js`：加载 `clickask.js` 后断言面板存在、`destroy` 之后 DOM 干净
- [x] 新增 `tests/manual/README.md`：手动测试清单的统一入口
- [x] 新增 `docs/changes/README.md`：CR 索引
- [x] 新增 `docs/changes/_TEMPLATE.md`：变更文档模板

## 3. 影响范围

- 行为变化：无（不修改任何运行时代码）
- 性能：无影响（dev-only 依赖）
- 兼容性：无影响
- 不影响：`assets/clickask.js`、`assets/clickask.css`、`index.html`、`demo.html`、`scripts/deploy.sh`

## 4. 验收标准

1. `npm install` 成功（仅 vitest + jsdom）
2. `npm test` 全部通过
3. `node --check assets/clickask.js` 仍通过
4. `scripts/deploy.sh` 不会上传 `node_modules/`、`tests/`、`vitest.config.js`、`package.json`（部署脚本只拷贝白名单）

## 5. 测试用例

### 5.1 自动用例（vitest）

- `tests/unit/smoke.test.js`
  - **加载注入**：在 jsdom 中执行 `clickask.js`，断言 `document.querySelector('.ca-panel')` 不为空
  - **重复执行幂等**：第二次加载时不会创建第二个面板（早期返回）
  - **销毁干净**：触发关闭按钮后，`.ca-panel`、`.ca-hover-box`、`[data-clickask-id]` 全部移除（部分由后续 CR-003 改进，本用例只检查面板和 hover-box）

### 5.2 手动用例

无（基建 CR，无 UI 变更）。

## 6. 回归校验

- [x] `node --check assets/clickask.js`
- [x] `npm test`
- [x] 部署脚本白名单未变，不会上传新增的 dev 文件

## 7. 实施记录

- 测试方式：将 `clickask.js` 文本读入后用 `new Function(src)()` 在 jsdom 全局执行，等价于浏览器执行 bookmarklet（不污染原始模块作用域）
- 已知遗留：CR-000 只覆盖了 smoke 测试，纯函数（`detectIntentType`、`buildSelector` 等）的单测留到对应 CR 中补全（因为这些函数在 IIFE 内部，不导出；后续 CR 改动这些函数时，按需通过 jsdom 端到端断言其行为）
