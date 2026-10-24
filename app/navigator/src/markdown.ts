import MarkdownIt from "markdown-it";

const markdown = new MarkdownIt({ html: false, linkify: false, breaks: false });

markdown.renderer.rules.link_open = () => "";
markdown.renderer.rules.link_close = () => "";
markdown.renderer.rules.image = (tokens, idx) => escapeHtml(tokens[idx]?.content ?? "");

/** Render stage markdown. Raw HTML stays text, and links are not anchors. */
export function renderMarkdown(source: string): string {
  return markdown.render(source);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
