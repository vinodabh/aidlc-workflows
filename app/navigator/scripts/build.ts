import { cpSync, existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const dist = join(root, "dist");
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const main = await Bun.build({
  entrypoints: [join(root, "src/main.ts")],
  outdir: dist,
  target: "node",
  format: "esm",
  external: ["electron"],
});
const preload = await Bun.build({
  entrypoints: [join(root, "src/preload.ts")],
  outdir: dist,
  target: "node",
  format: "cjs",
  external: ["electron"],
});
const renderer = await Bun.build({
  entrypoints: [join(root, "src/renderer.ts")],
  outdir: dist,
  target: "browser",
  format: "esm",
});

const failed = [main, preload, renderer].filter((result) => !result.success);
if (failed.length > 0) {
  for (const result of failed) console.error(result.logs);
  process.exit(1);
}

const preloadJs = join(dist, "preload.js");
if (existsSync(preloadJs)) renameSync(preloadJs, join(dist, "preload.cjs"));
cpSync(join(root, "src/index.html"), join(dist, "index.html"));
cpSync(join(root, "src/renderer.css"), join(dist, "renderer.css"));
