import { realpathSync, statSync } from "node:fs";
import { isAbsolute, relative, sep } from "node:path";

export const windowSecurity = {
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
} as const;

export const contentSecurityPolicy =
  "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'";

/** A markdown file that stays inside the project after links are resolved. */
export function containedMarkdown(projectRoot: string, candidate: string): string | null {
  try {
    const root = realpathSync(projectRoot);
    const file = realpathSync(candidate);
    if (!statSync(file).isFile()) return null;
    if (!file.endsWith(".md")) return null;
    const rel = relative(root, file);
    if (!rel || isAbsolute(rel)) return null;
    if (rel.split(sep).includes("..")) return null;
    return file;
  } catch {
    return null;
  }
}
