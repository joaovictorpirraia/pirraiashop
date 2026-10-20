# Reel de 1 produto em Remotion (render local) — design

**Data:** 2026-10-20
**Projeto:** pirraiashop
**Status:** aprovado pra virar plano de implementação

## Problema

Hoje o vídeo da vitrine (`lib/video.ts`) só existe se o dono **gravar e subir um vídeo
cru**: o ffmpeg "queima" texto estático (scrim preto + nome + preço + "link na bio")
por cima. Dois limites:

1. A esmagadora maioria dos achadinhos **só tem foto** (o banco guarda uma `imagem_url`
   por produto, sem galeria). Esses produtos nunca viram vídeo.
2. O resultado é **parado**: zero animação, visual de "ferramenta", não de loja.

## Objetivo

Transformar **1 foto de produto** num **reel/comercial animado de ~10s** (9:16,
1080×1920), com motion graphics de verdade (Remotion), sem o dono precisar gravar nada.
Carro-chefe = **reel de UM produto**.

## Não-objetivos (YAGNI explícito)

- Template "achados do dia" (multi-produto). Nasce quase de graça da mesma engine, mas
  **depois**.
- Render automático na nuvem (Remotion Lambda). O desenho deixa a porta aberta, mas o v1
  é **render local**.
- Trilha sonora embutida. O reel sai **mudo** de propósito (o dono adiciona áudio em alta
  no app do Instagram/TikTok; áudio embutido dá *mute* por copyright).
- Auto-post no Instagram/TikTok.

## Decisões travadas

| Decisão | Escolha | Porquê |
|---|---|---|
| Formato | Reel de 1 produto, ~10s, 9:16 1080×1920, 30fps | Carro-chefe aprovado |
| Engine | Remotion (React + `spring`) | `ffmpeg` sofre com animação eased; Remotion é feito pra isso |
| Onde renderiza | **Local, no PC do dono** (v1) | VPS/EasyPanel é frágil com binário nativo (o `sharp` derrubou o build); o Remotion puxa Chromium headless, é mais pesado ainda. PC do dono é mais forte e já roda scripts `.ps1` locais. |
| Isolamento do build | Remotion **fora** do `next build` | Nada do Remotion vai pro EasyPanel → zero risco de deploy |
| Fonte da foto | Reusar `lib/imagem.ts` (`jpegDe`/`imgDataUri`) | Já resolve webp/anti-bot da Shopee/AliExpress; alimenta o Remotion com data URI pronto |
| Persistência | Coluna nova `produtos.reel_foto_url` | Não brigar com `video_reel_url` (reel feito do vídeo cru pelo ffmpeg) |
| Áudio | Mudo | Evita *mute* por copyright; prática padrão de criador |

## Direção visual

Fundo escuro **tinta `#1B1512`** + rosa da marca **`#E5126A`** + foto heroína grande =
parece **loja de achadinho** (energia, preço gritando). Fonte **Poppins** (já usada nas
capas). Foge dos três clichês de IA proibidos no `CLAUDE.md`.

### Storyboard (os ~10s)

| Tempo | Momento | Animação |
|---|---|---|
| 0–1s | Abertura da marca | Tela rosa `#E5126A`; wordmark "pirraiashop" entra com `spring` (overshoot leve) + "achadinho do dia" |
| 1–4s | Foto entra + título | Fundo = a própria foto **borrada e escurecida** (preenche 9:16 sem tarja preta); foto nítida sobe ao centro; **Ken Burns** (zoom lento) começa aqui e corre até o fim; título em lower-third + chip de categoria entram com `spring` |
| 5–8s | A "batida" do preço | Preço antigo riscado aparece pequeno, some; preço novo entra **grande com mola + overshoot**; selo `-XX%` **pulsa uma vez** |
| 8–10s | Chamada final | "link na bio" (rosa) + badge da loja ("Ver na Shopee", cor da loja) + wordmark no rodapé; fecho |

Zonas seguras do Reel/TikTok respeitadas: texto longe dos botões à direita e da
legenda/áudio embaixo (mesma lógica do `lib/video.ts` atual).

## Arquitetura

### Unidades e fronteiras

```
remotion/
  index.ts          # registerRoot(Root)
  Root.tsx          # <Composition id="ReelProduto" width=1080 height=1920 fps=30 durationInFrames=300 schema=reelProps />
  ReelProduto.tsx   # orquestra as cenas por <Sequence>, lê props
  marca.ts          # tokens: cores (#E5126A, #1B1512, #FBF9F8), Poppins, durações por cena, zonas seguras
  cenas/
    Intro.tsx          # 0–1s   abertura da marca
    FundoBorrado.tsx   # fundo = foto blur + escurecer (roda o reel todo, atrás de tudo)
    FotoKenBurns.tsx   # foto nítida + zoom lento contínuo
    Titulo.tsx         # lower-third: título (até 2 linhas) + chip categoria
    PrecoBatida.tsx    # preço antigo riscado → preço novo com mola
    Selo.tsx           # badge -XX% que pulsa
    CTA.tsx            # link na bio + badge da loja + wordmark
remotion.config.ts  # imageFormat jpeg, concurrency, overwrite
scripts/
  render-reel.mjs     # CLI de render local (rodado via tsx)
```

**Contrato das props** (zod, em `remotion/ReelProduto.tsx`):

