import { spawn } from "node:child_process";
import { once } from "node:events";
import net from "node:net";
import test, { before, after } from "node:test";
import assert from "node:assert/strict";

let child;
let baseUrl;

async function freePort() {
  const probe = net.createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const { port } = probe.address();
  await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
  return port;
}

before(async () => {
  const port = await freePort();
  baseUrl = "http://127.0.0.1:" + port;
  child = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
      ANTHROPIC_API_KEY: "test-key-not-valid",
      SUPABASE_URL: "",
      SUPABASE_PUBLISHABLE_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: ""
    },
    stdio: "ignore"
  });

  let lastError;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (child.exitCode !== null) throw new Error("El servidor terminó antes de arrancar.");
    try {
      const response = await fetch(baseUrl + "/");
      if (response.ok) return;
      lastError = new Error("El servidor respondió " + response.status);
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw lastError || new Error("El servidor no arrancó a tiempo.");
});

after(async () => {
  if (child && child.exitCode === null) {
    child.kill("SIGTERM");
    await Promise.race([
      once(child, "exit"),
      new Promise(resolve => setTimeout(resolve, 2000))
    ]);
    if (child.exitCode === null) child.kill("SIGKILL");
  }
});

test("la portada y los recursos públicos se sirven", async () => {
  for (const path of ["/", "/index.html", "/css/style.css", "/js/app.js"]) {
    const response = await fetch(baseUrl + path);
    assert.equal(response.status, 200, path + " debería estar disponible");
  }
});

test("las respuestas incluyen cabeceras HTTP de seguridad", async () => {
  const response = await fetch(baseUrl + "/");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.match(response.headers.get("permissions-policy") || "", /camera=\(\)/);
});

test("el servidor no autoriza orígenes web desconocidos", async () => {
  const response = await fetch(baseUrl + "/", {
    headers: { Origin: "https://sitio-no-autorizado.example" }
  });
  assert.equal(response.status, 400);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
});

test("la comprobación de salud responde sin exponer configuración", async () => {
  const response = await fetch(baseUrl + "/health");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok" });
});

test("los archivos internos del proyecto no son públicos", async () => {
  for (const path of [
    "/server.js",
    "/package.json",
    "/package-lock.json",
    "/README.md",
    "/.env",
    "/.env.example",
    "/supabase/generation_usage.sql",
    "/node_modules/express/package.json",
    "/uploads/test.png",
    "/tests/example.js",
    "/unknown.bin"
  ]) {
    const response = await fetch(baseUrl + path);
    assert.equal(response.status, 404, path + " debería estar bloqueado");
  }
});

test("la API falla de forma segura si falta la configuración del límite de IA en producción", async () => {
  const response = await fetch(baseUrl + "/api/grade-exam", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questions: [{ type: "choice", question: "2+2?", options: ["2", "3", "4", "5"], answer: 2 }], answers: [2] })
  });
  assert.equal(response.status, 503);
  const data = await response.json();
  assert.match(data.error, /control de uso no está configurado/i);
});

test("la corrección rechaza exámenes mal formados antes de consumir cuota", async () => {
  const response = await fetch(baseUrl + "/api/grade-exam", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questions: [], answers: [] })
  });
  assert.equal(response.status, 400);
  const data = await response.json();
  assert.match(data.error, /entre 1 y 20 preguntas/i);
});

test("la corrección oral rechaza respuestas demasiado largas antes de consumir cuota", async () => {
  const response = await fetch(baseUrl + "/api/grade-oral-answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: "Pregunta", answer: "x".repeat(4001) })
  });
  assert.equal(response.status, 400);
  const data = await response.json();
  assert.match(data.error, /formato válido|superan el límite/i);
});

test("las rutas codificadas a archivos internos tampoco son públicas", async () => {
  for (const path of ["/%73erver.js", "/supabase%2Fgeneration_usage.sql"]) {
    const response = await fetch(baseUrl + path);
    assert.equal(response.status, 404, path + " debería estar bloqueado");
  }
});


test("la corrección escrita rechaza respuestas que no corresponden a las preguntas", async () => {
  const response = await fetch(baseUrl + "/api/grade-exam", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      questions: [{ type: "choice", question: "2+2?", options: ["1", "2", "3", "4"], answer: 3 }],
      answers: []
    })
  });
  assert.equal(response.status, 400);
  const data = await response.json();
  assert.match(data.error, /una respuesta por pregunta/i);
});

test("la corrección escrita rechaza índices de respuesta fuera de rango", async () => {
  const response = await fetch(baseUrl + "/api/grade-exam", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      questions: [{ type: "choice", question: "2+2?", options: ["1", "2", "3", "4"], answer: 4 }],
      answers: [4]
    })
  });
  assert.equal(response.status, 400);
  const data = await response.json();
  assert.match(data.error, /datos no válidos/i);
});

test("la corrección oral rechaza criterios de evaluación con tipos incorrectos", async () => {
  const response = await fetch(baseUrl + "/api/grade-oral-answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: "Explica la fotosíntesis", answer: "Proceso vegetal", keyPoints: "no es una lista" })
  });
  assert.equal(response.status, 400);
  const data = await response.json();
  assert.match(data.error, /formato válido|superan el límite/i);
});

test("la API de tutoría exige una sesión de usuario", async () => {
  const response = await fetch(baseUrl + "/api/tutor-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Hola" })
  });
  assert.equal(response.status, 401);
  const data = await response.json();
  assert.match(data.error, /inicia sesión|cuenta/i);
});
