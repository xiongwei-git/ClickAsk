# ClickAsk Operator Runbook

## Local Smoke Test

```sh
python3 -m http.server 18081
node --check assets/clickask.js
curl -I -sS http://127.0.0.1:18081/
curl -I -sS http://127.0.0.1:18081/assets/clickask.js
curl -I -sS http://127.0.0.1:18081/assets/clickask.css
```

Open `http://127.0.0.1:18081/`, install the bookmarklet, then test on `demo.html`.

## Production Deploy

```sh
./scripts/deploy.sh
```

The script uploads only:

- `index.html`
- `assets/clickask.js`
- `assets/clickask.css`

Optional demo upload:

```sh
INCLUDE_DEMO=1 ./scripts/deploy.sh
```

## Production Smoke Test

```sh
curl -I -sS http://clickask.tedxiong.com/
curl -I -sS http://clickask.tedxiong.com/assets/clickask.js
curl -I -sS http://clickask.tedxiong.com/assets/clickask.css
```

Expected result: `200 OK`.

## Known Operational Issues

### 403 After Deploy

Cause: Nginx cannot read `/www/wwwroot/clickask` or uploaded files.

Expected permissions:

```text
/www/wwwroot/clickask        drwxr-xr-x
/www/wwwroot/clickask/assets drwxr-xr-x
```

`scripts/deploy.sh` now runs a remote permission fix after `scp`:

```sh
chmod 755 /www/wwwroot/clickask
chown -R www:www /www/wwwroot/clickask/index.html /www/wwwroot/clickask/assets
```

### Safari Opens Install Page

Cause: Safari may save a dragged `javascript:` bookmarklet as a normal page bookmark.

Fix:

1. Open `http://clickask.tedxiong.com/`.
2. Click `Copy Safari install code`.
3. Create a normal bookmark named `ClickAsk`.
4. Edit the bookmark address.
5. Replace it with the copied `javascript:...` code.

### Bookmark Icon Shows Globe

Cause: browsers do not reliably use page favicons for `javascript:` bookmarklets.

No reliable fix exists during the bookmarklet stage. A browser extension can provide a stable toolbar icon later.
