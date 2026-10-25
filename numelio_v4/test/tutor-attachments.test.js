import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const server = fs.readFileSync(path.join(process.cwd(), "server.js"), "utf8");
const tutorPage = fs.readFileSync(path.join(process.cwd(), "profesor.html"), "utf8");

test("el profesor admite adjuntos con límites y validación de contenido", () => {
  assert.match(server, /app\.post\(["']\/api\/tutor-chat["'][\s\S]*?upload\.single\(["']file["']\)/);
  assert.match(server, /validFileContent\(req\.file, buffer\)/);
  assert.match(server, /fileSize:\s*10\s*\*\s*1024\s*\*\s*1024/);
  assert.match(server, /media_type:\s*req\.file\.mimetype/);
  assert.match(server, /if \(uploadedPath\) fs\.unlink\(uploadedPath/);
});

test("el texto extraído de PDF normaliza espacios y el contexto usa saltos de línea reales", () => {
  assert.match(server, /parsed\.text \|\| ""\)\.replace\(/\\s\+\/g, " "\)/);
  assert.match(server, /Texto extraído del PDF adjunto:\\n/);
  assert.doesNotMatch(server, /replace\(\/\\\\s\+\/g/);
  assert.match(tutorPage, /id="tutorFile" type="file"/);
  assert.match(tutorPage, /new FormData\(\)/);
  assert.match(tutorPage, /payload\.append\("file",file,file\.name\)/);
});
