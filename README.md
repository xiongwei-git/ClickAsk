# ClickAsk

A zero-install bookmarklet that lets you click any element on any webpage to instantly generate AI prompts (with optional element screenshots) for ChatGPT, Claude, and other LLM tools.

## What It Does

- Installs as a browser bookmarklet.
- Injects a lightweight page picker into the current page.
- Supports hover, click select, Shift multi-select, and drag select.
- Opens a floating prompt panel.
- Accepts a plain-language request.
- Recommends a prompt type with local intent detection in Auto mode.
- Generates a Markdown prompt with selected page context.
- Supports Chinese and English UI/prompt templates based on browser language.

## Use

Open:

```text
http://clickask.tedxiong.com/
```

Drag the `ClickAsk` button to the bookmarks bar. On any page, click the bookmark, select content, type a request, and copy the generated prompt.

### Safari

Safari may save dragged bookmarklets as normal page bookmarks. If clicking the bookmark opens the ClickAsk install page instead of showing the panel:

1. Open `http://clickask.tedxiong.com/`.
2. Click `Copy Safari install code`.
3. Create a normal bookmark named `ClickAsk`.
4. Edit the bookmark address.
5. Replace the address with the copied `javascript:...` code.

## Run Locally

```sh
python3 -m http.server 18081
```

Open `http://127.0.0.1:18081/`.

## Verify

```sh
node --check assets/clickask.js
curl -I -sS http://127.0.0.1:18081/
```

## Deploy

```sh
./scripts/deploy.sh
```

The deploy script uploads only public static files:

- `index.html`
- `assets/clickask.css`
- `assets/clickask.js`

It intentionally does not upload internal docs, design notes, or local ideation files.

## Current Limits

- No browser extension yet.
- No model calls yet.
- No voice input yet.
- Some pages may restrict bookmarklet behavior.
