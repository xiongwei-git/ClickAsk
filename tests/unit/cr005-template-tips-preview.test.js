import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..", "..");
const JS_PATH = path.join(ROOT, "assets", "clickask.js");
const CSS_PATH = path.join(ROOT, "assets", "clickask.css");

function loadBookmarklet() {
  const css = fs.readFileSync(CSS_PATH, "utf8");
  const js = fs.readFileSync(JS_PATH, "utf8");
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
  // eslint-disable-next-line no-new-func
  new Function(js)();
}

function teardownBookmarklet() {
  let safety = 10;
  while (safety-- > 0) {
    const btn = document.querySelector('[data-ca-action="close"]');
    if (!btn) break;
    btn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  }
}

function resetDom() {
  teardownBookmarklet();
  document.head.innerHTML = "";
  document.body.innerHTML =
    '<main id="app">' +
    '  <h1 id="title">销售总览</h1>' +
    '  <p id="desc">本月销售下降 12%。</p>' +
    "</main>";
  // jsdom default navigator.language is en-US — force zh so we can assert on
  // Chinese-only template strings.
  Object.defineProperty(window.navigator, "language", {
    value: "zh-CN",
    configurable: true
  });
  Object.defineProperty(window.navigator, "languages", {
    value: ["zh-CN", "zh"],
    configurable: true
  });
}

function click(el) {
  el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
}

function fireInput(el, value) {
  el.value = value;
  el.dispatchEvent(new window.Event("input", { bubbles: true }));
}

function fireChange(select, value) {
  select.value = value;
  select.dispatchEvent(new window.Event("change", { bubbles: true }));
}

describe("CR-005: template tips + prompt preview", () => {
  beforeEach(() => resetDom());
  afterEach(() => resetDom());

  it("every template option exposes a non-empty title attribute", () => {
    loadBookmarklet();
    const options = document.querySelectorAll('.ca-type option:not([value="auto"])');
    expect(options.length).toBeGreaterThan(0);
    options.forEach(function (opt) {
      expect(opt.title.trim().length).toBeGreaterThan(0);
    });
  });

  it("changing template select updates the .ca-template-tip text", () => {
    loadBookmarklet();
    const select = document.querySelector(".ca-type");
    fireChange(select, "summarize");
    const tip = document.querySelector(".ca-template-tip").textContent;
    expect(tip).toMatch(/短条目|提炼|关键数字/);
  });

  it("preview body contains the user intent text after typing + selecting", () => {
    loadBookmarklet();
    click(document.getElementById("desc"));
    const intent = document.querySelector(".ca-intent");
    fireInput(intent, "为什么数字下降这么多");
    const body = document.querySelector(".ca-preview-body").textContent;
    expect(body).toMatch(/为什么数字下降这么多/);
  });

  it("manual template selection drives the preview heading", () => {
    loadBookmarklet();
    click(document.getElementById("desc"));
    const select = document.querySelector(".ca-type");
    fireChange(select, "debug");
    const body = document.querySelector(".ca-preview-body").textContent;
    expect(body.split("\n")[0]).toMatch(/^# 页面问题排查/);
  });

  it("preview shows previewEmpty hint when no element is selected", () => {
    loadBookmarklet();
    const body = document.querySelector(".ca-preview-body").textContent;
    expect(body).toMatch(/选中元素后/);
  });
});
