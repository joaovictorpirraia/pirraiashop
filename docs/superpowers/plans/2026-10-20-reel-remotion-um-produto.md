# Reel de 1 produto em Remotion — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar 1 foto de produto num reel/comercial animado de ~10s (9:16, 1080×1920) em Remotion, renderizado localmente no PC do dono, fora do build do Next.

**Architecture:** Composição Remotion isolada em `remotion/` (nada vai pro `next build`). Um script CLI (`scripts/render-reel.ts`, rodado via `tsx`) lê o produto no Supabase, trata a foto reusando `lib/imagem.ts`, renderiza com `@remotion/renderer`, sobe em `videos/reel-foto-{id}.mp4` e grava a coluna nova `produtos.reel_foto_url`. O admin só exibe e baixa o que o script gerou.

**Tech Stack:** Remotion (React + spring), `@remotion/renderer`/`bundler`/`cli`, `zod` pro contrato das props, `tsx` pra rodar TS, test runner nativo do Node 24 (`node --test`), Supabase JS, Next 14 (admin).

**Spec:** `docs/superpowers/specs/2026-10-20-reel-remotion-um-produto-design.md`

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `remotion/index.ts` | `registerRoot(Root)` — entrada do bundle |
| `remotion/Root.tsx` | `<Composition id="ReelProduto" …>` ligada ao schema `reelProps` |
| `remotion/ReelProduto.tsx` | Orquestra as cenas por `<Sequence>`, recebe as props |
| `remotion/marca.ts` | Tokens: cores, fonte, fps, durações por cena (em frames), zonas seguras |
| `remotion/props.ts` | `reelProps` (zod) + `montarProps(row)` (row do banco → props validadas) |
| `remotion/cenas/FundoBorrado.tsx` | Foto borrada+escurecida cobrindo o 9:16 (atrás de tudo) |
| `remotion/cenas/FotoKenBurns.tsx` | Foto nítida centralizada com zoom lento contínuo |
| `remotion/cenas/Intro.tsx` | Abertura da marca (0–1,2s) |
| `remotion/cenas/Titulo.tsx` | Lower-third: título (até 2 linhas) + chip de categoria |
| `remotion/cenas/Preco.tsx` | Preço antigo riscado → preço novo com mola; inclui o `Selo` |
| `remotion/cenas/Selo.tsx` | Badge `-XX%` que pulsa uma vez |
| `remotion/cenas/CTA.tsx` | "link na bio" + badge da loja + wordmark |
| `remotion.config.ts` | Config de render (formato de imagem, overwrite) |
| `lib/texto.ts` | `quebrarEmLinhas()` — util de quebra de texto (puro, testável) |
| `lib/loja.ts` | `lojaDeUrl()` — deriva a loja a partir do short_url (puro, testável) |
| `scripts/render-reel.ts` | CLI de render local (modos id / --slug / --novos / --regerar) |
| `test/texto.test.ts` | Testes de `quebrarEmLinhas` |
| `test/loja.test.ts` | Testes de `lojaDeUrl` |
| `test/props.test.ts` | Testes de `montarProps` |
| `migrations/029_reel_foto.sql` | Coluna `produtos.reel_foto_url` |
| `app/admin/videos/page.tsx` | (modificar) exibir prévia + baixar do reel-foto |

**Regra de ouro:** nada em `remotion/` ou `scripts/` pode ser importado por código dentro de `app/` ou pela árvore do `next build`. O admin só **lê** a coluna `reel_foto_url` (string) — não importa o Remotion.

---

## Task 1: Dependências, scripts e scaffold do Remotion

**Files:**
- Modify: `package.json`
- Create: `remotion.config.ts`
- Create: `remotion/index.ts`
- Create: `remotion/Root.tsx`
- Create: `remotion/ReelProduto.tsx` (placeholder temporário)

- [ ] **Step 1: Instalar as dependências (todas devDependencies)**

Run:
```bash
npm i -D remotion @remotion/cli @remotion/bundler @remotion/renderer @remotion/google-fonts zod tsx
```
Expected: instala sem erro. (`zod` e `tsx` ficam em devDependencies — o runtime do Next não usa nenhum deles.)

- [ ] **Step 2: Adicionar os scripts no `package.json`**

Em `package.json`, dentro de `"scripts"`, adicione:
```json
"reel": "node --env-file-if-exists=.env.local --import tsx scripts/render-reel.ts",
"reel:studio": "remotion studio remotion/index.ts",
"test": "node --import tsx --test ./test/"
```

- [ ] **Step 3: Criar `remotion.config.ts`**

```ts
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setConcurrency(null); // deixa o Remotion decidir pelo nº de cores
```

- [ ] **Step 4: Criar `remotion/index.ts`**

```ts
import { registerRoot } from "remotion";
import { Root } from "./Root";

registerRoot(Root);
```

