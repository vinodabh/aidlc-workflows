import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { contrastRatio, themes } from "./theme";

describe("themes", () => {
  test("keeps body text and the next-action control readable in both themes", () => {
    const css = readFileSync(join(import.meta.dir, "renderer.css"), "utf8");
    expect(css).toContain('[data-theme="dark"]');
    expect(css).toContain('[data-theme="system"]');
    expect(css).toContain("prefers-color-scheme: dark");
    expect(css).toContain("var(--accent)");
    expect(css).toContain("var(--accent-text)");
    for (const palette of [themes.light, themes.dark]) {
      expect(contrastRatio(palette.text, palette.bg)).toBeGreaterThan(7);
      expect(contrastRatio(palette.text, palette.panel)).toBeGreaterThan(7);
      expect(contrastRatio(palette.muted, palette.bg)).toBeGreaterThan(4.5);
      expect(contrastRatio(palette.accentText, palette.accent)).toBeGreaterThan(4.5);
      for (const color of Object.values(palette)) expect(css).toContain(color);
    }
  });
});