```ts
reelProps = z.object({
  titulo: z.string(),
  preco: z.number(),
  precoAntigo: z.number().nullable(),
  descontoPct: z.number().nullable(),
  imagem: z.string(),        // data URI (JPEG/PNG), já tratado por lib/imagem.ts
  loja: z.enum(["shopee","aliexpress","mercadolivre","tiktok","whatsapp"]),
  categoria: z.string().nullable(),
})
```

Cada cena recebe só o que precisa das props + `useCurrentFrame()`/`spring()`. Dá pra
entender e testar cada cena isolada (o que ela faz, como se usa, do que depende).

### Fluxo do render local — `scripts/render-reel.mjs`

Rodado com `tsx` pra importar `lib/imagem.ts` e `lib/supabase.ts` direto (sem duplicar
helper). Lê credenciais do `.env.local` (`SUPABASE_SERVICE_ROLE_KEY`).

Modos:
- `npm run reel -- 123` — um produto por id
- `npm run reel -- --slug carregador-x` — por slug do link
- `npm run reel -- --novos` — todos os produtos da vitrine sem `reel_foto_url`
- `npm run reel -- --regerar 123` — força re-render

Passos (por produto):
1. Busca o produto no Supabase (título, preço, preço_antigo, desconto_pct, imagem_url,
   loja via view/link, categoria).
2. `imgDataUri(imagem_url)` → data URI tratado (reuso do `lib/imagem.ts`).
3. Monta as props validadas pelo `reelProps`.
4. `bundle()` da entrada `remotion/index.ts` → `selectComposition("ReelProduto")` →
   `renderMedia({ codec: "h264", crf: 23, pixelFormat: "yuv420p" })` → mp4 num tmp.
5. Upload em `videos/reel-foto-{id}.mp4` (bucket `videos`, `upsert: true`).
6. `update produtos set reel_foto_url = {publicUrl}?v={len}` (cache-bust como o
   `video_reel_url` já faz).
7. Imprime a URL pública.

Erros não derrubam o lote: loga e segue pro próximo produto (padrão do "processar
pendentes").

### Preview ao vivo — `npm run reel:studio`

`remotion studio` com props de exemplo (um produto real baixado do banco, ou fixture).
É onde a gente afina ritmo/cores vendo em tempo real, sem re-render.

### Admin (mínimo no v1)

Em `/admin/videos`, por produto da vitrine:
- se `reel_foto_url` existe: mostra a **prévia** (`<video>` loop mudo) + botão **baixar**;
- "copiar legenda" reusa a geração de conteúdo que já existe.

**Sem** server action de render (o render é local). O admin só **exibe e baixa** o que o
script gerou. (Disparar render pelo admin fica pro dia do Lambda.)

### Banco — migration nova

```sql
-- 029 — reel gerado da FOTO (Remotion), distinto de video_reel_url (reel do video cru)
-- (029 = próximo número livre; a última migration é a 028_produto_licenca.sql)
alter table produtos add column if not exists reel_foto_url text;
comment on column produtos.reel_foto_url is
  'Reel 9:16 gerado da foto do produto via Remotion (render local). Distinto de video_reel_url (reel do video cru pelo ffmpeg).';
```

### Dependências novas (só devDependencies — nada no runtime do Next)

- `remotion`, `@remotion/cli`, `@remotion/bundler`, `@remotion/renderer`, `@remotion/zod-types`
- `tsx` (rodar o script importando TS do `lib/`)
- `zod` (contrato das props) — se já não vier transitivo

Scripts no `package.json`:
```json
"reel": "tsx scripts/render-reel.mjs",
"reel:studio": "remotion studio remotion/index.ts"
```

O `next build` **não** importa nada de `remotion/` nem de `scripts/` → deploy intocado.

## Migração futura pro Lambda (documentada, não construída)

A composição e as props são idênticas em local e Lambda. Trocar o automático = trocar
`renderMedia()` por `renderMediaOnLambda()` + deploy da função (`@remotion/lambda`). **A
composição não muda uma linha.** Por isso todo o esforço do v1 vai no visual.

## Licença (condição real)

Remotion é grátis pra pessoa física e empresa pequena (até 3 pessoas) — o caso do dono se
encaixa. Acima disso exige licença paga. Registrado aqui pra não virar surpresa.

## Testes / verificação

- **Cenas isoladas:** render de cada `<Composition>` de teste com props fixas → snapshot
  de 1 frame-chave (não derruba CI, roda local).
- **Props/contrato:** validação zod cobre entrada malformada (preço nulo, sem desconto,
  título gigante → quebra em 2 linhas com reticências, como o `quebrarTitulo` atual).
- **Smoke real:** `npm run reel -- {id de um produto real}` gera o mp4, sobe e grava a
  coluna; conferir a prévia no admin em 390px (mobile-first).
- **Build intocado:** `next build` continua passando sem o Remotion no bundle.

## Ordem de implementação (prévia — o plano detalha)

1. Deps + scripts + `remotion.config.ts` + `remotion/` scaffold com `ReelProduto` placeholder.
2. Migration `reel_foto_url`.
3. Cenas, começando pelo fundo+foto (Ken Burns) → preço → intro/CTA.
4. `scripts/render-reel.mjs` (modo `id`, depois `--novos`/`--regerar`).
5. Afinar no `reel:studio` com produto real.
6. Admin: prévia + baixar.
7. Smoke real + conferir em mobile.
