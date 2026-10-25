import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";
import assert from "node:assert/strict";

const root = process.cwd();

function listHtml(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listHtml(fullPath));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) files.push(fullPath);
  }
  return files;
}

const htmlFiles = listHtml(root);

test("los scripts JavaScript incrustados en HTML tienen sintaxis válida", () => {
  const failures = [];
  for (const file of htmlFiles) {
    const html = fs.readFileSync(file, "utf8");
    const scripts = html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi);
    let scriptIndex = 0;
    for (const match of scripts) {
      scriptIndex++;
      if (/\bsrc\s*=/i.test(match[1]) || !match[2].trim()) continue;
      try {
        new vm.Script(match[2], { filename: path.relative(root, file) + "#script-" + scriptIndex });
      } catch (error) {
        failures.push(path.relative(root, file) + " (script " + scriptIndex + "): " + error.message);
      }
    }
  }
  assert.deepEqual(failures, [], failures.join("\n"));
});

test("los enlaces relativos locales de HTML apuntan a archivos existentes", () => {
  const failures = [];
  for (const file of htmlFiles) {
    const html = fs.readFileSync(file, "utf8");
    for (const match of html.matchAll(/\bhref\s*=\s*["']([^"']+)["']/gi)) {
      const href = match[1].trim();
      if (!href || href.startsWith("#") || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href)) continue;
      const rawPath = href.split(/[?#]/, 1)[0];
      if (!rawPath) continue;
      let decoded;
      try { decoded = decodeURIComponent(rawPath); }
      catch { failures.push(path.relative(root, file) + " -> " + href + " (URL mal codificada)"); continue; }
      const target = path.resolve(path.dirname(file), decoded);
      const rootResolved = path.resolve(root);
      if (target !== rootResolved && !target.startsWith(rootResolved + path.sep)) {
        failures.push(path.relative(root, file) + " -> " + href + " (sale de la carpeta del proyecto)");
        continue;
      }
      if (!fs.existsSync(target) && !fs.existsSync(path.join(target, "index.html"))) {
        failures.push(path.relative(root, file) + " -> " + href);
      }
    }
  }
  assert.deepEqual(failures, [], failures.join("\n"));
});
