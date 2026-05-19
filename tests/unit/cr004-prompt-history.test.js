import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..", "..");
const JS_PATH = path.join(ROOT, "assets", "clickask.js");
const CSS_PATH = path.join(ROOT, "assets", "clickask.css");
const HISTORY_KEY = "clickask:prompt-history";

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
  try {
    window.localStorage.removeItem(HISTORY_KEY);
  } catch (e) {
    /* noop */
  }
  document.head.innerHTML = "";
  document.body.innerHTML =
    '<main id="app">' +
    '  <h1 id="title">销售总览</h1>' +
    '  <p id="desc">本月销售下降 12%</p>' +
    "</main>";
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

function copyAfter(intent, type) {
  if (typeof type === "string") {
    fireChange(document.querySelector(".ca-type"), type);
  }
  fireInput(document.querySelector(".ca-intent"), intent);
  click(document.querySelector(".ca-copy"));
}

function readHistory() {
  const raw = window.localStorage.getItem(HISTORY_KEY);
  return raw ? JSON.parse(raw) : [];
}

describe("CR-004: prompt history (localStorage)", () => {
  beforeEach(() => resetDom());
  afterEach(() => resetDom());

  it("shows historyEmpty hint and zero chips on a clean load", () => {
    loadBookmarklet();
    expect(document.querySelector(".ca-history-empty")).not.toBeNull();
    expect(document.querySelectorAll(".ca-history-chip").length).toBe(0);
  });

  it("copying a prompt persists exactly one entry to localStorage and renders one chip", () => {
    loadBookmarklet();
    click(document.getElementById("desc"));
    copyAfter("为什么数字下降");
    const list = readHistory();
    expect(list.length).toBe(1);
    expect(list[0].intent).toBe("为什么数字下降");
    expect(document.querySelectorAll(".ca-history-chip").length).toBe(1);
  });

  it("re-copying the same (intent, type) keeps the list at 1 entry and bumps it to top", () => {
    loadBookmarklet();
    click(document.getElementById("desc"));
    copyAfter("一样的需求", "debug");
    copyAfter("一样的需求", "debug");
    const list = readHistory();
    expect(list.length).toBe(1);
  });

  it("history caps at 5 entries and orders newest first", () => {
    loadBookmarklet();
    click(document.getElementById("desc"));
    ["a1", "a2", "a3", "a4", "a5", "a6"].forEach(function (txt) {
      copyAfter(txt);
    });
    const list = readHistory();
    expect(list.length).toBe(5);
    expect(list[0].intent).toBe("a6");
    expect(list[4].intent).toBe("a2");
  });

  it("clicking a chip restores its intent + type back into the form", () => {
    loadBookmarklet();
    click(document.getElementById("desc"));
    copyAfter("旧需求", "summarize");
    copyAfter("新需求", "debug");

    // Click the second (older) chip to restore "旧需求 / summarize"
    const chips = document.querySelectorAll(".ca-history-chip");
    chips[1].dispatchEvent(new window.MouseEvent("click", { bubbles: true }));

    expect(document.querySelector(".ca-intent").value).toBe("旧需求");
    expect(document.querySelector(".ca-type").value).toBe("summarize");
  });

  it("clicking the chip's × button removes it from UI and storage", () => {
    loadBookmarklet();
    click(document.getElementById("desc"));
    copyAfter("待删除");
    expect(readHistory().length).toBe(1);

    const del = document.querySelector(".ca-history-chip-del");
    del.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));

    expect(readHistory().length).toBe(0);
    expect(document.querySelectorAll(".ca-history-chip").length).toBe(0);
    expect(document.querySelector(".ca-history-empty")).not.toBeNull();
  });
});
