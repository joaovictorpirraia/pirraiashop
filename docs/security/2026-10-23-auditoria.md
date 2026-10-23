# Auditoria de segurança — pirraiashop

**Data:** 2026-10-23
**Escopo:** código e configuração do repositório `joaovictorpirraia/pirraiashop` (branch `main`) + advisories oficiais do projeto Supabase `wxrmjkxiuflvbqspauao`.
**Tipo:** auditoria **read-only**, baseada em evidência. Nada foi alterado no código, nas dependências ou em produção. Nenhum valor de senha/token/`.env` foi lido ou exposto.
**Autor:** sessão de auditoria do Claude Code.

> **Correção de premissa:** o pedido original mencionava Railway/PHP. **Não se aplica.** A stack real é **Next.js 14 (App Router, TypeScript) + Supabase (`@supabase/supabase-js`)**, deploy em **EasyPanel/VPS (Nixpacks)**, domínio na Hostinger. Toda a auditoria foi feita sobre o que existe de fato.

---

## 1. Resumo executivo

A base está, no geral, bem arquitetada do ponto de vista de segurança para uma vitrine de afiliado de um operador só:

- **O segredo mais sensível não está exposto:** `SUPABASE_SERVICE_ROLE_KEY` só é usado no servidor (nunca com prefixo `NEXT_PUBLIC_`, nunca importado em client component). Confirmado em [lib/supabase.ts:42](lib/supabase.ts).
- **Nenhum `.env` com segredo foi commitado** — só `.env.example` (sem valores). O histórico inteiro confirma isso.
- **RLS está habilitado em todas as 10 tabelas públicas**, inclusive `tiktok_auth` (que guarda tokens OAuth). As tabelas sensíveis (`tiktok_auth`, `cliques`, `visitas`, `posts`) têm RLS ligado **sem policy** = negam leitura por anon por padrão. A chave anon só enxerga a view `vitrine` (dados já públicos).
- **O bypass de middleware do Next (CVE-2025-29927) não afeta esta versão:** ele foi corrigido em 14.2.25, e o projeto está em **14.2.35**.
- **As ações de admin (service role) só são alcançáveis sob `/admin`**, que o middleware protege com Basic Auth; nenhum componente que invoca Server Action de admin é renderizado em página pública.

Os pontos que merecem ação, em ordem de prioridade, estão na tabela abaixo. O item que mais pesa no risco real deste projeto é o **par Next desatualizado (C1) + admin sem proteção contra força-bruta (A1)**.

### Tabela priorizada

| # | Achado | Criticidade | Correção exige |
|---|--------|-------------|----------------|
| **C1** | Next.js 14.2.35 com RCE/DoS/SSRF no Image Optimizer e Server Actions — **sem patch na linha 14.x** | **Crítica** | upgrade para 15.5.28+ (semver-major) + testes |
| **A1** | Admin só com Basic Auth: sem rate-limit/lockout, senha fraca conhecida, empunhando service role | **Alta** | senha forte agora; rate-limit depois |
| **M1** | `.env.production` **não** coberto pelo `.gitignore` (risco de commit futuro de segredos) | **Média** | 1 linha no `.gitignore` |
| **M2** | Endpoints de imagem (`/api/og`, `/api/criativo`, `/api/criativo3d`, `/api/capa`, `/api/story`) e `/api/visita` públicos, sem throttling, com render pesado + escrita no Storage | **Média** | rate-limit / cache |
| **M3** | View `vitrine` é `SECURITY DEFINER` (lint **ERROR** do Supabase) | **Média** | `security_invoker=on` + testar |
| **M4** | `registrar_clique` é `SECURITY DEFINER` com `search_path` mutável | **Média** | `SET search_path` na função |
| **M5** | Segredo do cron via `?key=` (vaza em logs) e comparação não-timing-safe | **Média** | header + `timingSafeEqual` |
| **B1** | `/api/ffmpeg-test` com chave hardcoded no repo (endpoint de teste esquecido) | **Baixa** | remover a rota |
| **B2** | Versão do Node não fixada (`.nvmrc`/`engines`) → runtime do Nixpacks imprevisível | **Baixa** | fixar Node LTS |
| **B3** | Sem headers de segurança (CSP/HSTS/X-Frame-Options/nosniff) | **Baixa** | `headers()` no `next.config` |
| **B4** | 8 tabelas com RLS ligado e sem policy (hoje protege, mas é implícito) | **Baixa (info)** | documentar/escrever policies explícitas |
| **B5** | Dependências de **dev/build** vulneráveis (tailwind/postcss/braces/nanoid) | **Baixa** | opcional; fora do bundle de produção |

