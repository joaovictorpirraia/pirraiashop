import { test } from "node:test";
import assert from "node:assert/strict";
import { anexarCor } from "../lib/whatsapp";

const BASE =
  "https://wa.me/5581992274919?text=Oi!%20Quero%20encomendar%20em%203D%3A%20Mini%20Jesus.%20Vim%20pelo%20pirraiashop.";

test("anexa a cor ao texto da mensagem", () => {
  const out = anexarCor(BASE, "Azul");
  const u = new URL(out);
  assert.ok(u.searchParams.get("text")!.endsWith("Vim pelo pirraiashop. Cor: Azul."));
});

test("sem cor devolve a URL original", () => {
  assert.equal(anexarCor(BASE, null), BASE);
  assert.equal(anexarCor(BASE, ""), BASE);
});

test("URL não-wa.me volta sem mexer", () => {
  assert.equal(anexarCor("https://exemplo.com", "Azul"), "https://exemplo.com");
});
