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
  delete window.html2canvas;
  document.head.innerHTML = "";
  document.body.innerHTML = '<main id="app"><h1 id="t">hi</h1></main>';
  document.querySelectorAll(".ca-csp-banner").forEach((el) => el.remove());
}

/** Stub window.html2canvas so loadHtml2Canvas() resolves without injecting a script. */
function stubH2C(impl) {
  window.html2canvas = impl || function () {
    return Promise.resolve({
      width: 100,
      height: 50,
      toDataURL: () => "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=="
    });
  };
}

function clickAt(el) {
  el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
}

function snapButtonOf(idx) {
  const tags = document.querySelectorAll(".ca-tag");
  return tags[idx].querySelector(".ca-snap-btn");
}

async function tick() {
  await new Promise((r) => setTimeout(r, 5));
}

describe("CR-007 元素截图", () => {
  beforeEach(() => {
    resetDom();
  });
  afterEach(() => {
    teardownBookmarklet();
    delete window.html2canvas;
  });

  it("每个选中元素的 tag 内含 📷 snap 按钮", () => {
    stubH2C();
    loadBookmarklet();
    clickAt(document.getElementById("t"));
    const snap = snapButtonOf(0);
    expect(snap).toBeTruthy();
    expect(snap.className).toContain("ca-snap-btn");
  });

  it("点击 snap → screenshots 增加 → DOM 出现 .ca-thumb", async () => {
    stubH2C();
    loadBookmarklet();
    clickAt(document.getElementById("t"));

    snapButtonOf(0).dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await tick();

    const thumb = document.querySelector(".ca-thumb");
    expect(thumb, ".ca-thumb 应被渲染").toBeTruthy();
    expect(thumb.src.startsWith("data:image/png;base64,")).toBe(true);
    // download link
    const dl = document.querySelector(".ca-shot-download");
    expect(dl).toBeTruthy();
    expect(dl.getAttribute("download")).toMatch(/^clickask-/);
  });

  it("跨域错误 → 显示 cross-origin 文案，不残留 thumb", async () => {
    stubH2C(function () {
      // canvas with toDataURL throwing SecurityError
      return Promise.resolve({
        width: 10, height: 10,
        toDataURL: function () { throw new Error("tainted"); }
      });
    });
    loadBookmarklet();
    clickAt(document.getElementById("t"));
    snapButtonOf(0).dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await tick();

    const status = document.querySelector(".ca-snap-status");
    expect(status.textContent).toMatch(/跨域|cross-origin/i);
    expect(document.querySelector(".ca-thumb")).toBeNull();
  });

  it("html2canvas 缺失（lazy load 失败）→ 注入 <script> 且 status 显示加载中", async () => {
    // 不挂 stub，触发真 lazy load 路径
    loadBookmarklet();
    clickAt(document.getElementById("t"));
    snapButtonOf(0).dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    // 立刻应该出现 loading 文案
    const status = document.querySelector(".ca-snap-status");
    expect(status.textContent).toMatch(/加载|Loading/);
    // <script> 标签被注入
    const injected = document.querySelector('script[src*="html2canvas.min.js"]');
    expect(injected, "vendor script 应被注入").toBeTruthy();
    // 模拟 onerror
    injected.onerror && injected.onerror();
    await tick();
    expect(document.querySelector(".ca-snap-status").textContent).toMatch(/失败|failed|Failed/i);
  });

  it("移除截图按钮工作 → screenshots 清空", async () => {
    stubH2C();
    loadBookmarklet();
    clickAt(document.getElementById("t"));
    snapButtonOf(0).dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await tick();
    expect(document.querySelector(".ca-thumb")).toBeTruthy();

    const rm = document.querySelector(".ca-shot-remove");
    rm.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    expect(document.querySelector(".ca-thumb")).toBeNull();
  });

  it("buildPrompt 含 Screenshots 占位行（含尺寸）", async () => {
    stubH2C();
    loadBookmarklet();
    clickAt(document.getElementById("t"));
    snapButtonOf(0).dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await tick();

    const intent = document.querySelector(".ca-intent");
    intent.value = "describe";
    intent.dispatchEvent(new window.Event("input", { bubbles: true }));
    const preview = document.querySelector(".ca-preview-body").textContent;
    expect(preview).toMatch(/截图|Screenshots/);
    expect(preview).toMatch(/100x50/);
  });

  it("destroy 清理 screenshots（重新激活后无残留）", async () => {
    stubH2C();
    loadBookmarklet();
    clickAt(document.getElementById("t"));
    snapButtonOf(0).dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await tick();
    expect(document.querySelector(".ca-thumb")).toBeTruthy();

    teardownBookmarklet();
    expect(document.querySelector(".ca-thumb")).toBeNull();

    // 再次激活
    loadBookmarklet();
    expect(document.querySelector(".ca-thumb")).toBeNull();
  });
});