- [ ] **Step 5: Criar `remotion/ReelProduto.tsx` (placeholder)**

```tsx
import { AbsoluteFill } from "remotion";

export function ReelProduto() {
  return <AbsoluteFill style={{ backgroundColor: "#1B1512" }} />;
}
```

- [ ] **Step 6: Criar `remotion/Root.tsx`**

```tsx
import { Composition } from "remotion";
import { ReelProduto } from "./ReelProduto";

export function Root() {
  return (
    <Composition
      id="ReelProduto"
      component={ReelProduto}
      durationInFrames={300}
      fps={30}
      width={1080}
      height={1920}
    />
  );
}
```

- [ ] **Step 7: Verificar que o Studio abre**

Run: `npm run reel:studio`
Expected: abre o Remotion Studio no navegador com a composição "ReelProduto" (tela tinta). Feche com Ctrl+C.

- [ ] **Step 8: Verificar que o build do Next segue intocado**

Run: `npm run build`
Expected: `next build` passa sem erro e sem mencionar `remotion/` nem `scripts/` (não estão na árvore do app).

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json remotion.config.ts remotion/
git commit -m "chore: scaffold Remotion isolado do build do Next"
```

---

## Task 2: Migration — coluna `reel_foto_url`

**Files:**
- Create: `migrations/029_reel_foto.sql`

- [ ] **Step 1: Criar a migration**

`migrations/029_reel_foto.sql`:
```sql
-- 029 — reel gerado da FOTO (Remotion), distinto de video_reel_url (reel do video cru)
alter table produtos add column if not exists reel_foto_url text;
comment on column produtos.reel_foto_url is
  'Reel 9:16 gerado da foto do produto via Remotion (render local). Distinto de video_reel_url (reel do video cru pelo ffmpeg).';
```

- [ ] **Step 2: Aplicar no Supabase**

Rode o conteúdo da migration no SQL Editor do Supabase (projeto `wxrmjkxiuflvbqspauao`), ou via MCP do Supabase (`apply_migration`, name `029_reel_foto`).
Expected: coluna criada.

- [ ] **Step 3: Verificar a coluna**

Run (SQL Editor ou MCP `execute_sql`):
```sql
select column_name from information_schema.columns
where table_name = 'produtos' and column_name = 'reel_foto_url';
```
Expected: 1 linha (`reel_foto_url`).

- [ ] **Step 4: Commit**

```bash
git add migrations/029_reel_foto.sql
git commit -m "feat: coluna produtos.reel_foto_url (reel gerado da foto)"
```

---

## Task 3: `lib/texto.ts` — quebra de texto (TDD)

**Files:**
- Create: `lib/texto.ts`
- Test: `test/texto.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

`test/texto.test.ts`:
```ts
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `Cannot find module '../lib/texto'` (ou export inexistente).

- [ ] **Step 3: Implementar o mínimo**

`lib/texto.ts`:
```ts
export interface OpcoesQuebra {
  maxChars: number;
  maxLinhas: number;
  limiteTotal?: number;
}

