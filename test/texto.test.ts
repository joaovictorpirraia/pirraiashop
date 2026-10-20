import { test } from "node:test";
import assert from "node:assert/strict";
import { quebrarEmLinhas } from "../lib/texto";

test("quebra em linhas de até maxChars", () => {
  const r = quebrarEmLinhas("Carregador turbo 20W bivolt", { maxChars: 12, maxLinhas: 2 });
  assert.deepEqual(r, ["Carregador", "turbo 20W"]);
});

test("respeita maxLinhas e corta o excedente", () => {
  const r = quebrarEmLinhas("uma duas tres quatro cinco seis", { maxChars: 8, maxLinhas: 2 });
  assert.equal(r.length, 2);
});

test("trunca com reticências quando passa de limiteTotal", () => {
  const r = quebrarEmLinhas("A".repeat(60), { maxChars: 30, maxLinhas: 2, limiteTotal: 46 });
  assert.ok(r.join("").endsWith("…"));
  assert.ok(r.join("").length <= 47);
});

test("texto vazio vira lista vazia", () => {
  assert.deepEqual(quebrarEmLinhas("", { maxChars: 10, maxLinhas: 2 }), []);
});
