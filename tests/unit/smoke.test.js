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
  style.setAttribute("data-clickask-style", "");
  style.textContent = css;
  document.head.appendChild(style);
  // Equivalent to `javascript:` URL execution: a fresh function scope.
  // eslint-disable-next-line no-new-func
  new Function(js)();
}

function resetDom() {
  document.head.innerHTML = "";
  document.body.innerHTML = "<main id=\"app\"><h1>hello</h1><p>world</p></main>";
}

describe("CR-000 smoke: clickask.js can boot in jsdom", () => {
  beforeEach(() => {
    resetDom();
  });

  afterEach(() => {
    resetDom();
  });

  it("injects the floating panel and hover-box on first load", () => {
    loadBookmarklet();
    expect(document.querySelector(".ca-panel")).not.toBeNull();
    expect(document.querySelector(".ca-hover-box")).not.toBeNull();
  });

  it("is idempotent: re-running does not create a second panel", () => {
    loadBookmarklet();
    loadBookmarklet();
    expect(document.querySelectorAll(".ca-panel").length).toBe(1);
  });

  it("destroy() via close button removes the panel and hover-box", () => {
    loadBookmarklet();
    const closeBtn = document.querySelector('[data-ca-action="close"]');
    expect(closeBtn).not.toBeNull();
    closeBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    expect(document.querySelector(".ca-panel")).toBeNull();
    expect(document.querySelector(".ca-hover-box")).toBeNull();
  });
});
