import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
    '<p id="para">first paragraph with some text</p></main>';
}

function clickElement(el) {
  el.dispatchEvent(
    new window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })
  );
}

describe("CR-001 launch buttons", () => {
  beforeEach(() => resetDom());
  afterEach(() => resetDom());

  it("renders 5 AI launch buttons, all disabled before selection", () => {
    loadBookmarklet();
    const btns = document.querySelectorAll(".ca-launch-btn");
    expect(btns.length).toBe(5);
    const ids = Array.from(btns).map((b) => b.getAttribute("data-ca-tool"));
    expect(ids).toEqual(["chatgpt", "claude", "gemini", "kimi", "doubao"]);
    btns.forEach((b) => expect(b.disabled).toBe(true));
  });

  it("enables buttons after a meaningful element is selected", () => {
    loadBookmarklet();
    clickElement(document.getElementById("title"));
    const btns = document.querySelectorAll(".ca-launch-btn");
    expect(document.querySelectorAll(".ca-tag").length).toBeGreaterThan(0);
    btns.forEach((b) => expect(b.disabled).toBe(false));
  });

  it("clicking ChatGPT writes the prompt and opens chat.openai.com in a new tab", async () => {
    loadBookmarklet();
    clickElement(document.getElementById("title"));

    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(window.navigator, "clipboard", {
      value: { writeText },
      configurable: true
    });
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);

    const chatgpt = document.querySelector('.ca-launch-btn[data-ca-tool="chatgpt"]');
    clickElement(chatgpt);

    expect(writeText).toHaveBeenCalledTimes(1);
    const written = writeText.mock.calls[0][0];
    expect(typeof written).toBe("string");
    expect(written.length).toBeGreaterThan(50);
    expect(written).toMatch(/Page Context Question|页面上下文提问/);

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy.mock.calls[0][0]).toBe("https://chat.openai.com/");
    expect(openSpy.mock.calls[0][1]).toBe("_blank");
    expect(openSpy.mock.calls[0][2]).toContain("noopener");
  });

  it("clicking a disabled button is a no-op (does not call window.open)", () => {
    loadBookmarklet();
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    const claude = document.querySelector('.ca-launch-btn[data-ca-tool="claude"]');
    // Native disabled buttons do not dispatch click events when clicked via UA,
    // but jsdom will still fire if we dispatch programmatically. Verify the
    // handler bails out because selectedElements is empty.
    clickElement(claude);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("opens different URLs for each AI tool", () => {
    loadBookmarklet();
    clickElement(document.getElementById("title"));
    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(window.navigator, "clipboard", {
      value: { writeText },
      configurable: true
    });
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    const expected = {
      chatgpt: "https://chat.openai.com/",
      claude: "https://claude.ai/new",
      gemini: "https://gemini.google.com/app",
      kimi: "https://www.kimi.com/",
      doubao: "https://www.doubao.com/"
    };
    Object.entries(expected).forEach(([id, url], idx) => {
      const btn = document.querySelector(`.ca-launch-btn[data-ca-tool="${id}"]`);
      clickElement(btn);
      expect(openSpy.mock.calls[idx][0]).toBe(url);
    });
  });
});
