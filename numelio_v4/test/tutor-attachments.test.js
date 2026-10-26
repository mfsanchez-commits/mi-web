import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const server = fs.readFileSync(path.join(process.cwd(), "server.js"), "utf8");
const tutorPage = fs.readFileSync(path.join(process.cwd(), "profesor.html"), "utf8");

test("el profesor admite adjuntos con límites y validación de contenido", () => {
  assert.ok(server.includes('app.post("/api/tutor-chat", requireTutorAccount, upload.single("file")'));
  assert.ok(server.includes('checkDailyGenerationLimit(req, res, "tutor_reply")'));
  assert.ok(server.includes("validFileContent(req.file, buffer)"));
  assert.ok(server.includes("fileSize: 10 * 1024 * 1024"));
  assert.ok(server.includes("media_type: req.file.mimetype"));
  assert.ok(server.includes("if (uploadedPath) fs.unlink(uploadedPath"));
});

test("la extracción de PDF normaliza espacios y la interfaz envía el archivo", () => {
  assert.ok(server.includes('replace(/\\s+/g, " ")'));
  assert.ok(server.includes("Texto extraído del PDF adjunto:\\n"));
  assert.ok(!server.includes('replace(/\\\\s+/g'));
  assert.ok(tutorPage.includes('id="tutorFile" type="file"'));
  assert.ok(tutorPage.includes("new FormData()"));
  assert.ok(tutorPage.includes('payload.append("file",file,file.name)'));
});
