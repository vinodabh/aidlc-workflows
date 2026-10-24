import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { containedMarkdown, contentSecurityPolicy, windowSecurity } from "./security";

describe("window security", () => {
  test("isolates the page from the desktop runtime", () => {
    expect(windowSecurity).toEqual({ contextIsolation: true, nodeIntegration: false, sandbox: true });
    const html = readFileSync(join(import.meta.dir, "index.html"), "utf8");
    expect(html).toContain(contentSecurityPolicy);
  });

  test("reads markdown inside the project and rejects escapes", () => {
    const root = mkdtempSync(join(tmpdir(), "nav-"));
    const project = join(root, "project");
    const docs = join(project, "docs");
    mkdirSync(docs, { recursive: true });
    const inside = join(docs, "note.md");
    const outside = join(root, "outside.md");
    writeFileSync(inside, "# Hi");
    writeFileSync(join(docs, "note.txt"), "no");
    writeFileSync(outside, "# Out");
    mkdirSync(join(docs, "dir.md"));
    symlinkSync(outside, join(docs, "link.md"));
    expect(containedMarkdown(project, inside)).toBe(inside);
    expect(containedMarkdown(project, join(docs, "note.txt"))).toBeNull();
    expect(containedMarkdown(project, outside)).toBeNull();
    expect(containedMarkdown(project, join(docs, "..", "..", "outside.md"))).toBeNull();
    expect(containedMarkdown(project, join(docs, "link.md"))).toBeNull();
    expect(containedMarkdown(project, join(docs, "dir.md"))).toBeNull();
    rmSync(root, { recursive: true, force: true });
  });
});