/** Quebra um texto em linhas de ~maxChars, até maxLinhas; trunca com … no limiteTotal. */
export function quebrarEmLinhas(texto: string, opc: OpcoesQuebra): string[] {
  const base = (texto ?? "").trim();
  if (!base) return [];
  const t =
    opc.limiteTotal && base.length > opc.limiteTotal
      ? `${base.slice(0, opc.limiteTotal).trimEnd()}…`
      : base;

  const linhas: string[] = [];
  let atual = "";
  for (const p of t.split(/\s+/)) {
    if ((`${atual} ${p}`).trim().length > opc.maxChars && atual) {
      linhas.push(atual);
      atual = p;
    } else {
      atual = (`${atual} ${p}`).trim();
    }
    if (linhas.length === opc.maxLinhas) break;
  }
  if (atual && linhas.length < opc.maxLinhas) linhas.push(atual);
  return linhas.slice(0, opc.maxLinhas);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS nos 4 testes de texto.

- [ ] **Step 5: Commit**

```bash
git add lib/texto.ts test/texto.test.ts
git commit -m "feat: lib/texto quebrarEmLinhas (puro, testado)"
```

---

## Task 4: `lib/loja.ts` — derivar a loja do short_url (TDD)

**Files:**
- Create: `lib/loja.ts`
- Test: `test/loja.test.ts`

Mesma lógica do CASE da view `vitrine` (`when short_url ilike '%tiktok%' …`).

- [ ] **Step 1: Escrever o teste que falha**

`test/loja.test.ts`:
```ts
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — módulo/export inexistente.

- [ ] **Step 3: Implementar o mínimo**

`lib/loja.ts`:
```ts
export type Loja = "shopee" | "aliexpress" | "mercadolivre" | "tiktok" | "whatsapp";

/** Deriva a loja de destino a partir do short_url do link (espelha a view vitrine). */
export function lojaDeUrl(shortUrl: string | null | undefined): Loja {
  const u = (shortUrl ?? "").toLowerCase();
  if (u.includes("tiktok")) return "tiktok";
  if (u.includes("aliexpress")) return "aliexpress";
  if (u.includes("mercadolivre") || u.includes("mercadolibre") || u.includes("/sec/")) return "mercadolivre";
  if (u.includes("wa.me") || u.includes("whatsapp")) return "whatsapp";
  return "shopee";
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS nos testes de loja.

- [ ] **Step 5: Commit**

```bash
git add lib/loja.ts test/loja.test.ts
git commit -m "feat: lib/loja lojaDeUrl (puro, testado)"
```

---

## Task 5: `remotion/props.ts` — contrato e montagem das props (TDD)

**Files:**
- Create: `remotion/props.ts`
- Test: `test/props.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

`test/props.test.ts`:
```ts
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — módulo/export inexistente.

- [ ] **Step 3: Implementar**

`remotion/props.ts`:
```ts
import { z } from "zod";
import { lojaDeUrl } from "../lib/loja";

export const reelProps = z.object({
  titulo: z.string(),
  preco: z.number(),
  precoAntigo: z.number().nullable(),
  descontoPct: z.number().nullable(),
  imagem: z.string(), // data URI (JPEG/PNG) já tratado por lib/imagem.ts
  loja: z.enum(["shopee", "aliexpress", "mercadolivre", "tiktok", "whatsapp"]),
  categoria: z.string().nullable(),
});

export type ReelProps = z.infer<typeof reelProps>;

/** Linha mínima vinda do banco (produtos + short_url do link). */
export interface RowProduto {
  id: number;
  titulo: string;
  preco: string | number | null;
  preco_antigo: string | number | null;
  desconto_pct: number | null;
  imagem_url: string | null;
  categoria: string | null;
  short_url: string | null;
}

const num = (v: string | number | null): number => Number(v ?? 0) || 0;

/** Converte a row do banco + a foto já tratada (data URI) em props validáveis. */
export function montarProps(row: RowProduto, imagemDataUri: string): ReelProps {
  return {
    titulo: String(row.titulo ?? ""),
    preco: num(row.preco),
    precoAntigo: row.preco_antigo == null ? null : num(row.preco_antigo),
    descontoPct: row.desconto_pct == null ? null : Number(row.desconto_pct),
    imagem: imagemDataUri,
    loja: lojaDeUrl(row.short_url),
    categoria: row.categoria ?? null,
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS nos testes de props.

- [ ] **Step 5: Commit**

```bash
git add remotion/props.ts test/props.test.ts
git commit -m "feat: contrato zod + montarProps do reel"
```

---

## Task 6: `remotion/marca.ts` — tokens da marca

**Files:**
- Create: `remotion/marca.ts`

- [ ] **Step 1: Criar os tokens**

`remotion/marca.ts`:
```ts
import { loadFont as loadPoppins } from "@remotion/google-fonts/Poppins";

export const { fontFamily: POPPINS } = loadPoppins();

export const CORES = {
  marca: "#E5126A",
  marcaEscura: "#C20E5A",
  marcaTint: "#FCE3EE",
  tinta: "#1B1512",
  areia: "#FBF9F8",
  fumo: "#8B827C",
  branco: "#FFFFFF",
};

/** Cor do badge de cada loja (combina com os botões da vitrine). */
export const COR_LOJA: Record<string, string> = {
  shopee: "#EE4D2D",
  aliexpress: "#E62E04",
  mercadolivre: "#FFE600",
  tiktok: "#000000",
  whatsapp: "#25D366",
};

export const ROTULO_LOJA: Record<string, string> = {
  shopee: "Ver na Shopee",
  aliexpress: "Ver na AliExpress",
  mercadolivre: "Ver no Mercado Livre",
  tiktok: "Ver no TikTok",
  whatsapp: "Comprar no WhatsApp",
};

export const FPS = 30;

/** Marcos em frames (10s @30fps = 300). Ajustáveis no Studio. */
export const T = {
  introIn: 0,
  introOut: 36,     // 1,2s
  fotoIn: 24,       // 0,8s (começa antes do intro sair → crossfade)
  tituloIn: 48,     // 1,6s
  precoIn: 150,     // 5s
  seloIn: 165,      // 5,5s
  ctaIn: 240,       // 8s
  fim: 300,         // 10s
};

/** Zonas seguras do Reel/TikTok (px no canvas 1080×1920). */
export const SAFE = { topo: 120, base: 320, lateral: 60 };
```

- [ ] **Step 2: Verificar que compila no Studio**

Run: `npm run reel:studio`
Expected: Studio abre sem erro de import (a fonte Poppins baixa na primeira vez). Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add remotion/marca.ts
git commit -m "feat: tokens da marca pro reel (cores, Poppins, timings)"
```

---

## Task 7: Cenas de fundo e foto (FundoBorrado + FotoKenBurns)

**Files:**
- Create: `remotion/cenas/FundoBorrado.tsx`
- Create: `remotion/cenas/FotoKenBurns.tsx`

- [ ] **Step 1: Criar `FundoBorrado.tsx`**

```tsx
import { AbsoluteFill, Img } from "remotion";
import { CORES } from "../marca";

export function FundoBorrado({ imagem }: { imagem: string }) {
  return (
    <AbsoluteFill style={{ backgroundColor: CORES.tinta }}>
      <Img
        src={imagem}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: "blur(40px) brightness(0.45)",
          transform: "scale(1.2)",
        }}
      />
    </AbsoluteFill>
  );
}
```

- [ ] **Step 2: Criar `FotoKenBurns.tsx`**

```tsx
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";
import { T } from "../marca";

export function FotoKenBurns({ imagem }: { imagem: string }) {
  const frame = useCurrentFrame();
  const escala = interpolate(frame, [T.fotoIn, T.fim], [1.0, 1.12], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const entrada = interpolate(frame, [T.fotoIn, T.fotoIn + 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: entrada }}>
      <Img
        src={imagem}
        style={{
          width: "82%",
          maxHeight: "60%",
          objectFit: "contain",
          borderRadius: 28,
          transform: `scale(${escala})`,
        }}
      />
    </AbsoluteFill>
  );
}
```

- [ ] **Step 3: Verificar no Studio (fiação vem na Task 11)**

Sem fiação ainda; o check real é na Task 11. Garanta só que compila: `npm run reel:studio` abre sem erro. Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add remotion/cenas/FundoBorrado.tsx remotion/cenas/FotoKenBurns.tsx
git commit -m "feat: cenas de fundo borrado e foto com Ken Burns"
```

---

## Task 8: Cena do título (Titulo)

**Files:**
- Create: `remotion/cenas/Titulo.tsx`

- [ ] **Step 1: Criar `Titulo.tsx`**

```tsx
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CORES, POPPINS, SAFE, T } from "../marca";
import { quebrarEmLinhas } from "../../lib/texto";

export function Titulo({ titulo, categoria }: { titulo: string; categoria: string | null }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame - T.tituloIn;
  const s = spring({ frame: t, fps, config: { damping: 14, mass: 0.6 } });
  const linhas = quebrarEmLinhas(titulo, { maxChars: 22, maxLinhas: 2, limiteTotal: 46 });

  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", padding: SAFE.lateral, paddingTop: 300 }}>
      <div style={{ transform: `translateY(${(1 - s) * 40}px)`, opacity: s }}>
        {categoria && (
          <span
            style={{
              fontFamily: POPPINS,
              fontWeight: 700,
              fontSize: 30,
              color: CORES.branco,
              background: CORES.marca,
              padding: "8px 20px",
              borderRadius: 999,
            }}
          >
            {categoria}
          </span>
        )}
        <div
          style={{
            marginTop: 20,
            fontFamily: POPPINS,
            fontWeight: 800,
            fontSize: 72,
            lineHeight: 1.05,
            color: CORES.branco,
            textShadow: "0 2px 12px rgba(0,0,0,0.55)",
          }}
        >
          {linhas.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run reel:studio`
Expected: abre sem erro. Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add remotion/cenas/Titulo.tsx
git commit -m "feat: cena do título com entrada por mola"
```

---

## Task 9: Cena do preço + selo (Preco, Selo)

**Files:**
- Create: `remotion/cenas/Selo.tsx`
- Create: `remotion/cenas/Preco.tsx`

- [ ] **Step 1: Criar `Selo.tsx`**

```tsx
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CORES, POPPINS, T } from "../marca";

export function Selo({ descontoPct }: { descontoPct: number | null }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!descontoPct || descontoPct <= 0) return null;
  const t = frame - T.seloIn;
  const entrada = spring({ frame: t, fps, config: { damping: 10, mass: 0.5 } });
  // pulso único logo após entrar (frames 12–30 depois do seloIn)
  const pulso = 1 + 0.12 * Math.sin(interpolate(t, [12, 30], [0, Math.PI], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));

  return (
    <div
      style={{
        position: "absolute",
        top: 980,
        right: 70,
        width: 180,
        height: 180,
        borderRadius: "50%",
        background: CORES.marca,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        transform: `scale(${entrada * pulso})`,
        boxShadow: "0 8px 30px rgba(229,18,106,0.5)",
      }}
    >
      <span style={{ fontFamily: POPPINS, fontWeight: 800, fontSize: 60, color: CORES.branco, lineHeight: 1 }}>
        -{Math.round(descontoPct)}%
      </span>
      <span style={{ fontFamily: POPPINS, fontWeight: 700, fontSize: 26, color: CORES.marcaTint }}>OFF</span>
    </div>
  );
}
```

- [ ] **Step 2: Criar `Preco.tsx`**

```tsx
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CORES, POPPINS, SAFE, T } from "../marca";
import { Selo } from "./Selo";

const brl = (n: number) =>
  `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function Preco({
  preco,
  precoAntigo,
  descontoPct,
}: {
  preco: number;
  precoAntigo: number | null;
  descontoPct: number | null;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame - T.precoIn;
  // preço antigo entra e some; preço novo "bate" com overshoot
  const antigo = spring({ frame: t, fps, config: { damping: 18 } });
  const novo = spring({ frame: t - 12, fps, config: { damping: 9, mass: 0.7 } });

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", padding: SAFE.lateral, paddingBottom: SAFE.base }}>
      {precoAntigo && precoAntigo > preco && (
        <div
          style={{
            fontFamily: POPPINS,
            fontWeight: 700,
            fontSize: 40,
            color: CORES.fumo,
            textDecoration: "line-through",
            opacity: antigo,
          }}
        >
          {brl(precoAntigo)}
        </div>
      )}
      <div
        style={{
          fontFamily: POPPINS,
          fontWeight: 800,
          fontSize: 132,
          color: CORES.branco,
          lineHeight: 1,
          textShadow: "0 3px 16px rgba(0,0,0,0.55)",
          transform: `scale(${novo})`,
          transformOrigin: "left bottom",
        }}
      >
        {brl(preco)}
      </div>
      <Selo descontoPct={descontoPct} />
    </AbsoluteFill>
  );
}
```

- [ ] **Step 3: Verificar que compila**

Run: `npm run reel:studio`
Expected: abre sem erro. Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add remotion/cenas/Selo.tsx remotion/cenas/Preco.tsx
git commit -m "feat: cena do preço com batida + selo de desconto"
```

---

## Task 10: Cena da intro e da chamada final (Intro, CTA)

**Files:**
- Create: `remotion/cenas/Intro.tsx`
- Create: `remotion/cenas/CTA.tsx`

- [ ] **Step 1: Criar `Intro.tsx`**

```tsx
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CORES, POPPINS, T } from "../marca";

export function Intro() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 12, mass: 0.6 } });
  const saida = interpolate(frame, [T.introOut - 10, T.introOut], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{ backgroundColor: CORES.marca, justifyContent: "center", alignItems: "center", opacity: saida }}
    >
      <div style={{ transform: `scale(${s})`, textAlign: "center" }}>
        <div style={{ fontFamily: POPPINS, fontWeight: 800, fontSize: 92, color: CORES.branco }}>pirraiashop</div>
        <div style={{ fontFamily: POPPINS, fontWeight: 600, fontSize: 40, color: CORES.marcaTint, marginTop: 8 }}>
          achadinho do dia
        </div>
      </div>
    </AbsoluteFill>
  );
}
```

- [ ] **Step 2: Criar `CTA.tsx`**

```tsx
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CORES, COR_LOJA, POPPINS, ROTULO_LOJA, T } from "../marca";

export function CTA({ loja }: { loja: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame - T.ctaIn;
  const s = spring({ frame: t, fps, config: { damping: 13, mass: 0.6 } });
  const corBadge = COR_LOJA[loja] ?? CORES.marca;
  const corTexto = loja === "mercadolivre" ? "#2D3277" : CORES.branco;

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: s }}>
      <div style={{ transform: `translateY(${(1 - s) * 30}px)`, textAlign: "center" }}>
        <div style={{ fontFamily: POPPINS, fontWeight: 800, fontSize: 68, color: CORES.marca }}>link na bio</div>
        <div
          style={{
            marginTop: 24,
            fontFamily: POPPINS,
            fontWeight: 800,
            fontSize: 40,
            color: corTexto,
            background: corBadge,
            padding: "18px 44px",
            borderRadius: 999,
            display: "inline-block",
          }}
        >
          {ROTULO_LOJA[loja] ?? "Ver na loja"}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 140,
          fontFamily: POPPINS,
          fontWeight: 700,
          fontSize: 34,
          color: CORES.branco,
          opacity: 0.85,
        }}
      >
        pirraiashop
      </div>
    </AbsoluteFill>
  );
}
```

- [ ] **Step 3: Verificar que compila**

Run: `npm run reel:studio`
Expected: abre sem erro. Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add remotion/cenas/Intro.tsx remotion/cenas/CTA.tsx
git commit -m "feat: cenas de intro e chamada final"
```

---

## Task 11: Orquestração (ReelProduto) + ligar o schema

**Files:**
- Modify: `remotion/ReelProduto.tsx` (substitui o placeholder)
- Modify: `remotion/Root.tsx`

- [ ] **Step 1: Reescrever `remotion/ReelProduto.tsx`**

Importante: cada cena já controla sua própria janela de tempo pelo frame **global** (`frame - T.xIn` + `clamp`). Por isso **não** usamos `<Sequence from={…}>` aqui — dentro de uma Sequence o `useCurrentFrame()` vira relativo e quebraria os marcos. Monte todas as cenas direto no `AbsoluteFill`: ficam montadas o tempo todo, mas só aparecem na janela delas (opacidade/escala partem de 0). É intencional e simples.

```tsx
import { AbsoluteFill } from "remotion";
import { ReelProps } from "./props";
import { FundoBorrado } from "./cenas/FundoBorrado";
import { FotoKenBurns } from "./cenas/FotoKenBurns";
import { Intro } from "./cenas/Intro";
import { Titulo } from "./cenas/Titulo";
import { Preco } from "./cenas/Preco";
import { CTA } from "./cenas/CTA";

export function ReelProduto(props: ReelProps) {
  return (
    <AbsoluteFill>
      <FundoBorrado imagem={props.imagem} />
      <FotoKenBurns imagem={props.imagem} />
      <Titulo titulo={props.titulo} categoria={props.categoria} />
      <Preco preco={props.preco} precoAntigo={props.precoAntigo} descontoPct={props.descontoPct} />
      <CTA loja={props.loja} />
      <Intro />
    </AbsoluteFill>
  );
}
```

Cada cena já usa `frame - T.xIn` e faz `clamp`, então todas ficam "montadas" o tempo todo mas só aparecem na sua janela (opacidade/escala partem de 0). Isso é intencional e simples.

- [ ] **Step 2: Ligar o schema e props de exemplo no `Root.tsx`**

```tsx
import { Composition } from "remotion";
import { ReelProduto } from "./ReelProduto";
import { reelProps } from "./props";

const EXEMPLO = {
  titulo: "Carregador turbo 20W bivolt USB-C",
  preco: 39.9,
  precoAntigo: 79.9,
  descontoPct: 50,
  imagem:
    "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=800&q=80",
  loja: "shopee" as const,
  categoria: "eletronicos",
};

export function Root() {
  return (
    <Composition
      id="ReelProduto"
      component={ReelProduto}
      durationInFrames={300}
      fps={30}
      width={1080}
      height={1920}
      schema={reelProps}
      defaultProps={EXEMPLO}
    />
  );
}
```

- [ ] **Step 3: Verificar o reel inteiro no Studio**

Run: `npm run reel:studio`
Expected: a timeline reproduz os ~10s: intro rosa → foto com zoom + título → preço batendo + selo → "link na bio" + badge Shopee. Use a foto de exemplo (o CDN remoto do Img funciona no Studio). Afine os marcos `T.*` em `marca.ts` se quiser; Ctrl+C ao terminar.

- [ ] **Step 4: Commit**

```bash
git add remotion/ReelProduto.tsx remotion/Root.tsx
git commit -m "feat: orquestração do reel + schema ligado ao Studio"
```

---

## Task 12: Script de render local (modo id) + smoke real

**Files:**
- Create: `scripts/render-reel.ts`

- [ ] **Step 1: Escrever o script (modo id primeiro)**

`scripts/render-reel.ts`:
```ts
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, ensureBrowser } from "@remotion/renderer";
import { createClient } from "@supabase/supabase-js";
import { imgDataUri } from "../lib/imagem";
import { montarProps, reelProps, type RowProduto } from "../remotion/props";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFile, unlink } from "node:fs/promises";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !serviceKey) throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (use .env.local).");
const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

