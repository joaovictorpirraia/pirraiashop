# Loja 3D — Spec de design (2026-10-29)

## Objetivo
Transformar a aba `/3d` de "grade link-na-bio" em **loja de verdade**, sem plano/mensalidade
e sem checkout (peças são **sob encomenda**, pedido fechado no WhatsApp). Three entregas:
home repaginada, **página própria por produto** e **admin** pra gerenciar a mídia.

## Decisões travadas (com o dono)
- **Cores**: swatches selecionáveis na página do produto; a cor escolhida vai junto na mensagem do WhatsApp.
- **Prazo/entrega**: selo global "Feito sob encomenda — prazo e frete combinados no WhatsApp". Sem campo de prazo por peça.
- **Depoimentos/avaliações**: fora por enquanto (sem estrelas vazias). Adicionar quando houver material real.
- **Escopo**: pacote completo (home + página de produto + admin), implementado em fases.

## 1. Modelo de dados (migration)
Tabela `produtos` já tem: `imagem_url`, `arte_url`, `video_url`, `categoria`, `preco`,
`preco_antigo`, `desconto_pct`, `descricao`, `proprio`. Adicionar:
- `fotos text[] not null default '{}'` — galeria (várias fotos). `imagem_url` continua sendo a **capa**.
- `cores text[] not null default '{}'` — chaves de cor disponíveis (ver palette abaixo).

Nova tabela `banners` (home hero, editável no admin):
- `id bigint pk`, `imagem_url text`, `titulo text`, `subtitulo text`, `link text`,
  `ativo boolean default true`, `ordem int default 0`, `criado_em timestamptz default now()`.
- MVP usa **1 banner ativo**; a tabela já permite mais no futuro.

Palette de cores fixo em `lib/cores.ts` (chave → `{ label, hex }`):
`vermelho #DC2626`, `azul #2563EB`, `verde #16A34A`, `amarelo #F59E0B`, `roxo #7C3AED`,
`laranja #EA580C`, `preto #111827`, `rosa #EC4899`, `branco #F8FAFC`, `cinza #6B7280`.
Produto guarda só as chaves em `cores[]`; a UI renderiza o swatch pelo palette.

## 2. Página de produto `/3d/[slug]`
- **Server Component** (SSR, rápido). Lê o produto pela `links.slug` + join `produtos`,
  só `proprio = true` e `status in ('curado','publicado')`. Slug inexistente → 404 (ou volta pra `/3d`).
- `generateMetadata` por peça: `title` = "{titulo} — pirraiashop 3D", `description` = `descricao`,
  `og:image` = capa (`imagem_url`).
- **Galeria**: capa + `fotos[]` em miniaturas; se houver `video_url`, entra como um item da galeria
  (player inline). Swipe no mobile, `aspect-ratio` fixo, `next/image`.
- **Coluna de compra**: título, preço (com `preco_antigo` riscado + selo de desconto se houver),
  **swatches de cor** a partir de `cores[]` (seleção obrigatória só se houver cores; senão texto
  "escolha a cor na encomenda"), selo "Feito sob encomenda…", descrição completa, botão grande
  **Encomendar no WhatsApp**.
- **CTA**: aponta pra `/r/[slug]?cor=<chave>` (reusa o redirect que já conta clique + dispara Lead).
  O handler `/r/[slug]` passa a ler `?cor=` e, se vier, acrescenta " Cor: {label}." ao texto da
  mensagem antes do `redirect(shortUrl)`. Sem cor escolhida, mensagem igual à de hoje.
- **Relacionados**: "Você também vai gostar" — mesma `categoria`, exclui o próprio, limite ~6.
- **Pixel**: `ViewContent` com `content_name` do produto na página; `Lead` continua no `/r`.

## 3. Home do `/3d` (repaginada)
- **Hero/banner** no topo: `banners` ativo (imagem + título + subtítulo + CTA opcional).
- **Seções** (carrossel horizontal, scroll-snap no mobile):
  - **Novidades**: últimas peças próprias curadas por `criado_em desc` (limite ~10).
  - **Destaques**: `links.destaque = true`.
- Abaixo, a **grade com os filtros por categoria** que já existem (componente `Grade`),
  agora com os cards abrindo a página de produto.
- **Mudança-chave no card**: `ProdutoCard` passa a ramificar por `proprio`:
  - `proprio = true` → link **interno** `/3d/[slug]` (abre a página do produto).
  - afiliado (home `/`) → continua indo pro `/r/[slug]` (link de afiliado). Sem regressão na home.

## 4. Admin (`/admin/3d`)
Estender a edição de cada peça própria:
- **Galeria**: subir **várias fotos** (append em `fotos[]`), remover/reordenar.
- **Vídeo**: reaproveita o fluxo de upload de vídeo já existente (`assinarUploadVideo` /
  Storage `videos` / `video_url`).
- **Cores**: checkboxes do palette → grava `cores[]`.
- **Categoria**: dropdown das 9 categorias (resolve a brecha do default "3D" nos cadastros novos).
- **Preço / preço antigo (promo) / destaque**: campos no mesmo form.
- **Banner da home**: seção pra editar imagem + textos + link do banner ativo.
- Uploads reusam o Storage (`criativos` pra foto, `videos` pra vídeo).

## 5. Fases de implementação
1. **Migration** (`fotos[]`, `cores[]`, tabela `banners`) + `lib/cores.ts` + campos novos no admin.
2. **Página de produto** `/3d/[slug]` (galeria, cores, CTA com cor, relacionados, metadata).
3. **Home repaginada** (banner + seções) + `ProdutoCard` ramificando `proprio` vs afiliado.
4. **Banner** editável no admin.
5. **Deploy manual no EasyPanel** (o dono dá o Deploy).

Cada fase é verificável isolada: migration aplica no Supabase; página de produto abre por slug;
home renderiza seções; card próprio abre `/3d/[slug]`.

## Fora de escopo (YAGNI)
Checkout/pagamento; depoimentos/reviews; prazo por produto; variação de tamanho ou estoque;
carrossel multi-banner; busca avançada. A `/` (achadinhos de afiliado) **não muda**.

## Direção visual
Mantém a identidade atual: fundo **areia**, texto **tinta**, acento **pirraia**; foto do produto
como heroína; mobile-first testado em **390px**; `next/image`. Evita os três clichês de IA
(creme+serifada+terracota; preto+verde-limão; jornal de fios de 1px).

## Riscos / atenção
- `ProdutoCard` é compartilhado com a home `/` — a ramificação `proprio` precisa de teste pra não
  quebrar o fluxo de afiliado.
- Conversão de imagem pro WhatsApp/IG (sharp) continua fora — não faz parte desta entrega.
- Deploy é manual; nada vai pro ar até o dono dar o Deploy no EasyPanel.
