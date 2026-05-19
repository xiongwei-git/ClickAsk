# CR-XXX: <标题>

- 状态：Draft / In Progress / Done / Rolled Back
- 负责人：<name>
- 创建日期：YYYY-MM-DD
- 完成日期：YYYY-MM-DD
- 依赖：无 / CR-YYY

## 1. 背景与目标

为什么做、解决什么问题、不做什么。

## 2. 变更点

- [ ] 文件 A：函数 X 改为 ...
- [ ] 文件 B：新增 ...

## 3. 影响范围

- 行为变化：
- 性能：
- 兼容性（Safari / Chrome / 严格 CSP 站点）：
- 不影响：

## 4. 验收标准

1. ...
2. ...

## 5. 测试用例

### 5.1 自动用例（vitest）

- `tests/unit/xxx.test.js`：...

### 5.2 手动用例（`tests/manual/CR-XXX.md`）

| # | 步骤 | 预期 |
|---|------|------|
| 1 | 打开 demo.html，点击书签 | 面板出现在右下角 |

## 6. 回归校验

- [ ] `node --check assets/clickask.js`
- [ ] `npm test`
- [ ] 在 demo.html 完成核心闭环

## 7. 实施记录

执行完成后填写：实际改动 / 遗留 / 后续 TODO。
