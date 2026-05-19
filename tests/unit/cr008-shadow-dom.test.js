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
  document.body.innerHTML = '<main id="app"></main>';
}

/** Build a host with an open shadow root containing inner markup. */
function attachShadowHost(parent, hostTag, innerHTML) {
  const host = document.createElement(hostTag);
  parent.appendChild(host);
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = innerHTML;
  return host;
}

function clickIn(el) {
  el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, composed: true, cancelable: true }));
}

function getSelectionTags() {
  return Array.from(document.querySelectorAll(".ca-tag")).map((t) => t.textContent.trim());
}

describe("CR-008 Shadow DOM 支持", () => {
  beforeEach(() => {
    resetDom();
  });
  afterEach(() => {
    teardownBookmarklet();
  });

  it("composedPath 让 shadow 内点击选中真实节点而不是 host", () => {
    const app = document.getElementById("app");
    const host = attachShadowHost(app, "my-card", '<div class="title">Hello shadow</div>');
    loadBookmarklet();

    const inner = host.shadowRoot.querySelector(".title");
    expect(inner).toBeTruthy();
    clickIn(inner);

    // 选中后会渲染一个 .ca-tag，labelEl reflects the actual selected element
    const tags = document.querySelectorAll(".ca-tag");
    expect(tags.length).toBe(1);
    // shadow 内元素被打上 data-clickask-id（CR-003 lazy id 在 ensureId 时写入）
    expect(inner.getAttribute("data-clickask-id")).toBeTruthy();
    // host 不应被打 id（确认选的不是 host）
    expect(host.getAttribute("data-clickask-id")).toBeNull();
  });

  it("shadow 元素的 selector 含 ' >>> ' 标记", () => {
    const app = document.getElementById("app");
    const host = attachShadowHost(app, "my-card", '<div class="title">x</div>');
    loadBookmarklet();
    clickIn(host.shadowRoot.querySelector(".title"));

    // 触发 copy 流程，从 textarea 取出 prompt 文本验证 selector 段
    const intent = document.querySelector(".ca-intent");
    intent.value = "tweak title";
    intent.dispatchEvent(new window.Event("input", { bubbles: true }));
    document.querySelector(".ca-copy").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));

    // prompt 通过 navigator.clipboard 写入；改读 panel 中预览（CR-005）
    const preview = document.querySelector(".ca-preview-body");
    expect(preview, "preview body").toBeTruthy();
    expect(preview.textContent).toContain(" >>> ");
  });

  it("shadow 元素的 xpath 含 ' ::shadow ' 分隔", () => {
    const app = document.getElementById("app");
    const host = attachShadowHost(app, "my-card", '<div class="title">x</div>');
    loadBookmarklet();
    clickIn(host.shadowRoot.querySelector(".title"));

    const intent = document.querySelector(".ca-intent");
    intent.value = "tweak";
    intent.dispatchEvent(new window.Event("input", { bubbles: true }));
    const preview = document.querySelector(".ca-preview-body");
    expect(preview.textContent).toContain("::shadow");
  });

  it("element context 含 shadowPath 字段（host 标签链）", () => {
    const app = document.getElementById("app");
    const host = attachShadowHost(app, "my-card", '<div class="title">x</div>');
    loadBookmarklet();
    clickIn(host.shadowRoot.querySelector(".title"));

    const intent = document.querySelector(".ca-intent");
    intent.value = "tweak";
    intent.dispatchEvent(new window.Event("input", { bubbles: true }));
    const preview = document.querySelector(".ca-preview-body").textContent;
    expect(preview.toLowerCase()).toContain("shadowpath");
    expect(preview.toLowerCase()).toContain("my-card");
  });

  it("嵌套 shadow → selector / shadowPath 含两段 boundary", () => {
    const app = document.getElementById("app");
    const outer = attachShadowHost(app, "my-outer", "");
    const inner = attachShadowHost(outer.shadowRoot, "my-inner", '<span class="leaf">x</span>');
    loadBookmarklet();

    const leaf = inner.shadowRoot.querySelector(".leaf");
    clickIn(leaf);

    const intent = document.querySelector(".ca-intent");
    intent.value = "tweak";
    intent.dispatchEvent(new window.Event("input", { bubbles: true }));
    const preview = document.querySelector(".ca-preview-body").textContent;

    // selector 应有两个 ' >>> '
    const arrows = preview.match(/ >>> /g) || [];
    expect(arrows.length).toBeGreaterThanOrEqual(2);
    // shadowPath 含两层 host 标签
    expect(preview).toContain("my-outer");
    expect(preview).toContain("my-inner");
  });

  it("light DOM 元素不会出现 shadow 标记（回归保障）", () => {
    const app = document.getElementById("app");
    app.innerHTML = '<h1 id="title">plain</h1>';
    loadBookmarklet();

    clickIn(document.getElementById("title"));
    const intent = document.querySelector(".ca-intent");
    intent.value = "tweak";
    intent.dispatchEvent(new window.Event("input", { bubbles: true }));
    const preview = document.querySelector(".ca-preview-body").textContent;

    expect(preview).not.toContain(" >>> ");
    expect(preview).not.toContain("::shadow");
    expect(preview.toLowerCase()).not.toContain("shadowpath");
  });
});
