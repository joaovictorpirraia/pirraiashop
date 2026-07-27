# pirraiashop — contexto do projeto

## O que é

Vitrine de afiliado (Shopee + TikTok Shop) da marca **@pirraiashop**. Funciona como
"link na bio" do Instagram: o visitante chega pela bio, vê os achados curados e sai
clicando num link de afiliado rastreado.

Dono do projeto: gestor de tráfego pago, ~8 anos de Meta Ads. Ele entende de
conversão e pixel melhor que a média — não explique marketing, explique código.

## Stack (não negociar, é a mesma de outro projeto dele)

- Next.js 14, App Router, TypeScript
- Supabase (Postgres) — client `@supabase/supabase-js`
- Tailwind
- Deploy: EasyPanel em VPS, via GitHub
- Domínio: Hostinger

## Escopo da fase 1 (é só isso — não construa as fases seguintes)

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
- `lib/shopee.ts` — cliente da Shopee Affiliate Open API. **Ainda não dá pra testar**:
  o acesso à Open API leva de 5 a 15 dias pra ser aprovado. Deixe o arquivo ali,
  não construa a ingestão agora.

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

Depois de cada etapa, mostre o resultado antes de seguir.