---

## 2. Metodologia

- Leitura de `package.json`, `package-lock.json`, `middleware.ts`, `next.config.mjs`, `nixpacks.toml`, `.gitignore`, `.env.example`, `schema.sql`, todas as rotas em `app/api/*`, as Server Actions de `app/admin/*`, as libs em `lib/*` e os componentes client em `components/*`.
- `npm audit` (completo e `--omit=dev`), com confirmação de cada CVE relevante do Next em fonte oficial (GitHub Advisory / OSV / changelog da Vercel).
- Advisors oficiais do Supabase (`get_advisors` security + performance) e inventário de tabelas/RLS no projeto em produção.
- Scan do git (arquivos rastreados + histórico) por `.env` e padrões de chave — **sem imprimir valores**.

As versões instaladas (do `package-lock.json`): `next` **14.2.35**, `react`/`react-dom` **18.3.1**, `@supabase/supabase-js` **2.45.4** (puxa `@supabase/auth-js` 2.65.0), `openai` 4.104.0, `postcss` 8.4.47, `tailwindcss` 3.4.14, `nanoid` 3.3.16, `source-map-js` 1.2.1, Remotion 4.0.537 (devDependency).

---

## 3. Achados detalhados

### C1 — Next.js 14.2.35: RCE/DoS/SSRF sem correção na linha 14.x  — **Crítica**

