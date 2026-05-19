import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..", "..");
const JS_PATH = path.join(ROOT, "assets", "clickask.js");
const CSS_PATH = path.join(ROOT, "assets", "clickask.css");
const JS_SRC = fs.readFileSync(JS_PATH, "utf8");

function loadBookmarklet() {
  const css = fs.readFileSync(CSS_PATH, "utf8");
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
  // eslint-disable-next-line no-new-func
  new Function(JS_SRC)();
}

function teardownBookmarklet() {
  let safety = 10;
  while (safety-- > 0) {
    const btn = document.querySelector('[data-ca-action="close"]');
    if (!btn) break;
    btn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  }
  const banner = document.querySelector(".ca-csp-banner");
  if (banner) banner.remove();
}

function setLanguage(lang) {
  Object.defineProperty(window.navigator, "language", { value: lang, configurable: true });
  Object.defineProperty(window.navigator, "languages", {
    value: [lang, lang.split("-")[0]],
    configurable: true
  });
}

function resetDom(lang) {
  teardownBookmarklet();
  document.head.innerHTML = "";
  document.body.innerHTML =
    '<main id="app">' +
    '  <h1 id="title">Welcome page</h1>' +
    '  <p id="desc">Hello and welcome to the page.</p>' +
    "</main>";
  setLanguage(lang || "zh-CN");
}

function click(el) {
  el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
}

function fireInput(el, value) {
  el.value = value;
  el.dispatchEvent(new window.Event("input", { bubbles: true }));
}

describe("CR-010: i18n split + intent keywords bucketed by language", () => {
  beforeEach(() => resetDom("zh-CN"));
  afterEach(() => resetDom("zh-CN"));

  it("source declares STRINGS_EN, STRINGS_ZH and translations composed from them", () => {
    expect(JS_SRC).toMatch(/const\s+STRINGS_EN\s*=\s*\{/);
    expect(JS_SRC).toMatch(/const\s+STRINGS_ZH\s*=\s*\{/);
    expect(JS_SRC).toMatch(
      /const\s+translations\s*=\s*\{\s*en:\s*STRINGS_EN\s*,\s*zh:\s*STRINGS_ZH\s*\}/
    );
  });

  it("EN and ZH string objects expose the same top-level keys", () => {
    const enMatch = JS_SRC.match(/const\s+STRINGS_EN\s*=\s*\{([\s\S]*?)\n\s\s\};/);
    const zhMatch = JS_SRC.match(/const\s+STRINGS_ZH\s*=\s*\{([\s\S]*?)\n\s\s\};/);
    expect(enMatch).not.toBeNull();
    expect(zhMatch).not.toBeNull();
    const collectKeys = (block) => {
      const lines = block.split("\n");
      const keys = [];
      let depth = 0;
      lines.forEach((line) => {
        const open = (line.match(/\{/g) || []).length;
        const close = (line.match(/\}/g) || []).length;
        if (depth === 0) {
          const m = line.match(/^\s{6}([a-zA-Z][a-zA-Z0-9]*)\s*:/);
          if (m) keys.push(m[1]);
        }
        depth += open - close;
        if (depth < 0) depth = 0;
      });
      return keys.sort();
    };
    const enKeys = collectKeys(enMatch[1]);
    const zhKeys = collectKeys(zhMatch[1]);
    expect(zhKeys).toEqual(enKeys);
    expect(enKeys).toContain("templates");
    expect(enKeys).toContain("snapAction");
  });

  it("intentRules keywords are bucketed into zh/en arrays for every rule", () => {
    const ruleNames = ["summarize", "debug", "analyze", "ux", "code"];
    ruleNames.forEach((name) => {
      const re = new RegExp(
        name +
          ":\\s*\\{[\\s\\S]*?weight:\\s*\\d+,[\\s\\S]*?keywords:\\s*\\{[\\s\\S]*?zh:\\s*\\[[\\s\\S]*?\\][\\s\\S]*?en:\\s*\\[[\\s\\S]*?\\]"
      );
      expect(JS_SRC).toMatch(re);
    });
  });

  it("zh locale: 中文意图关键词命中 -> 推荐对应模板", () => {
    resetDom("zh-CN");
    loadBookmarklet();
    click(document.getElementById("desc"));
    fireInput(document.querySelector(".ca-intent"), "帮我总结一下这段内容");
    const note = document.querySelector(".ca-recommendation");
    expect(note).not.toBeNull();
    expect(note.textContent).toMatch(/推荐:\s*总结内容/);
  });

  it("en locale: English keyword 命中 -> 推荐对应模板", () => {
    resetDom("en-US");
    loadBookmarklet();
    click(document.getElementById("desc"));
    fireInput(document.querySelector(".ca-intent"), "please give me a brief recap");
    const note = document.querySelector(".ca-recommendation");
    expect(note).not.toBeNull();
    expect(note.textContent).toMatch(/Recommended:\s*Summarize/);
  });

  it("cross-locale half-weight fallback: en locale with Chinese keyword still ranks", () => {
    resetDom("en-US");
    loadBookmarklet();
    click(document.getElementById("desc"));
    // 崩溃 仅在 zh debug 桶中；en locale 下应走 half-weight fallback 仍能识别为 debug
    fireInput(document.querySelector(".ca-intent"), "崩溃 崩溃");
    const note = document.querySelector(".ca-recommendation");
    expect(note).not.toBeNull();
    expect(note.textContent).toMatch(/Recommended:\s*Debug issue/);
  });

  it("locale-specific UI strings render correctly", () => {
    resetDom("en-US");
    loadBookmarklet();
    const fieldLabel = document.querySelector(".ca-field-label");
    expect(fieldLabel).not.toBeNull();
    expect(fieldLabel.textContent).toMatch(/What do you want to ask/i);
    teardownBookmarklet();
    document.head.innerHTML = "";
    resetDom("zh-CN");
    loadBookmarklet();
    expect(document.querySelector(".ca-field-label").textContent).toMatch(/你想问什么/);
  });
});