/** Busca a row (produtos + short_url do link ativo) por id de produto. */
async function buscarPorId(id: number): Promise<RowProduto | null> {
  const { data } = await supabase
    .from("links")
    .select("short_url, produto:produtos!inner(id, titulo, preco, preco_antigo, desconto_pct, imagem_url, categoria)")
    .eq("produto_id", id)
    .eq("ativo", true)
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const p = Array.isArray((data as any).produto) ? (data as any).produto[0] : (data as any).produto;
  return p ? { ...p, short_url: (data as any).short_url } : null;
}

let servePromise: Promise<string> | null = null;
function getBundle(): Promise<string> {
  if (!servePromise) {
    servePromise = bundle({ entryPoint: join(process.cwd(), "remotion", "index.ts") });
  }
  return servePromise;
}

export async function renderProduto(id: number): Promise<string> {
  const row = await buscarPorId(id);
  if (!row) throw new Error(`produto ${id} não encontrado na vitrine (link ativo)`);
  if (!row.imagem_url) throw new Error(`produto ${id} sem imagem_url`);

  const imagem = await imgDataUri(row.imagem_url);
  const inputProps = reelProps.parse(montarProps(row, imagem));

  await ensureBrowser();
  const serveUrl = await getBundle();
  const composition = await selectComposition({ serveUrl, id: "ReelProduto", inputProps });

  const out = join(tmpdir(), `reel-foto-${id}.mp4`);
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    crf: 23,
    pixelFormat: "yuv420p",
    outputLocation: out,
    inputProps,
  });

  const buf = await readFile(out);
  const destino = `reel-foto-${id}.mp4`;
  const { error } = await supabase.storage.from("videos").upload(destino, buf, {
    contentType: "video/mp4",
    upsert: true,
  });
  if (error) throw new Error(`falha ao subir: ${error.message}`);
  const publicUrl = supabase.storage.from("videos").getPublicUrl(destino).data.publicUrl;
  const urlComV = `${publicUrl}?v=${buf.length}`;
  await supabase.from("produtos").update({ reel_foto_url: urlComV }).eq("id", id);
  await unlink(out).catch(() => {});
  return urlComV;
}

