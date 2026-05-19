# 手动测试清单

DOM 交互、剪贴板、跨标签页等不便自动化的用例放在这里。

每个 CR 在引入新交互时，请新建 `CR-XXX.md`，按下面的格式填写：

```markdown
# CR-XXX 手动测试

环境：Chrome xxx / Safari xxx，本地启动 `python3 -m http.server 18081`

| # | 步骤 | 预期 |
|---|------|------|
| 1 | 打开 demo.html，点击书签 | 面板出现在右下角 |
```

## 通用前置

1. 启动本地服务：`python3 -m http.server 18081`
2. 打开 `http://127.0.0.1:18081/`
3. 拖动 ClickAsk 按钮到书签栏
4. 打开 `http://127.0.0.1:18081/demo.html`
5. 点击书签栏中的 ClickAsk
