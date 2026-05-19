# CR-007: 元素截图（html2canvas 按需加载，self-host）

- 状态：Done
- 负责人：Codex Agent
- 创建日期：2026-05-18
- 完成日期：2026-05-18
- 依赖：CR-003（ensureId 给截图当 key）/ CR-009（CSP 信号用于错误降级提示）

## 1. 背景与目标

prompt 当前只有文字 / selector / xpath。AI 完全靠想象去推理被选中区域的视觉，结果：

- "让这个按钮更显眼" 类需求被泛泛回答
- 多元素时 AI 不知视觉关系
- 设计师 / PM 用户没法验证 prompt 命中对不对

引入元素截图 → prompt 从"文字推断"升级到"图文双锚"。

设计原则：

- **self-host html2canvas**：避免 CDN 不可控、connect-src 限制；与 clickask.js 同源加载
- **lazy load**：bookmarklet 体积零增长；用户第一次点 📷 才注入 vendor `<script>`
- **clipboard 多 MIME**：截图通过 `ClipboardItem` 与 prompt 文本同时写入剪贴板。粘贴到 ChatGPT/Claude 等支持图片粘贴的工具时图自动附上
- **失败兜底**：跨域 SecurityError、CSP 拦截、vendor 404 都给可见的中英文状态文案

不做：

- 框选区域裁剪（直接元素 `boundingRect`）
- 截图持久化到 localStorage（base64 体积太大）
- 截图标注 / 注释图层
- 服务端转图（违反 bookmarklet 自包含原则）

## 2. 变更点

- [x] `assets/clickask.js`：
  - i18n.zh / i18n.en 增加 11 个截图相关字段
  - 顶部 state：`screenshots` (Map) / `html2canvasState` / `html2canvasPromise` / `html2canvasScript`
  - 新增模块 `html2canvasUrl` / `loadHtml2Canvas` / `captureElement`
  - 新增 UI：`handleSnapClick` / `renderShots` / `setSnapStatus`
  - panel HTML 新增 `.ca-shots` / `.ca-snap-status` 容器
  - 每个 `.ca-tag` 内部新增 `.ca-snap-btn` 📷 按钮
  - `buildPrompt` 末尾给有截图的元素增加占位行 `Screenshots: [WxH PNG attached via clipboard image]`
  - `writeClipboard` 改为多 MIME：截图存在时用 `ClipboardItem` 写 `text/plain + image/png`
  - 新增 `dataUrlToBlob` / `writeClipboardText` 助手
  - `destroy()` 清空 `screenshots`
- [x] `assets/clickask.css`：新增 `.ca-snap-btn` / `.ca-shots` / `.ca-shot` / `.ca-thumb` / `.ca-shot-actions` / `.ca-shot-download` / `.ca-shot-remove` / `.ca-snap-status`
- [x] `scripts/deploy.sh`：新增 vendor 拷贝 / 缺失时 `curl unpkg` 兜底下载
- [x] `assets/vendor/README.md`：vendor 目录说明
- [x] `.gitignore`：忽略 `assets/vendor/html2canvas.min.js`
- [x] `tests/unit/cr007-screenshot.test.js`：7 个用例
- [x] `tests/manual/CR-007.md`：5 条手动用例

## 3. 影响范围

- 行为变化：每个选中元素的 tag 多一个 📷 按钮；截图后下方出现 thumbnail；复制 prompt 时第一张截图同时写入剪贴板（`ClipboardItem`）
- 性能：bookmarklet IIFE 无新增 lib；用户首次点 📷 才下载 ~50KB html2canvas
- 兼容性：
  - Chrome / Edge：`ClipboardItem` 完整支持
  - Safari：`ClipboardItem` 对图片 MIME 有时拒绝 → 自动降级到纯文本路径
  - 跨域图片：`canvas.toDataURL` 抛错 → 显示「该区域含跨域资源」
  - CSP 拦截 vendor：`<script>` onerror → 显示「截图失败」（如 CR-009 已识别 script 类违规则换文案为「页面 CSP 拦截了截图库加载」）
- 不影响：CR-001~009 全部回归通过（54/54）

## 4. 验收标准

1. 选中元素后 tag 内可见 📷 按钮
2. 点击 📷 → status 提示加载 → 加载完成后显示缩略图
3. 缩略图旁有「下载 / Download」链接（download 属性 = `clickask-<id>.png`）
4. 缩略图旁有「✕」按钮，可单独移除某张截图
5. `buildPrompt`（panel 预览区可见）含 `截图: [WxH PNG ...]` 占位
6. 复制 prompt（有截图时）会调 `navigator.clipboard.write([ClipboardItem])`
7. 跨域错误 / 加载失败 → status 显示中英文友好文案
8. 关闭面板再打开 → 上次截图全部清空

## 5. 测试用例

### 5.1 自动用例（vitest）

`tests/unit/cr007-screenshot.test.js`：
1. 每个 tag 内含 .ca-snap-btn
2. 点 snap → .ca-thumb 渲染 / download 链接 / dataURL 正确
3. 跨域 toDataURL 抛错 → status 文案匹配，无残留 thumb
4. lazy load：注入 `<script src*="html2canvas.min.js">` + onerror 路径
5. 移除单张截图按钮工作
6. buildPrompt 输出含 `截图/Screenshots: [100x50 ...]`
7. destroy 清理截图 / 重新激活无残留

### 5.2 手动用例

见 `tests/manual/CR-007.md`。

## 6. 回归校验

- [x] `node --check assets/clickask.js`
- [x] `npm test` → 10 文件 / 54 用例全绿
- [ ] 真浏览器实测：本地 `python3 -m http.server` + 拖书签到 demo.html，截图 + 粘贴到 ChatGPT 验证图自动附上

## 7. 实施记录

实际改动：~140 行 js + 75 行 css + 19 行 deploy + 7 单测 + 5 手动用例。

设计选择：

- **html2canvas vendor 不进 git**：保持仓库轻量；deploy.sh 自动从 unpkg 拉。本地开发首次需手动 `curl` 到 `assets/vendor/html2canvas.min.js`，否则点 📷 会触发 onerror 路径（这也是「失败提示」的天然手测入口）
- **clipboard 写图 MIME 选择 image/png 而非 image/jpeg**：透明背景保留（html2canvas `backgroundColor: null`）
- **第一张截图优先**：`ClipboardItem` 在主流浏览器一次只能放 1 张图。多选 + 多截图时只第一张能进剪贴板，其余靠用户手动下载。这是 web API 限制，不是 bug
- **`html2canvasUrl` 通过遍历 `<script>` 标签确定同源**：兼容 install 页用 `?v=hash` cache-busting（CR-006）的场景

后续 TODO：

- 实测 Safari 上 `ClipboardItem` image MIME 是否被拒（理论上会，需手动验证）
- 多截图时把第 2..n 张写为单独 ClipboardItem 失败 → 是否值得加 ZIP 打包下载？（暂不做，等用户反馈）
- `useCORS: true` 时 cross-origin `<img>` 若有正确 CORS 头能正常截，否则才抛错。可以在文档里说明
