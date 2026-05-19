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
  // eslint-disable-next-line no-new-func
  new Function(js)();
}

function teardownBookmarklet() {
  // Click every surviving close button so each loaded closure runs destroy()
  // and removes its document-level listeners. Otherwise listeners from previous
  // tests pile up and a single click triggers multiple handleClick runs.
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
    '  <h1 id="title">hello</h1>' +
    '  <p id="desc">world</p>' +
    '  <article id="card"><span>card</span></article>' +
    "</main>";
}

function click(el) {
  el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
}

function nextFrame() {
  return new Promise(function (resolve) {
    window.requestAnimationFrame(function () {
      // Wait one more tick to allow rAF callback's side effects to flush.
      window.setTimeout(resolve, 0);
    });
  });
}

describe("CR-003: lazy id + detached cleanup", () => {
  beforeEach(() => {
    resetDom();
  });

  afterEach(() => {
    resetDom();
  });

  it("after load, no element carries data-clickask-id", () => {
    loadBookmarklet();
    expect(document.querySelectorAll("[data-clickask-id]").length).toBe(0);
  });

  it("clicking one element only marks that element with an id", () => {
    loadBookmarklet();
    const target = document.getElementById("title");
    click(target);
    const tagged = document.querySelectorAll("[data-clickask-id]");
    expect(tagged.length).toBe(1);
    expect(tagged[0]).toBe(target);
  });

  it("destroy() via close button clears every data-clickask-id", () => {
    loadBookmarklet();
    click(document.getElementById("title"));
    click(document.getElementById("desc"));
    expect(document.querySelectorAll("[data-clickask-id]").length).toBeGreaterThan(0);

    const closeBtn = document.querySelector('[data-ca-action="close"]');
    closeBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    expect(document.querySelectorAll("[data-clickask-id]").length).toBe(0);
  });

  it("dynamically injected element can be selected by click (no MutationObserver needed)", () => {
    loadBookmarklet();
    const fresh = document.createElement("section");
    fresh.id = "late";
    fresh.textContent = "late comer";
    document.getElementById("app").appendChild(fresh);

    click(fresh);
    expect(fresh.getAttribute("data-clickask-id")).toMatch(/^ca-\d+$/);
    expect(document.querySelectorAll(".ca-sel-box").length).toBe(1);
  });

  it("removing a selected element from DOM auto-cleans its overlay on next reposition", async () => {
    loadBookmarklet();
    const target = document.getElementById("desc");
    click(target);
    expect(document.querySelectorAll(".ca-sel-box").length).toBe(1);

    target.remove();
    window.dispatchEvent(new window.Event("scroll"));
    await nextFrame();

    expect(document.querySelectorAll(".ca-sel-box").length).toBe(0);
  });
});
