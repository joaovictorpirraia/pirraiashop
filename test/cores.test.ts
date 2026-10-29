import { test } from "node:test";
import assert from "node:assert/strict";
import { PALETTE, corLabel, coresDoProduto } from "../lib/cores";

test("palette tem as cores base com hex", () => {
  assert.equal(PALETTE.vermelho.hex, "#DC2626");
  assert.equal(PALETTE.azul.label, "Azul");
});

test("corLabel devolve o label ou a própria chave se desconhecida", () => {
  assert.equal(corLabel("verde"), "Verde");
  assert.equal(corLabel("inexistente"), "inexistente");
});

test("coresDoProduto filtra chaves válidas e preserva ordem", () => {
  assert.deepEqual(
    coresDoProduto(["azul", "xpto", "vermelho"]),
    [
      { chave: "azul", label: "Azul", hex: "#2563EB" },
      { chave: "vermelho", label: "Vermelho", hex: "#DC2626" },
    ],
  );
  assert.deepEqual(coresDoProduto(null), []);
});