async function main() {
  const args = process.argv.slice(2);
  const id = Number(args[0]);
  if (!Number.isFinite(id)) {
    console.error("uso: npm run reel -- <id-do-produto>");
    process.exit(1);
  }
  const u = await renderProduto(id);
  console.log("OK:", u);
  process.exit(0);
}

main().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
```

- [ ] **Step 2: Smoke real com um produto da vitrine**

Descubra um id de produto na vitrine (admin, ou SQL `select produto_id from links where ativo order by produto_id limit 1`). Então:

Run: `npm run reel -- <id>`
Expected: imprime `OK: https://…/videos/reel-foto-<id>.mp4?v=…`. Na primeira vez o Remotion baixa o Chromium headless (demora um pouco). O mp4 aparece no bucket `videos` do Supabase e `produtos.reel_foto_url` é preenchido.

- [ ] **Step 3: Conferir o vídeo**

Abra a URL impressa no navegador. Expected: reel de ~10s, 9:16, com a foto real do produto, preço e badge da loja certos.

- [ ] **Step 4: Commit**

```bash
git add scripts/render-reel.ts
git commit -m "feat: script de render local do reel (modo id) + smoke"
```

---

## Task 13: Modos `--slug`, `--novos`, `--regerar`

**Files:**
- Modify: `scripts/render-reel.ts`

