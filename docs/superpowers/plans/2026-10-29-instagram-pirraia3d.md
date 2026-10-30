# Instagram do @pirraia3d — Implementation Plan

> Execução inline nesta sessão. Estende a infra de Instagram já validada (afiliado).

**Goal:** Ligar o @pirraia3d: stories automáticos (6/dia) das peças 3D próprias + feed real na página /3d, sem encostar no autopost do afiliado.

**Arquitetura:** Reaproveita `/api/story-auto` com `?conta=3d`; credenciais e seleção por conta; arte de story própria (laranja); coluna `conta` separa rodízio/teto; feed via Graph API cacheado.

**Decisões do dono:** duas contas (afiliado segue), feed com fotos reais via API, story 3D **com preço**.

---

## Contas / credenciais
- Afiliado: segue em `IG_USER_ID` / `IG_ACCESS_TOKEN` (não mexer).
- @pirraia3d: novas env `IG_USER_ID_3D` / `IG_ACCESS_TOKEN_3D` (System User token, não expira). Setadas no EasyPanel pelo dono.

## Tarefas

### 1. Migration `031_stories_conta.sql`
- `alter table stories add column if not exists conta text not null default 'afiliado'`
- índice `(conta, criado_em desc)`

### 2. `lib/instagram.ts`
- `IgCreds = { igUserId: string; token: string }`
- `publicarStory({ imageUrl, creds? })` — usa `creds` quando passado, senão env default.
- `credsAfiliado()` / `credsPirraia3d()` helpers lendo a env certa; `instagramConfigurado(creds)`.

### 3. `lib/stories.ts`
- `postarStoryAuto(supabase, qtd, conta='afiliado')`.
- `conta='3d'`: seleção via view `vitrine` onde `proprio=true`, rodízio de categoria, dedup 2 dias e teto **6/dia** escopados a `conta='3d'`; publica com `credsPirraia3d()`; arte `/api/story/<id>?conta=3d`; grava `stories` com `conta='3d'`. Não cura (peça 3D já é própria/visível).

### 4. Arte `app/api/story/[id]/route.tsx`
- `?conta=3d` → marca **PIRRAIA 3D** laranja (#F26A1C), preço, CTA "sob encomenda · chama no WhatsApp (link na bio)", assinatura `pirraiashop.com.br/3d`; arquivo `story-3d-<id>.jpg`.

### 5. `app/api/story-auto/route.ts`
- `?conta=3d` → valida `credsPirraia3d()`, chama `postarStoryAuto(.., 'pirraia3d')`, grava execução.

### 6. Feed `lib/instagramFeed.ts` + `components/Instagram3D.tsx` + `app/3d/page.tsx`
- `ultimasMidias3D(limite=6)`: GET `{IG_USER_ID_3D}/media?fields=id,media_type,media_url,thumbnail_url,permalink,caption&limit=6`, cacheado ~1h; erro → `[]`.
- `Instagram3D` aceita `midias`; com fotos reais mostra thumbnails linkando pro permalink; sem, cai no link-out atual.
- `/3d` busca as mídias no server e passa pro componente.

## Config do dono (fora do código)
- EasyPanel: `IG_USER_ID_3D`, `IG_ACCESS_TOKEN_3D`.
- cron-job.org: `POST https://pirraiashop.com.br/api/story-auto?conta=3d&key=<CRON_SECRET>&qtd=1` em 9/11/13/15/17/19h BRT.

## Verificação
- `npm run build` verde.
- Render da arte `/api/story/<id de peça 3D>?conta=3d`.
- Feed: sem creds cai no fallback (grade cinza + link-out), sem quebrar.
