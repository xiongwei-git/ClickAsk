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

function resetDom() {
  document.head.innerHTML = "";
  document.body.innerHTML =
    '<main id="app"><h1 id="title">hello world</h1>' +
    '<p id="para">some text here for selection</p></main>';
}

function click(el, opts = {}) {
  el.dispatchEvent(
    new window.MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
      altKey: !!opts.altKey
    })
  );
}

describe("CR-002 pause/passthrough", () => {
  beforeEach(() => resetDom());
  afterEach(() => resetDom());

  it("renders .ca-status as a button with aria-pressed=false", () => {
    loadBookmarklet();
    const status = document.querySelector(".ca-status");
    expect(status).not.toBeNull();
    expect(status.tagName).toBe("BUTTON");
    expect(status.getAttribute("aria-pressed")).toBe("false");
  });

  it("clicking .ca-status toggles paused state and aria-pressed", () => {
    loadBookmarklet();
    const status = document.querySelector(".ca-status");
    const dot = document.querySelector(".ca-status-dot");

    click(status);
    expect(status.getAttribute("aria-pressed")).toBe("true");
    expect(dot.classList.contains("ca-paused")).toBe(true);

    click(status);
    expect(status.getAttribute("aria-pressed")).toBe("false");
    expect(dot.classList.contains("ca-paused")).toBe(false);
  });

  it("Alt+click on a body element does NOT create a selection tag", () => {
    loadBookmarklet();
    click(document.getElementById("title"), { altKey: true });
    expect(document.querySelectorAll(".ca-tag").length).toBe(0);
    expect(document.querySelectorAll(".ca-sel-box").length).toBe(0);
  });

  it("plain click still creates a selection tag (regression guard)", () => {
    loadBookmarklet();
    click(document.getElementById("title"));
    expect(document.querySelectorAll(".ca-tag").length).toBeGreaterThan(0);
  });

  it("shortcuts hint mentions Alt pass-through", () => {
    loadBookmarklet();
    const shortcuts = document.querySelector(".ca-shortcuts").textContent;
    expect(shortcuts).toMatch(/Alt/);
  });
});