- [ ] **Step 1: Adicionar busca por slug e listagem de pendentes**

Em `scripts/render-reel.ts`, adicione estas funções (depois de `buscarPorId`):

```ts
async function idPorSlug(slug: string): Promise<number | null> {
  const { data } = await supabase.from("links").select("produto_id").eq("slug", slug).eq("ativo", true).maybeSingle();
  return data?.produto_id ?? null;
}

/** ids de produtos na vitrine (link ativo, não pausado) ainda SEM reel_foto_url. */
async function idsNovos(): Promise<number[]> {
  const { data } = await supabase
    .from("links")
    .select("produto_id, produto:produtos!inner(id, reel_foto_url, imagem_url, status)")
    .eq("ativo", true)
    .eq("pausado", false)
    .limit(300);
  const vistos = new Set<number>();
  const ids: number[] = [];
  for (const l of (data ?? []) as any[]) {
    const p = Array.isArray(l.produto) ? l.produto[0] : l.produto;
    if (!p || vistos.has(p.id)) continue;
    vistos.add(p.id);
    if (p.imagem_url && !p.reel_foto_url && ["curado", "publicado"].includes(p.status)) ids.push(p.id);
  }
  return ids;
}
```

- [ ] **Step 2: Reescrever o `main()` com os modos**

