# Vendor 目录

CR-007 需要 self-host `html2canvas.min.js`（约 50KB）。

获取方式（任选其一）：

```sh
# 方式 A：从 unpkg
curl -fsSL https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js \
  -o assets/vendor/html2canvas.min.js

# 方式 B：从 jsdelivr
curl -fsSL https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js \
  -o assets/vendor/html2canvas.min.js
```

`scripts/deploy.sh` 在文件缺失时会自动尝试从 unpkg 下载。

本目录的 `html2canvas.min.js` **不进 git**（见 `.gitignore`），保持仓库轻量。
