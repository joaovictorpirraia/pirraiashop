import { test } from "node:test";
import assert from "node:assert/strict";
import { lojaDeUrl } from "../lib/loja";

test("reconhece cada loja", () => {
  assert.equal(lojaDeUrl("https://s.shopee.com.br/abc"), "shopee");
  assert.equal(lojaDeUrl("https://s.click.aliexpress.com/e/_x"), "aliexpress");
  assert.equal(lojaDeUrl("https://mercadolivre.com/sec/xyz"), "mercadolivre");
  assert.equal(lojaDeUrl("https://vt.tiktok.com/zz"), "tiktok");
  assert.equal(lojaDeUrl("https://wa.me/55999999999"), "whatsapp");
});

test("default é shopee quando não bate nada", () => {
  assert.equal(lojaDeUrl("https://exemplo.com/x"), "shopee");
  assert.equal(lojaDeUrl(null), "shopee");
});
