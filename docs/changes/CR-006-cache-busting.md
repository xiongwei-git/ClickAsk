# CR-006: 部署 cache-busting

- 状态：Done
- 负责人：tedxiong
- 创建日期：2026-05-18
- 完成日期：2026-05-18
- 依赖：—

## 1. 背景与目标

bookmarklet 安装页 `index.html` 通过 `fetch("assets/clickask.css")` / `fetch("assets/clickask.js")` 拼装 `javascript:` URL。一旦 nginx / 浏览器缓存这两个文件，用户即使点击「重新安装书签」也拿不到最新版本，必须强刷或换 incognito。

目标：每次部署生成新的内容指纹，安装页拉取时附加 `?v=<hash>`，缓存按内容自动失效；本地开发不依赖 manifest，缺失时静默降级。

不做：

- 不引入构建器（rollup / vite）
- 不修改 bookmarklet 自身的 IIFE 内容（不是缓存源头）

## 2. 变更点

- [x] `scripts/deploy.sh`
  - 在 BUILD_DIR 中用 `shasum -a 256` 计算 css/js 短 hash（前 8 位）
  - 写入 `assets/manifest.json`：`{"css": "<hash>", "js": "<hash>", "builtAt": "<iso>"}`
  - scp 上传时一并把 manifest.json 推到远端
- [x] `index.html`
  - 在拉取 css/js 之前先 `fetch("assets/manifest.json")`，成功则给两个资源 URL 拼上 `?v=<hash>`，失败（404 / parse 错误）则降级到不带 query
  - 行为对最终 `javascript:` 字符串内容无影响（manifest 只是个 GET 缓存键）

## 3. 影响范围

- 部署：每次 deploy 会多上传一份 `assets/manifest.json`（< 100 字节）
- 安装页：多一次 fetch（manifest.json），失败不阻塞
- 本地（python3 -m http.server）：无 manifest.json，安装页降级路径生效
- 不影响：bookmarklet IIFE 行为、CR-001~005 单测

## 4. 验收标准

1. `bash -n scripts/deploy.sh` 通过
2. deploy.sh 包含 `shasum -a 256`、`manifest.json` 关键字
3. index.html 包含 `manifest.json` 拉取分支
4. 本地 `python3 -m http.server` 启动 → 访问 install 页 → 书签可正常生成（manifest 缺失时降级）
5. 现有 29 个测试全部回归通过

## 5. 测试用例

### 5.1 自动用例（vitest）

`tests/unit/cr006-cache-busting.test.js`：

- 读取 `index.html` 文本，断言包含 `manifest.json` 与 `?v=`
- 读取 `scripts/deploy.sh` 文本，断言包含 `shasum -a 256` 与 `manifest.json`
- 不破坏 bookmarklet 资源：`assets/clickask.js` 与 `assets/clickask.css` 中**不**应包含 `manifest.json`（manifest 只在 install 页使用）

### 5.2 手动用例（`tests/manual/CR-006.md`）

| # | 步骤 | 预期 |
|---|------|------|
| 1 | 本地 `python3 -m http.server 18082`，打开安装页 | 书签链接生成成功（manifest 缺失走降级） |
| 2 | 手动放一个 `assets/manifest.json` 内容 `{"css":"a1b2c3d4","js":"e5f6g7h8"}` | DevTools Network 中 css/js 请求 URL 含 `?v=a1b2c3d4` / `?v=e5f6g7h8` |
| 3 | 改一行 css，重跑 `./scripts/deploy.sh`（线上验证） | manifest 中 css hash 变化；浏览器自动拉新 css；老书签内容也更新 |

## 6. 回归校验

- [x] `node --check assets/clickask.js`
- [x] `bash -n scripts/deploy.sh`
- [x] `npm test`（含 CR-000/001/002/003/004/005）

## 7. 实施记录

- 选 sha256 而非 mtime/version：内容相同时 hash 不变，不会无谓打破缓存
- 仅取前 8 位：避免 URL 过长，碰撞概率对单文件足够低
- manifest 降级方案使本地开发零依赖
- 远端 chown/chmod 命令需把 manifest.json 也纳入 644 权限