**Evidência:**
- [package.json:19](package.json) → `"next": "^14.2.35"`; instalado 14.2.35 (lockfile).
- `npm audit` classifica `next` como **critical**, faixa vulnerável `9.3.4-canary.0 - 16.3.0-preview.10` (cobre 14.2.35). Entre os advisories que se aplicam a esta app (self-hosted, App Router, `next/image` com otimizador ativo, Server Actions):
  - **Crítica** — RCE no Image Optimization API com SVG ([GHSA-2464-fhr4-w9xw](https://github.com/advisories/GHSA-2464-fhr4-w9xw), faixa `>=10.0.0 <=15.5.27`) e com AVIF ([GHSA-2xp9-vwfh-vxw4](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4)).
  - **Alta** — SSRF em Server Actions em servidor custom ([GHSA-89xv-2m56-2m9x](https://github.com/advisories/GHSA-89xv-2m56-2m9x)); DoS em Server Actions ([GHSA-m99w-x7hq-7vfj](https://github.com/advisories/GHSA-m99w-x7hq-7vfj)); DoS com Server Components.
  - **Moderada** — DoS do Image Optimizer via `remotePatterns` ([GHSA-9g9p-9gw9-jx7f](https://github.com/advisories/GHSA-9g9p-9gw9-jx7f)) — e este `next.config.mjs` usa `remotePatterns` com curingas (`**.susercontent.com`, `**.mlstatic.com`, etc., [next.config.mjs:4](next.config.mjs)); crescimento ilimitado do disk cache do `next/image`.
- **Confirmado em fonte oficial que a linha 14.x NÃO recebeu patch:** 14.2.35 é o último release 14.x; os advisories acima têm correção apenas em **15.5.28** (ou **16.4.1**). Ver [Next.js May 2026 security release — Vercel](https://vercel.com/changelog/next-js-may-2026-security-release) e o [advisory no OSV](https://osv.dev/vulnerability/GHSA-2464-fhr4-w9xw).

**Não se aplica / mitiga (evidência, não suposição):**
- O **RCE do Windows** ([GHSA-p293-qw3h-jr36](https://github.com/advisories/GHSA-p293-qw3h-jr36)) é só para servidores hospedados em Windows. **A produção roda em Linux** (VPS/EasyPanel, Nixpacks com `aptPkgs=["ffmpeg"]` — [nixpacks.toml](nixpacks.toml)). Então **não afeta produção** (afeta só a máquina de dev Windows, se rodar `next start` ali exposto).
- `dangerouslyAllowSVG` **não** está ligado no `next.config` → o otimizador não processa SVG por padrão, o que reduz a exposição do GHSA de SVG. O `sharp` foi removido do projeto (quebrava o build); a correção oficial do RCE pede `sharp >= 0.35.5`. **Verificar** se o `/_next/image` ainda está ativo em produção (está, pois não há `images.unoptimized`).

**Criticidade:** marco como **Crítica** pelo RCE no otimizador de imagem exposto publicamente via `/_next/image`, ainda que os fatores acima reduzam a probabilidade. É o item de maior impacto potencial.

**Correção recomendada (versão-alvo):** **Next.js 15.5.28** (menor salto que fecha os advisories) ou 16.x. É um **upgrade semver-major** (15 → React 19): não aplicar sem teste.

**Passo a passo (NÃO aplicar sem autorização):**
1. Em branch separada: `npm install next@15.5.28 react@19 react-dom@19 eslint-config-next@15.5.28`.
2. Rodar o codemod: `npx @next/codemod@latest upgrade latest`.
3. Ajustar breaking changes do 15: `cookies()`/`headers()`/`params`/`searchParams` agora são **assíncronos** (impacta `app/api/tiktok/callback/route.ts`, que usa `cookies()`, e os route handlers com `params`); caching passou a ser opt-in (revisar `export const dynamic`/`fetchCache` já presentes).
4. `npm run build` + `npm run typecheck:reel` + `npm test`; validar fluxo `/`, `/r/[slug]`, `/admin`, `/api/og`, `/api/criativo`.
5. Confirmar que `sharp` resolvido é `>= 0.35.5` (ou manter `images.unoptimized` desligado só se o otimizador for mesmo necessário).
6. Deploy manual no EasyPanel e smoke test.

> Se o salto para 15 for arriscado agora, a mitigação paliativa (não substitui o upgrade) é **desativar o otimizador** servindo imagens direto do CDN (`images.unoptimized: true`), fechando a superfície do `/_next/image`. Avaliar impacto de performance antes.

---

### A1 — Admin: Basic Auth sem rate-limit, senha fraca conhecida, com service role  — **Alta**

**Evidência:** [middleware.ts:6-41](middleware.ts). A autenticação do `/admin` é Basic Auth comparando `ADMIN_USER`/`ADMIN_PASSWORD`. Não há: rate-limiting, lockout após N tentativas, 2FA, nem registro de tentativas. O `CLAUDE.md` do projeto lista "senha do admin mais forte" como pendência conhecida — ou seja, há evidência própria de que a senha é fraca.

**Por que é Alta:** todas as rotas de escrita do admin (Server Actions em [app/admin/actions.ts](app/admin/actions.ts)) e a rota [app/admin/importar-3d/route.ts](app/admin/importar-3d/route.ts) usam **service role** (`supabaseAdmin()`), que ignora RLS. Comprometer o admin = controle total dos dados (produtos, links, carrosséis) **e** abuso das chaves da OpenAI/Meta/Instagram/TikTok que o servidor detém. Com senha fraca e sem throttling, força-bruta online é viável. O canal está em HTTPS válido (SSL confirmado no `CLAUDE.md`), então o risco é a força da senha + ausência de barreira, não interceptação.

**Correção (passo a passo):**
1. **Agora (barato):** trocar `ADMIN_PASSWORD` por uma senha longa aleatória (≥ 24 chars) direto no painel do EasyPanel (ver seção 5). Não precisa mexer em código.
2. Tornar a comparação timing-safe (ver M5) — mesmo patch.
3. **Depois (defesa em profundidade):** rate-limit por IP no middleware (ex.: contador em memória ou Upstash) com backoff após ~5 falhas; opcionalmente migrar para uma cookie de sessão assinada em vez de reenviar a credencial a cada request.

**Observação positiva (verificado):** as Server Actions de admin **não** vazam para rotas públicas. Os componentes que as invocam (`CopiarLegenda`, `UploadVideo`, página `capturar`) só são renderizados sob `/admin/*` ([app/admin/page.tsx:850](app/admin/page.tsx), [app/admin/videos/page.tsx:251](app/admin/videos/page.tsx)); a home e `/3d` usam apenas `Grade`/`PixelTrack`/`VisitaTracker`/`CompartilharBotao`, nenhum deles ligado a action de service role. Como o Next só despacha uma Server Action na rota cujo bundle a contém, elas ficam atrás do middleware. **Recomendação de reforço:** não depender só do middleware — se um dia um componente de admin for reaproveitado em página pública, a action fica exposta; vale um check explícito de auth dentro das actions mais destrutivas.

---

### M1 — `.env.production` fora do `.gitignore`  — **Média**

**Evidência:** `git check-ignore .env .env.local .env.production .env.production.local` retornou **`.env`, `.env.local`, `.env.production.local`** — **`.env.production` ficou de fora**. O `.gitignore` ([.gitignore:8-11](.gitignore)) cobre `.env`, `.env.local`, `.env*.local`, mas o padrão `.env*.local` não casa com `.env.production` (sem o sufixo `.local`).

**Risco:** se o dono criar um `.env.production` (padrão comum em Next) com segredos reais, ele **não** será ignorado e pode ser commitado por engano. Hoje não há nenhum `.env` com segredo rastreado (confirmado) — é prevenção.

**Correção:** acrescentar ao `.gitignore`:
```
.env.production
.env.development
```
(ou trocar o bloco por `.env*` e manter uma exceção `!.env.example`).

---

### M2 — Endpoints de mídia/visita públicos, sem throttling  — **Média**

**Evidência:** são GET/POST **sem autenticação** e usam service role:
- [app/api/og/[slug]/route.tsx:33](app/api/og/[slug]/route.tsx), [app/api/criativo/[id]/route.tsx:29](app/api/criativo/[id]/route.tsx), [app/api/criativo3d/[id]/route.tsx:70](app/api/criativo3d/[id]/route.tsx), [app/api/capa/[id]/route.tsx:55](app/api/capa/[id]/route.tsx), [app/api/story/[id]/route.tsx:30](app/api/story/[id]/route.tsx) — cada chamada renderiza imagem (`next/og` + pngjs/jpeg-js, ~CPU) e grava no Storage.
- [app/api/visita/route.ts:15](app/api/visita/route.ts) — insere em `visitas` via service role a cada POST (só filtra UA de bot e corta tamanho dos campos).

**Risco:** abuso de recurso/custo (soft DoS): um atacante pode marteladar `/api/criativo/<id>` para 2813 produtos forçando render repetido + escrita no Storage, ou inflar `visitas`. **Não é SSRF clássico:** a URL que o servidor busca (`imagem_url`) vem do **banco** (definida por admin/ingestão), não do chamador anônimo — ver [lib/imagem.ts:40](lib/imagem.ts) e [app/api/criativo3d/[id]/route.tsx:87](app/api/criativo3d/[id]/route.tsx). Mesmo assim, `fetch(redirect:"follow")` dessas URLs internas do servidor merece a nota: se um dia `imagem_url` puder ser influenciado por fonte externa não confiável, vira SSRF.

**Correção:** rate-limit por IP nessas rotas; `Cache-Control` público agressivo (as imagens são determinísticas por `id`); idealmente só regenerar quando o produto muda. Para `fetch` de imagem, restringir a hosts da allowlist (os mesmos do `next.config`) antes de buscar.

---

### M3 — View `vitrine` é `SECURITY DEFINER`  — **Média**

**Evidência:** advisor de segurança do Supabase, lint **ERROR** `security_definer_view`: *"View `public.vitrine` is defined with the SECURITY DEFINER property"* ([doc](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view)). Criada em [schema.sql:181](schema.sql) com `create or replace view` (sem `security_invoker`), então roda com privilégios do dono e **ignora a RLS de quem consulta**.

**Exposição real:** **baixa** — o `WHERE` da própria view (`l.ativo = true and p.status in ('curado','publicado') and (expira_em is null or > now())`, [schema.sql:204](schema.sql)) espelha exatamente o que a RLS liberaria, então o anon recebe só o pretendido. Mas é lint ERROR e boa prática.

**Correção (testar antes):**
```sql
alter view public.vitrine set (security_invoker = on);
```
As policies `leitura_vitrine_produtos` (status curado/publicado) e `leitura_vitrine_links` (ativo) já existem ([schema.sql:168-174](schema.sql)), então o anon deve continuar enxergando a vitrine após a troca — **validar a home depois de aplicar**.

---

### M4 — `registrar_clique` com `search_path` mutável  — **Média**

**Evidência:** advisor `function_search_path_mutable` (WARN) e os advisors `anon/authenticated_security_definer_function_executable` (WARN): a função [schema.sql:91-117](schema.sql) é `security definer` sem `search_path` fixo e é executável por `anon`/`authenticated` via `/rest/v1/rpc/registrar_clique`.

**Contexto:** o anon **deve mesmo** poder executá-la — é o que o redirect `/r/[slug]` usa sem service role ([app/r/[slug]/route.ts:115](app/r/[slug]/route.ts)). O problema é só o `search_path` mutável, que em função `security definer` abre risco de resolução de objeto inesperada se o `search_path` do chamador for manipulado.

**Correção:**
```sql
alter function public.registrar_clique(text,text,text,text,text)
  set search_path = public, pg_temp;
```

---

### M5 — Segredo do cron em query string + comparação não-timing-safe  — **Média**

**Evidência:** todas as rotas de cron aceitam o segredo via `?key=` **ou** header `x-cron-key` e comparam com `key !== secret` (comparação simples, curto-circuito): [app/api/ingest/route.ts:20-23](app/api/ingest/route.ts), [ingest-ml](app/api/ingest-ml/route.ts), [ingest-aliexpress](app/api/ingest-aliexpress/route.ts), [atualizar-precos](app/api/atualizar-precos/route.ts), [loop-diario](app/api/loop-diario/route.ts), [curar](app/api/curar/route.ts), [gerar-conteudo](app/api/gerar-conteudo/route.ts), [ordenar](app/api/ordenar/route.ts), [montar-carrossel](app/api/montar-carrossel/route.ts), [processar-videos](app/api/processar-videos/route.ts), [story-auto](app/api/story-auto/route.ts). O middleware também compara `u !== user || p !== pass` ([middleware.ts:35](middleware.ts)).

**Risco:** (a) segredo em **query string** vaza em logs de acesso, no proxy do EasyPanel e em `Referer`; (b) comparação não-timing-safe (baixo risco prático sobre rede, mas barato de corrigir). As rotas em si estão corretamente protegidas (negam sem segredo) — não há rota mutadora alcançável sem auth.

**Correção:** preferir **sempre** o header `x-cron-key` (documentar que o cron use header, não `?key=`); comparar com `crypto.timingSafeEqual` (tratando tamanhos diferentes). Aplicar o mesmo em middleware e num helper compartilhado.

---

### B1 — `/api/ffmpeg-test` com chave hardcoded  — **Baixa**

**Evidência:** [app/api/ffmpeg-test/route.ts:17-18](app/api/ffmpeg-test/route.ts) — `if (key !== "pirraia-ffmpeg-test")`. Chave fixa no código (logo, pública, já que o repo é conhecido). O próprio comentário diz "Remover depois do teste". Só roda `ffmpeg -version` (sem input do usuário no comando — `execFile` com args fixos, sem shell), então o impacto é mínimo: confirma presença/config do ffmpeg.

**Correção:** remover a rota (ou, se for mantida, gatear por `CRON_SECRET`).

---

### B2 — Versão do Node não fixada  — **Baixa**

**Evidência:** não há `.nvmrc`, nem campo `engines` no `package.json`, nem Dockerfile; o `nixpacks.toml` só acrescenta `ffmpeg`. O Nixpacks escolhe a versão default de Node, que pode variar/ficar desatualizada entre builds.

**Correção:** fixar um Node LTS (ex.: `engines.node: ">=20 <21"` + `.nvmrc` com `20`). Confirmar no EasyPanel qual versão roda hoje (seção 5).

---

### B3 — Sem headers de segurança  — **Baixa**

**Evidência:** [next.config.mjs](next.config.mjs) não define `headers()`. Faltam CSP, HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`. Relevante porque há script de pixel injetado e os advisories de XSS do Next em App Router.

**Correção:** adicionar `async headers()` no `next.config` com os cabeçalhos acima (CSP começando em report-only para não quebrar o pixel do Meta).

---

### B4 — RLS habilitado sem policy em 8 tabelas  — **Baixa (informativo)**

**Evidência:** advisor `rls_enabled_no_policy` (INFO) em `carrosseis`, `categorias`, `cliques`, `execucoes`, `posts`, `stories`, `tiktok_auth`, `visitas`. **Isso hoje protege** (RLS ligado + sem policy = anon não lê nada), e o inventário confirma `rls_enabled=true` em todas. A proteção de **escrita** depende inteiramente de o service role ser o único escritor — o que o código respeita.

**Correção (opcional):** escrever policies explícitas (ou comentários no schema) documentando a intenção "deny all para anon", para que a proteção não seja implícita. `categorias` merece atenção: se a home algum dia precisar lê-la via anon, vai voltar vazia.

---

### B5 — Dependências de dev/build vulneráveis  — **Baixa**

**Evidência (`npm audit`):** 13 achados no total; **6** fora de dev. Distinguindo:
- **Runtime de produção:** `@supabase/auth-js <=2.69.1` (low, path routing — [GHSA-8r88-6cj9-9fh5](https://github.com/advisories/GHSA-8r88-6cj9-9fh5)); `nanoid <3.3.18` (high, loop — [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8), transitivo); `postcss`/`source-map-js` (rodam no **build**, não no runtime servido). O `next` (C1) é o item crítico de runtime.
- **Só dev/build (fora do bundle):** `tailwindcss 3.4.14` e sua cadeia `braces`/`micromatch`/`fast-glob`/`chokidar`/`postcss-selector-parser` — a correção pede `tailwindcss@4` (semver-major). Como é toolchain de build, **prioridade baixa** frente ao upgrade do Next. A toolchain do Remotion é devDependency e também não entra no bundle de produção.

**Correção:** `npm audit fix` resolve `nanoid`/`fast-glob`/`source-map-js` sem major. `supabase-js@2.118` fecha o auth-js (minor, seguro). Tailwind v4 fica como item opcional separado.

### Performance (advisor Supabase, para registro)
- FKs sem índice: `links.produto_id`, `posts.link_id`, `posts.produto_id` ([lint 0001](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys)).
- Índice não usado: `idx_visitas_visitante`. Baixa prioridade.

---

## 4. Segredos e ambiente

- **`SUPABASE_SERVICE_ROLE_KEY`**: usado só em `lib/supabase.ts` (servidor), nunca `NEXT_PUBLIC_`, nunca em client component. ✔
- **`.env` no git**: só `.env.example` (sem valores), hoje e em todo o histórico (único `.env*` já adicionado foi o `.example`). ✔ — mas ver **M1** (`.env.production` não ignorado).
- **Variáveis expostas ao browser** (prefixo `NEXT_PUBLIC_`): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `META_PIXEL_ID`, `SITE_URL` — todas públicas por natureza. ✔
- O `scan` por padrões de chave em arquivos rastreados só bateu em **documentação e código** (as palavras "secret"/"service_role"), nenhum valor real.

---

## 5. Verificar manualmente na hospedagem/plataforma

Itens que a auditoria do código não alcança — checar nos painéis:

**EasyPanel (VPS):**
- [ ] Qual **versão do Node** o container roda (confirma B2). Fixar um LTS.
- [ ] As variáveis de ambiente estão **só** no painel do EasyPanel (não em arquivo commitado) e `SUPABASE_SERVICE_ROLE_KEY`/`OPENAI_API_KEY`/tokens não aparecem em logs de build/deploy.
- [ ] O proxy não está logando a query string das rotas de cron (M5).
- [ ] Senha do painel do EasyPanel forte + 2FA se disponível.

**Supabase (projeto `wxrmjkxiuflvbqspauao`):**
- [ ] Aplicar `security_invoker` na view `vitrine` (M3) e `search_path` em `registrar_clique` (M4) — e testar a home depois.
- [ ] Conferir que a **anon key** publicada é a anon mesmo (não a service role) e que o bucket `criativos`/`banners` está com a visibilidade pretendida (público para leitura, escrita só service role).
- [ ] Confirmar que nenhuma policy nova foi adicionada que libere `tiktok_auth`/`cliques` para anon.

**Hostinger (domínio):**
- [ ] HSTS no apex (o SSL já é válido); decidir o redirect `www → apex` (hoje os dois abrem soltos).

---

## 6. Credenciais a rotacionar (sem acessar valores)

Recomendo rotação **preventiva** das que o servidor detém, priorizando as de maior alcance. Nenhuma foi exposta nesta auditoria — a rotação é higiene, especialmente se já houve compartilhamento de `.env` por canais menos seguros:

1. **`ADMIN_PASSWORD`** — prioridade máxima (ver A1). Senha longa aleatória, agora.
2. **`SUPABASE_SERVICE_ROLE_KEY`** — maior alcance (ignora RLS). Rotacionar no painel do Supabase e atualizar no EasyPanel.
3. **`OPENAI_API_KEY`** — custo direto se vazar.
4. **`META_CAPI_TOKEN`** e **`IG_ACCESS_TOKEN`** (token de System User).
5. **`CRON_SECRET`** — e migrar o cron para mandar via header `x-cron-key`.
6. **`TIKTOK_CLIENT_SECRET`**, **`SHOPEE_SECRET`**, **`ALIEXPRESS_APP_SECRET`**, **`MERCADOLIVRE_CLIENT_SECRET`** — conforme forem sendo ativados.

> A chave `"pirraia-ffmpeg-test"` (B1) não é segredo rotacionável — é só remover a rota.

---

## 7. Plano seguro de implementação (ordem sugerida)

Tudo em **branch separada**, com `npm run build`/`npm test` antes de cada deploy manual no EasyPanel. Nada em produção direto.

**Fase 0 — minutos, sem código, maior redução de risco:**
1. Trocar `ADMIN_PASSWORD` por senha forte no EasyPanel (A1).
2. Aplicar no SQL Editor do Supabase: `security_invoker` na `vitrine` (M3) e `search_path` em `registrar_clique` (M4). Testar a home.

**Fase 1 — patch pequeno de código (1 PR):**
3. Corrigir `.gitignore` (M1).
4. Remover `/api/ffmpeg-test` (B1).
5. Comparação timing-safe + exigir header no cron (M5).
6. `npm audit fix` + `supabase-js@2.118` (B5, minors seguros).
7. Fixar Node LTS (B2) e adicionar `headers()` de segurança em report-only (B3).

**Fase 2 — o upgrade grande (PR próprio, mais teste):**
8. Next 14 → **15.5.28** + React 19 (C1), seguindo o passo a passo do item C1. É o que fecha a maior parte dos advisories de runtime.

**Fase 3 — reforço:**
9. Rate-limit no `/admin` e nos endpoints de imagem/visita (A1/M2).
10. Rotação das credenciais da seção 6.
11. (Opcional) Tailwind v4 e policies RLS explícitas (B4/B5).

---

*Relatório gerado em auditoria read-only. Nenhuma correção foi aplicada; aguardando autorização para qualquer alteração.*
