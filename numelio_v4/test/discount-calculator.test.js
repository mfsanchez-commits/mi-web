import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";
import assert from "node:assert/strict";

const htmlPath = path.join(process.cwd(), "matematicas", "descuentos.html");
const html = fs.readFileSync(htmlPath, "utf8");
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
  .filter(match => !/\bsrc\s*=/.test(match[1]) && match[2].trim());
const calculatorScript = scripts.at(-1)?.[2];

assert.ok(calculatorScript, "La calculadora debe tener un script JavaScript incrustado");

function runCalculator(price, discount) {
  const elements = {
    go: { onclick: null },
    price: { value: price },
    disc: { value: discount },
    r: { hidden: true, textContent: "", innerHTML: "" }
  };
  const document = { getElementById: id => elements[id] };
  vm.runInNewContext(calculatorScript, { document });
  elements.go.onclick();
  return elements.r;
}

test("calcula correctamente un descuento y el ahorro", () => {
  const result = runCalculator("100", "20");
  assert.equal(result.hidden, false);
  assert.match(result.innerHTML, /80\.00 €/);
  assert.match(result.innerHTML, /Ahorras 20\.00 €/);
});

test("acepta decimales con coma y con punto", () => {
  assert.match(runCalculator("12,50", "10").innerHTML, /11\.25 €/);
  assert.match(runCalculator("12.50", "10").innerHTML, /11\.25 €/);
});

test("acepta descuentos de 0 % y 100 %", () => {
  assert.match(runCalculator("50", "0").innerHTML, /50\.00 €/);
  assert.match(runCalculator("50", "100").innerHTML, /0\.00 €/);
});

test("rechaza precios negativos y descuentos fuera del rango", () => {
  for (const [price, discount] of [["-1", "10"], ["10", "-1"], ["10", "101"], ["", "10"], ["abc", "10"]]) {
    const result = runCalculator(price, discount);
    assert.equal(result.hidden, false);
    assert.match(result.textContent, /Introduce un precio/);
    assert.equal(result.innerHTML, "");
  }
});
