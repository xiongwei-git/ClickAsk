import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..", "..");
const JS_PATH = path.join(ROOT, "assets", "clickask.js");
const CSS_PATH = path.join(ROOT, "assets", "clickask.css");
const HTML_PATH = path.join(ROOT, "index.html");

function loadBookmarkletWithCss() {
  const css = fs.readFileSync(CSS_PATH, "utf8");
  const js = fs.readFileSync(JS_PATH, "utf8");
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
  // eslint-disable-next-line no-new-func
  new Function(js)();
}

/** 模拟严格 CSP：根本不注入 <style>，让 panel 的 .ca-panel 拿不到 position:fixed。*/
function loadBookmarkletNoCss() {
  const js = fs.readFileSync(JS_PATH, "utf8");
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
  document.body.innerHTML = '<main id="app"></main>';
}

async function flushFrame() {
  // requestAnimationFrame in jsdom resolves on next macrotask via setTimeout shim.
  await new Promise((resolve) => setTimeout(resolve, 16));
}

describe("CR-009 CSP 注入兜底", () => {
  beforeEach(() => {
    resetDom();
  });
  afterEach(() => {
    teardownBookmarklet();
    document.querySelectorAll(".ca-csp-banner").forEach((el) => el.remove());
  });

  it("收到 securitypolicyviolation(style-src) → 渲染降级 banner", () => {
    loadBookmarkletWithCss();

    const evt = new window.Event("securitypolicyviolation", { bubbles: false });
    Object.defineProperty(evt, "violatedDirective", { value: "style-src-elem" });
    document.dispatchEvent(evt);

    const banner = document.querySelector(".ca-csp-banner");
    expect(banner, "banner 应被创建").toBeTruthy();
    // banner 文本含 i18n 文案（中英之一）
    expect(/CSP|csp/i.test(banner.textContent)).toBe(true);
  });

  it("script-src 违规也触发降级", () => {
    loadBookmarkletWithCss();

    const evt = new window.Event("securitypolicyviolation");
    Object.defineProperty(evt, "violatedDirective", { value: "script-src-elem" });
    document.dispatchEvent(evt);

    expect(document.querySelector(".ca-csp-banner")).toBeTruthy();
  });

  it("无关 directive（img-src）不触发 banner", () => {
    loadBookmarkletWithCss();

    const evt = new window.Event("securitypolicyviolation");
    Object.defineProperty(evt, "violatedDirective", { value: "img-src" });
    document.dispatchEvent(evt);

    expect(document.querySelector(".ca-csp-banner")).toBeNull();
  });

  it("banner 的 dismiss 按钮点击后移除自身", () => {
    loadBookmarkletWithCss();
    const evt = new window.Event("securitypolicyviolation");
    Object.defineProperty(evt, "violatedDirective", { value: "style-src" });
    document.dispatchEvent(evt);

    const banner = document.querySelector(".ca-csp-banner");
    expect(banner).toBeTruthy();
    const btn = banner.querySelector("button");
    expect(btn).toBeTruthy();
    btn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    expect(document.querySelector(".ca-csp-banner")).toBeNull();
  });

  it("CSS 未注入（jsdom getComputedStyle.position 非 fixed）→ requestAnimationFrame 回调进入降级", async () => {
    // 不挂 <style>，jsdom 默认 getComputedStyle(panel).position 会是 ""（jsdom 不渲染 layout）
    // 我们用 patch getComputedStyle 模拟「真的拿到非 fixed」的情况
    const origGCS = window.getComputedStyle;
    window.getComputedStyle = function (el) {
      const real = origGCS.call(window, el);
      if (el && el.classList && el.classList.contains("ca-panel")) {
        return new Proxy(real, { get(t, p) { return p === "position" ? "static" : Reflect.get(t, p); } });
      }
      return real;
    };
    try {
      loadBookmarkletNoCss();
      await flushFrame();
      expect(document.querySelector(".ca-csp-banner"), "降级 banner 应被自动渲染").toBeTruthy();
      // 同时 panel 应被打上 inline position:fixed
      const panel = document.querySelector(".ca-panel");
      expect(panel.style.position).toBe("fixed");
    } finally {
      window.getComputedStyle = origGCS;
    }
  });

  it("destroy（关闭按钮）会一并清理 banner", () => {
    loadBookmarkletWithCss();
    const evt = new window.Event("securitypolicyviolation");
    Object.defineProperty(evt, "violatedDirective", { value: "style-src" });
    document.dispatchEvent(evt);
    expect(document.querySelector(".ca-csp-banner")).toBeTruthy();

    teardownBookmarklet();
    expect(document.querySelector(".ca-csp-banner")).toBeNull();
  });

  it("install 页 (index.html) 含 CSP 受限 FAQ 节点 + 文案", () => {
    const html = fs.readFileSync(HTML_PATH, "utf8");
    expect(html).toContain('id="csp-title"');
    expect(html).toContain('id="csp-body"');
    expect(html).toMatch(/CSP|csp/);
  });
});
