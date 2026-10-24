import { describe, expect, test } from "bun:test";
import { renderMarkdown } from "./markdown";

describe("renderMarkdown", () => {
  test("keeps raw html as text and does not emit anchors or images", () => {
    const html = renderMarkdown([
      "<script>alert(1)</script>",
      "",
      '<img src="x" onerror="alert(1)">',
      "",
      "[leave](https://example.com)",
      "",
      "![shot](https://example.com/a.png)",
      "",
      "**bold**",
    ].join("\n"));
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<a");
    expect(html).not.toContain("href=");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("leave");
    expect(html).toContain("shot");
    expect(html).not.toContain("example.com");
    expect(html).toContain("<strong>bold</strong>");
  });
});
