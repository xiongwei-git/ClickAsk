# ClickAsk Agent Notes

## Project Shape

ClickAsk is a static bookmarklet project. Public runtime files are:

- `index.html`
- `assets/clickask.js`
- `assets/clickask.css`

Supporting local files:

- `demo.html` is a local test page.
- `design-system/MASTER.md` is the visual source of truth.
- `docs/development-brief.md` is the product/engineering brief.
- `scripts/deploy.sh` publishes the static site.

## Commands

Run a local static server:

```sh
python3 -m http.server 18081
```

Check JavaScript syntax:

```sh
node --check assets/clickask.js
```

Deploy public files:

```sh
./scripts/deploy.sh
```

## Boundaries

- Do not upload `docs/`, `design-system/`, or local ideation files as part of normal production deploy.
- Keep bookmarklet behavior self-contained; do not add API keys or secrets to frontend code.
- Keep UI changes aligned with `design-system/MASTER.md`.
- The bookmarklet stage cannot reliably control Safari/Chrome bookmark icons; favicon only affects the install page.
- Safari may require manual bookmark address replacement using the install page's copied `javascript:...` code.

## Release Target

Default production target:

```text
root@47.116.20.7:/www/wwwroot/clickask
```

Public URL:

```text
http://clickask.tedxiong.com/
```

`scripts/deploy.sh` fixes the production directory permissions after upload so Nginx can read the files.