Substitua o `main()` por:

```ts
async function renderVarios(ids: number[]) {
  let ok = 0;
  let err = 0;
  for (const id of ids) {
    try {
      const u = await renderProduto(id);
      console.log(`OK ${id}:`, u);
      ok++;
    } catch (e: any) {
      console.error(`ERRO ${id}:`, e.message);
      err++;
    }
  }
  console.log(`\nResumo: ${ok} ok · ${err} erro(s).`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--novos") {
    const ids = await idsNovos();
    if (!ids.length) return console.log("Nada novo: todos os produtos da vitrine já têm reel.");
    console.log(`Renderizando ${ids.length} produto(s) sem reel…`);
    await renderVarios(ids);
    return;
  }
  if (args[0] === "--slug") {
    const id = await idPorSlug(String(args[1] ?? ""));
    if (!id) throw new Error(`slug não encontrado: ${args[1]}`);
    console.log("OK:", await renderProduto(id));
    return;
  }
  if (args[0] === "--regerar") {
    const id = Number(args[1]);
    if (!Number.isFinite(id)) throw new Error("uso: npm run reel -- --regerar <id>");
    console.log("OK:", await renderProduto(id));
    return;
  }
  const id = Number(args[0]);
  if (!Number.isFinite(id)) {
    console.error("uso: npm run reel -- <id> | --slug <slug> | --novos | --regerar <id>");
    process.exit(1);
  }
  console.log("OK:", await renderProduto(id));
}
```

