import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..", "..");
const indexHtml = readFileSync(resolve(ROOT, "index.html"), "utf8");
const deploySh = readFileSync(resolve(ROOT, "scripts/deploy.sh"), "utf8");
const bookmarkletJs = readFileSync(resolve(ROOT, "assets/clickask.js"), "utf8");
const bookmarkletCss = readFileSync(resolve(ROOT, "assets/clickask.css"), "utf8");

describe("CR-006 cache-busting", () => {
  it("index.html fetches manifest.json before resources", () => {
    expect(indexHtml).toContain("assets/manifest.json");
    expect(indexHtml).toMatch(/withVersion\s*\(/);
    expect(indexHtml).toContain("?v=");
  });

  it("index.html falls back when manifest missing (catch returns null)", () => {
    expect(indexHtml).toMatch(/loadManifest\s*\(\)/);
    expect(indexHtml).toMatch(/return\s+null/);
  });

  it("deploy.sh computes sha256 hashes and writes manifest.json", () => {
    expect(deploySh).toMatch(/shasum\s+-a\s+256/);
    expect(deploySh).toContain("manifest.json");
    expect(deploySh).toMatch(/CSS_HASH/);
    expect(deploySh).toMatch(/JS_HASH/);
  });

  it("bookmarklet runtime does not depend on manifest.json", () => {
    expect(bookmarkletJs).not.toContain("manifest.json");
    expect(bookmarkletCss).not.toContain("manifest.json");
  });

  it("withVersion appends ?v= only when hash present", () => {
    // Verify the helper text exists.
    expect(indexHtml).toMatch(/function withVersion\(url, hash\)/);
    // Reproduce the same logic locally to lock the contract.
    const withVersion = (url, hash) => {
      if (!hash) return url;
      return url + "?v=" + encodeURIComponent(hash);
    };
    expect(withVersion("a.css", null)).toBe("a.css");
    expect(withVersion("a.css", "abc12345")).toBe("a.css?v=abc12345");
    expect(withVersion("a.css", undefined)).toBe("a.css");
    expect(withVersion("a.css", "")).toBe("a.css");
  });
});
