import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, sep } from "node:path";

// A source Vite index.html needs a server and cannot be rendered as an artifact.
// Produce a self-contained, already-transpiled HTML for static file previews.
const root = resolve(fileURLToPath(new URL("../dist/", import.meta.url)));
const asset = async (path) => {
  const file = resolve(root, path);
  if (!file.startsWith(root + sep)) throw new Error(`Invalid asset path: ${path}`);
  return readFile(file, "utf8");
};
let html = await readFile(resolve(root, "index.html"), "utf8");
const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g)];
if (scripts.length !== 1) throw new Error("Expected one bundled application script");
for (const match of scripts) {
  const js = (await asset(match[1])).replace(/<\/script/gi, "<\\/script");
  html = html.replace(match[0], () => `<script type="module">${js}</script>`);
}
for (const match of [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)]) {
  const css = (await asset(match[1])).replace(/<\/style/gi, "<\\/style");
  html = html.replace(match[0], () => `<style>${css}</style>`);
}
const icon = Buffer.from(await asset("favicon.svg")).toString("base64");
html = html.replace('href="./favicon.svg"', `href="data:image/svg+xml;base64,${icon}"`);
if (/<(?:script|link)\b[^>]*(?:src|href)="\.?\.?\//.test(html)) {
  throw new Error("The standalone preview still references an external asset");
}
await writeFile(resolve(root, "preview.html"), html);
console.log("Standalone playable preview generated: dist/preview.html");