(Remova o `main()` antigo e o `process.exit(0)` duplicado; mantenha o `.catch` no final.)

- [ ] **Step 3: Verificar o modo `--novos`**

Run: `npm run reel -- --novos`
Expected: renderiza só os produtos da vitrine sem `reel_foto_url`, imprime um resumo `X ok · Y erro(s)`. Erro num produto não derruba o lote.

- [ ] **Step 4: Commit**

```bash
git add scripts/render-reel.ts
git commit -m "feat: modos --slug, --novos e --regerar no render do reel"
```

---

## Task 14: Admin — prévia e download do reel-foto

**Files:**
- Modify: `app/admin/videos/page.tsx`

- [ ] **Step 1: Adicionar `reel_foto_url` à interface `ProdVideo`**

Em `app/admin/videos/page.tsx`, na interface `ProdVideo` (por volta da linha 24), adicione o campo:
```ts
  reel_foto_url: string | null;
```

- [ ] **Step 2: Incluir `reel_foto_url` no `select`**

Na query (linha ~50), acrescente `reel_foto_url` à lista de colunas do produto:
```ts
    .select("produto:produtos!inner(id, titulo, imagem_url, preco, video_url, video_tiktok_url, legenda_tiktok, video_reel_url, reel_foto_url, tiktok_enviado_em, video_raw_em, status)")
```

- [ ] **Step 3: Renderizar o bloco do reel-foto (independe de `video_url`)**

No card de cada produto, logo **depois** do `<UploadVideo … />` (linha ~248) e **antes** do `{p.video_url && (` (linha ~249), insira:

```tsx
                {p.reel_foto_url && (
                  <div className="mt-2 border-t border-black/5 pt-2">
                    <div className="mb-1 text-[11px] font-bold text-pirraia">Reel da foto (auto)</div>
                    <video
                      src={p.reel_foto_url}
                      muted
                      loop
                      playsInline
                      controls
                      className="w-full rounded-lg bg-black/5"
                    />
                    <a
                      href={p.reel_foto_url}
                      download
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block text-center text-[11px] font-semibold text-pirraia hover:underline"
                    >
                      baixar reel ↗
                    </a>
                  </div>
                )}
```

- [ ] **Step 4: Atualizar o texto de ajuda do topo (opcional, mas honesto)**

Na linha ~82-83, o parágrafo explica só o fluxo de vídeo cru. Acrescente uma frase:
```tsx
        Produtos com foto também ganham um <strong>reel automático</strong> (gerado pelo script local <code>npm run reel</code>) — a prévia aparece no card.
```

- [ ] **Step 5: Verificar no app**

Garanta que pelo menos um produto tem `reel_foto_url` (rode `npm run reel -- <id>` antes). Então:

Run: `npm run dev` e abra `/admin/videos` (Basic Auth). Teste em 390px de largura.
Expected: o card do produto mostra "Reel da foto (auto)" com o `<video>` tocando e o link "baixar reel". Produtos sem reel não mostram o bloco. O build não quebrou.

Verifique também no preview tool do app: use `preview_start {name:"dev"}` (crie `.claude/launch.json` se faltar) e confira console sem erros.

- [ ] **Step 6: Commit**

```bash
git add app/admin/videos/page.tsx
git commit -m "feat: admin exibe e baixa o reel gerado da foto"
```

---

## Task 15: Verificação final

- [ ] **Step 1: Suite de testes**

Run: `npm test`
Expected: PASS em todos (`texto`, `loja`, `props`).

- [ ] **Step 2: Build do Next intocado**

Run: `npm run build`
Expected: passa sem erro; nenhum arquivo de `remotion/` ou `scripts/` entra no bundle do app.

- [ ] **Step 3: Conferência visual final**

Run: `npm run reel:studio`
Expected: o reel reproduz os 4 momentos do storyboard com as cores/fonte da marca. Ajuste fino de timing em `remotion/marca.ts` se necessário (e re-commit).

- [ ] **Step 4: Checklist do spec**

- [ ] Reel de 1 produto, ~10s, 9:16 1080×1920 — Task 1, 11
- [ ] Nasce da foto única + Ken Burns/motion — Tasks 7–11
- [ ] Render local, fora do build — Tasks 1, 12, 15
- [ ] Reusa `lib/imagem.ts` — Task 12
- [ ] Coluna nova `reel_foto_url` — Task 2
- [ ] Áudio mudo — (composição não tem áudio)
- [ ] Admin exibe + baixa — Task 14
- [ ] Caminho pro Lambda (composição inalterada) — documentado no spec

---

## Notas pro Lambda (futuro, não neste plano)

Quando for automatizar: `npm i @remotion/lambda`, deploy da função e do site (`deploySite`), e trocar no `scripts/render-reel.ts` o `renderMedia()` por `renderMediaOnLambda()`. A composição (`remotion/`) e as props não mudam. O admin passaria a disparar o render por server action.
