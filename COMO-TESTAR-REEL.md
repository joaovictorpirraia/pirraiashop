# Como testar o reel de 1 produto (Remotion)

Isto foi construído na branch `claude/pirraia-shop-improvements-ec5c9c`. Transforma **1 foto
de produto** num reel/comercial animado de ~10s (9:16, 1080×1920), feito em Remotion e
renderizado **na sua máquina** (fora do build do EasyPanel — zero risco de deploy).

## O que já está pronto e verificado por mim
- Engine Remotion completa: intro da marca → foto com Ken Burns (fundo = foto borrada) →
  título + chip de categoria → preço antigo riscado → preço novo "batendo" + selo `-XX%` →
  "link na bio" + badge da loja + wordmark.
- Render real comprovado: gerei um mp4 de exemplo (300 frames) e inspecionei 5 frames-chave.
- Coluna `produtos.reel_foto_url` **já criada no Supabase de produção** (migration 029).
- Testes unitários (`npm test`), `npm run build` e `npm run typecheck:reel` passando.
- Admin `/admin/videos`: mostra a prévia do reel + botão "baixar reel" por produto.

## Pré-requisito (uma vez)
O script lê o Supabase com a **service role**. Garanta que o `.env.local` tem:
```
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```
(São as mesmas que o projeto já usa no servidor. Se não tiver no `.env.local`, pega no painel
do Supabase → Project Settings → API.)

## Gerar reels (na sua máquina)
Na primeira vez, o Remotion baixa o Chromium headless (uns minutos, só uma vez).

```bash
npm run reel -- 123          # um produto, pelo id
npm run reel -- --slug carregador-x   # pelo slug do link
npm run reel -- --novos      # todos os produtos da vitrine SEM reel ainda
npm run reel -- --regerar 123  # força re-render de um produto
```
Cada reel sobe pra `videos/reel-foto-{id}.mp4` no Storage e grava `produtos.reel_foto_url`.
O comando imprime a URL pública (`OK: https://.../reel-foto-123.mp4?v=...`).

Pra descobrir um id de produto: no admin, ou no SQL do Supabase
`select produto_id, slug from links where ativo = true limit 10;`

## Ver / baixar
- No `/admin/videos` (Basic Auth): cada card com reel mostra "Reel da foto (auto)" com a
  prévia tocando e o link **baixar reel**.
- Ou abre a URL impressa pelo comando direto no navegador.

## Afinar o visual (ao vivo)
```bash
npm run reel:studio
```
Abre o Remotion Studio no navegador com um produto de exemplo. Dá pra mexer e ver na hora.
Os botões de ajuste ficam em:
- `remotion/marca.ts` → cores da marca, fonte, e os **tempos** de cada momento (o objeto `T`,
  em frames; 30 frames = 1 segundo) e as zonas seguras.
- `remotion/cenas/*.tsx` → cada momento é um arquivo (Intro, FotoKenBurns, Titulo, Preco,
  Selo, CTA, FundoBorrado).

## Importante
- **O reel sai MUDO de propósito.** Você adiciona o áudio em alta no próprio Instagram/TikTok
  (áudio embutido leva *mute* por copyright). É o que todo criador faz.
- **Nada é postado automático.** O script só gera e sobe o arquivo + grava a coluna. Postar é
  você (ou o fluxo de Reel/TikTok que já existe).
- **Em produção só mexi na coluna nova** `reel_foto_url` (aditiva, não quebra nada).
- **Licença Remotion:** grátis pra pessoa física e empresa pequena (até 3 pessoas) — teu caso.
  Acima disso exige licença paga.

## Próximo passo possível (não construído)
Quando quiser **automático** (botão no admin dispara e volta pronto, sem sua máquina):
Remotion Lambda (AWS). A composição e as props não mudam — troca só o motor de render
(`renderMedia()` → `renderMediaOnLambda()`). Também dá pra fazer o template "achados do dia"
(multi-produto) reusando a mesma engine.

Spec e plano completos:
- `docs/superpowers/specs/2026-10-20-reel-remotion-um-produto-design.md`
- `docs/superpowers/plans/2026-10-20-reel-remotion-um-produto.md`
