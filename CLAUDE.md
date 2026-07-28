# pirraiashop — contexto do projeto

## O que é

Vitrine de afiliado (Shopee + TikTok Shop) da marca **@pirraiashop**. Funciona como
"link na bio" do Instagram: o visitante chega pela bio, vê os achados curados e sai
clicando num link de afiliado rastreado.

Dono do projeto: gestor de tráfego pago, ~8 anos de Meta Ads. Ele entende de
conversão e pixel melhor que a média — não explique marketing, explique código.

## Status atual (jul/2026)

**No ar** em `pirraiashop.com.br` (EasyPanel + VPS, repo `joaovictorpirraia/pirraiashop`,
Supabase ref `wxrmjkxiuflvbqspauao`). Deploy no EasyPanel é **manual** (auto-deploy não
configurado): cada merge na `main` precisa de um Deploy no painel.

### Pronto (em produção, validado)
- **Fase 1:** home/vitrine, redirect `/r/[slug]` com contagem de clique, pixel
  (PageView/ViewContent + Lead via CAPI), admin `/admin` (Basic Auth). O pixel **não** dispara
  na área de admin.
- **Camada de IA (OpenAI):** curadoria (`POST /api/curar`, `gpt-4.1-mini`) pontua 0–100 + ângulo
  + tags — inclui os produtos adicionados à mão (botão "Pontuar com IA" na vitrine); geração de
  conteúdo (`POST /api/gerar-conteudo`, `gpt-4.1`) escreve legenda + hashtags + roteiro **por canal**
  (feed / story / TikTok / WhatsApp — prompt muda por canal). Structured outputs; gate = `OPENAI_API_KEY`;
  modelo por env (`CURADORIA_MODELO`/`CONTEUDO_MODELO`). Validado com chamada real em produção.
- **Ordenação inteligente** (`POST /api/ordenar` + botão no admin): reordena a vitrine por
  cliques + `score_ia`. Não precisa de chave.
- **Admin operável pela tela:** `+ Produto` (cadastro manual → vitrine), `Editar` produto,
  `Conteúdo` (abas Rascunhos/Aprovados; gerar por canal, **Regerar** com IA, **Editar** o texto à mão,
  "Copiar legenda+hashtags" / "Copiar roteiro" / "Já postei"), "Reordenar por performance",
  "Pontuar com IA".
- **Métricas fundas** (`/admin/metricas`): cliques/dia (14d), **melhor dia da semana** e **melhor horário**
  (em horário de Brasília), **por categoria**, origem `utm_source · utm_medium`, top produtos.
- **Ingestão Mercado Livre:** `lib/ingest.ts` (`ingerirItensML`) + `POST /api/ingest-ml?key=&q=<palavra>`
  e botão "Importar ML" no admin — busca pública do ML, cai na fila `novo`, cura colando o link manual.
  Reusa `upsertNormalizados`. **Depende da migration 002 aplicada** (ver Falta).
- **Ingestão da Shopee:** código pronto e testado com mock (`lib/ingest.ts` + `POST /api/ingest`);
  responde 503 até `SHOPEE_APP_ID`/`SECRET` existirem.
- Rotas de API devolvem `200 {ok:false, erro}` em falha (o proxy do EasyPanel mascara 5xx).

### Falta / pendências
- **Rodar `migrations/002_mercadolivre.sql`** no SQL Editor do Supabase (widen do check `origem`
  pra incluir `mercadolivre`) — sem isso o "Importar ML" volta erro. Aditivo, não quebra nada.
- **Emitir o SSL** Let's Encrypt no EasyPanel (aba SSL) — visitante ainda vê "não seguro".
- **Trocar os 5 produtos falsos do seed por reais** (já dá pelo `+ Produto`) antes de mandar tráfego.
- Senha do admin mais forte; auto-deploy no EasyPanel (opcional).

### Esperando de fora
- **Open API da Shopee** (aprovação 5–15 dias) → liga a ingestão automática e o relatório de ROI.

### Futuro / não construído
- **Publicação automática** no Instagram/TikTok (hoje o conteúdo é copiado e postado à mão) —
  precisa Instagram Graph API + conta business + app review da Meta.
- **Link de afiliado ML automático:** o ML não expõe API pública de shortlink de afiliado (mesmo
  caso da Shopee hoje). Por isso a ingestão do ML traz só os dados; o link entra manual na curadoria.

## Stack (não negociar, é a mesma de outro projeto dele)

- Next.js 14, App Router, TypeScript
- Supabase (Postgres) — client `@supabase/supabase-js`
- Tailwind
- Deploy: EasyPanel em VPS, via GitHub
- Domínio: Hostinger

## Escopo da fase 1 (entregue)

1. **Home `/`** — a vitrine. Lê a view `vitrine` do Supabase. Bloco de destaque no
   topo, depois grade de produtos, filtro por categoria no client.
