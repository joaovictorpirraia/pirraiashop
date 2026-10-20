import { test } from "node:test";
import assert from "node:assert/strict";
import { montarProps, reelProps } from "../remotion/props";

const row = {
  id: 7,
  titulo: "Carregador turbo 20W",
  preco: "39.90",
  preco_antigo: "79.90",
  desconto_pct: 50,
  imagem_url: "https://x/y.jpg",
  categoria: "eletronicos",
  short_url: "https://s.shopee.com.br/abc",
};

test("mapeia row do banco e coage numéricos string", () => {
  const p = montarProps(row, "data:image/jpeg;base64,AAAA");
  assert.equal(p.preco, 39.9);
  assert.equal(p.precoAntigo, 79.9);
  assert.equal(p.loja, "shopee");
  assert.equal(p.imagem, "data:image/jpeg;base64,AAAA");
  assert.equal(reelProps.safeParse(p).success, true);
});

test("aceita desconto e preço antigo nulos", () => {
  const p = montarProps({ ...row, preco_antigo: null, desconto_pct: null }, "data:image/jpeg;base64,AAAA");
  assert.equal(p.precoAntigo, null);
  assert.equal(p.descontoPct, null);
  assert.equal(reelProps.safeParse(p).success, true);
});