2. **Redirect `/r/[slug]`** — Route Handler que chama a função RPC `registrar_clique`,
   dispara o evento e faz `redirect(shortUrl)` com status 302. Se o slug não existir,
   manda pra home. Precisa ser rápido: sem render, sem layout.
3. **Pixel do Meta** — no layout raiz, com `next/script` estratégia `afterInteractive`.
   ID vem de env. Evento `ViewContent` na home, `Lead` no redirect (antes do 302,
   via server-side CAPI se der, senão só client).
4. **Admin `/admin`** — protegida por senha simples em env (Basic Auth no middleware,
   não invente auth). Lista produtos com `status='novo'`, permite curar/descartar,
   marcar destaque e reordenar. Feio pode, quebrado não.

Fora de escopo agora: geração de criativos, publicação automática, camada de IA.

## Arquivos que já existem

- `schema.sql` — rode no SQL Editor do Supabase antes de qualquer coisa. Já cria
  tabelas, RLS, a função `registrar_clique` e a view `vitrine`.
- `lib/shopee.ts` — cliente da Shopee Affiliate Open API. A chamada real ainda **não foi
  validada**: `SHOPEE_APP_ID`/`SECRET` não chegaram (aprovação leva 5–15 dias). No primeiro
  teste com credencial real, é provável ajustar os campos da query GraphQL — a Shopee muda
  o schema sem aviso (o próprio arquivo avisa isso).
- `lib/ingest.ts` + `app/api/ingest/route.ts` — ingestão da Shopee. Normaliza ofertas e faz
  upsert em `produtos`: novas caem como `novo` na fila de curadoria; re-ingest atualiza
  preço/estoque mas **preserva** o status (não des-cura o que já foi aprovado). Endpoint
  `POST /api/ingest?key=CRON_SECRET`, pra um cron externo (EasyPanel/cron-job.org) chamar.
  Responde 503 enquanto as credenciais Shopee não existirem. Lógica testada com dados mock.

## Variáveis de ambiente

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # só no servidor, nunca exponha
NEXT_PUBLIC_META_PIXEL_ID=
META_CAPI_TOKEN=                # opcional na fase 1
ADMIN_USER=
ADMIN_PASSWORD=
SHOPEE_APP_ID=                  # ainda não temos
SHOPEE_SECRET=                  # ainda não temos
CRON_SECRET=                    # secret que o cron manda pra chamar POST /api/ingest
```

Use a anon key na home (RLS já libera só o que é público) e a service role apenas
nas rotas de admin e nos jobs.

## Direção visual

O dono tem gosto exigente e trabalha com moda — o site precisa parecer **loja**, não
parecer ferramenta. Faça um plano de design antes de escrever CSS.

Regras firmes:

- A foto do produto é a heroína. Grade densa, imagens grandes, cropping consistente,
  `aspect-ratio` fixo. Nada de card com muito texto e imagem pequena.
- Preço com hierarquia real: preço antigo riscado pequeno, preço novo grande,
  selo de desconto com peso. É isso que faz clicar.
- Mobile primeiro de verdade. Praticamente 100% do tráfego vem da bio do Instagram.
  Teste em 390px de largura antes de considerar pronto.
- Carregamento rápido: `next/image`, imagens da Shopee em domínio remoto autorizado
  no `next.config`, sem fonte pesada.

**Não** entregue nenhum destes três, que é onde design gerado por IA sempre cai:
fundo creme com serifada de alto contraste e acento terracota; fundo quase preto com
um acento verde-limão; layout de jornal com fios de 1px e zero border-radius.
Escolha uma direção que faça sentido pra uma marca de achadinhos brasileira e
defenda a escolha em uma frase.

O nome "Pirraia" é apelido pessoal do dono e é a marca da loja — pode usar.
Mas ele nunca aparece em material para clientes do negócio de tráfego pago; são
projetos separados.

## Copy

Português do Brasil, informal mas não forçado. Verbos ativos. O botão diz o que
faz ("Ver na Shopee", não "Saiba mais"). Sem emoji no código de UI.

Todo link de afiliado precisa de divulgação visível: um aviso fixo no rodapé
dizendo que a página contém links de afiliado e que a compra não custa mais caro
por isso. Isso não é opcional — é exigência de CDC e da própria Shopee.

## Ordem de trabalho sugerida

1. Rodar `schema.sql` e confirmar a view `vitrine` respondendo
2. Scaffold do Next.js + conexão Supabase + seed de 5 produtos falsos
3. Redirect `/r/[slug]` funcionando com contagem de clique
4. Home com o design
5. Pixel
6. Admin
7. Deploy no EasyPanel
8. Ingestão da Shopee (código pronto; ligar quando a Open API for aprovada)

Depois de cada etapa, mostre o resultado antes de seguir.
