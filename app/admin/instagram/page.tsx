import { supabaseAdmin } from "@/lib/supabase";
import { brl } from "@/lib/format";
import { instagramConfigurado } from "@/lib/instagram";
import { montarCarrossel, montarCarrosselVideo, montarCarrosselAuto, rodarLoopDoDia, publicarCarrossel, descartarCarrossel, removerDoCarrossel, atualizarGancho, postarStoryAgora, postarReelTeste } from "../actions";
import { BotaoSubmit } from "@/components/BotaoSubmit";
import { TEMAS } from "@/lib/loop";

export const dynamic = "force-dynamic";

interface ProdutoVitrine {
  id: number;
  titulo: string;
  imagem_url: string | null;
  preco: string | number | null;
  desconto_pct: number | null;
  status?: string;
  video_url?: string | null;
}

interface Carrossel {
  id: number;
  produto_ids: number[];
  gancho: string;
  legenda: string;
  status: string;
  ig_media_id: string | null;
  erro: string | null;
  tipo?: string;
}

export default async function InstagramAdmin({
  searchParams,
}: {
  searchParams: { ok?: string; erro?: string; tema?: string };
}) {
  const supabase = supabaseAdmin();
  const igOn = instagramConfigurado();

  // produtos da vitrine (pra montar o carrossel) — via links ativos e não pausados
  const { data: linksRaw } = await supabase
    .from("links")
    .select("produto:produtos!inner(id, titulo, imagem_url, preco, desconto_pct, status, video_url)")
    .eq("ativo", true)
    .eq("pausado", false)
    .order("destaque", { ascending: false })
    .order("ordem", { ascending: true });
  const produtos: ProdutoVitrine[] = ((linksRaw ?? []) as unknown[])
    .map((l) => {
      const p = (l as { produto: ProdutoVitrine | ProdutoVitrine[] }).produto;
      return Array.isArray(p) ? p[0] : p;
    })
    .filter((p): p is ProdutoVitrine => Boolean(p) && ["curado", "publicado"].includes(p?.status ?? ""));
  // só os que já têm vídeo processado (pro carrossel de vídeo)
  const produtosComVideo = produtos.filter((p) => p.video_url);

  // carrosséis (rascunhos primeiro, depois publicados/erro recentes)
  const { data: carrosseisRaw } = await supabase
    .from("carrosseis")
    .select("id, produto_ids, gancho, legenda, status, ig_media_id, erro, tipo")
    .order("criado_em", { ascending: false })
    .limit(20);
  const carrosseis = (carrosseisRaw ?? []) as Carrossel[];
  const rascunhos = carrosseis.filter((c) => c.status !== "publicado");
  const publicados = carrosseis.filter((c) => c.status === "publicado");

  // stories recentes
  const { data: storiesRaw } = await supabase
    .from("stories")
    .select("id, produto_id, ok, criado_em")
    .order("criado_em", { ascending: false })
    .limit(14);
  const storiesRecentes = (storiesRaw ?? []) as Array<{ id: number; produto_id: number; ok: boolean; criado_em: string }>;

  // mapa de produtos referenciados (carrosséis + stories) pra thumbnails
  const idsRef = Array.from(
    new Set([...carrosseis.flatMap((c) => c.produto_ids ?? []), ...storiesRecentes.map((s) => s.produto_id)]),
  );
  const { data: refRaw } = idsRef.length
    ? await supabase.from("produtos").select("id, titulo, imagem_url, preco").in("id", idsRef)
    : { data: [] };
  const mapaProd = new Map(
    ((refRaw ?? []) as { id: number; titulo: string; imagem_url: string | null; preco: string | number | null }[]).map(
      (p) => [p.id, p],
    ),
  );

  return (
    <div className="min-h-screen bg-areia">
      <header className="sticky top-0 z-30 border-b border-black/5 bg-areia/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3.5">
          <span className="text-lg font-extrabold tracking-tight text-tinta">
            pirraia<span className="text-pirraia">.</span> <span className="text-fumo">instagram</span>
          </span>
          <div className="flex items-center gap-2">
            <a
              href="/admin/videos"
              className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-bold text-tinta transition-colors hover:bg-white"
            >
              Vídeos
            </a>
            <a
              href="/admin"
              className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-bold text-tinta transition-colors hover:bg-white"
            >
              ← Admin
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-5 py-8">
        {searchParams.ok && (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">
            {searchParams.ok === "publicado"
              ? "Carrossel publicado no Instagram!"
              : searchParams.ok === "story"
                ? "Story publicado no Instagram!"
                : searchParams.ok === "reel"
                  ? "Reel publicado no Instagram! (o vídeo cru passou 🎬)"
                : searchParams.tema
                  ? `Loop do dia rodou (tema: ${searchParams.tema}) — revise o rascunho e publique.`
                  : "Carrossel montado — revise e publique abaixo."}
          </p>
        )}
        {searchParams.erro && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
            {searchParams.erro}
          </p>
        )}
        {!igOn && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800">
            Instagram não configurado (falta IG_USER_ID / IG_ACCESS_TOKEN no servidor). Dá pra montar
            rascunhos, mas o botão de publicar fica desligado até as credenciais existirem.
          </p>
        )}

        {/* MONTAR CARROSSEL */}
        <section className="rounded-2xl bg-white p-5 shadow-carta">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-fumo">Montar carrossel</h2>
              <p className="mt-1 max-w-xl text-xs text-fumo">
                Marca de 2 a 9 produtos. A IA escreve o gancho da capa + a legenda “achados do dia” e monta um
                rascunho pra você revisar. A capa (foto + gancho) entra como 1º slide automaticamente.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* loop do dia: importa Shopee do tema da vez e monta o rascunho */}
              <form action={rodarLoopDoDia}>
                <BotaoSubmit
                  pendingLabel="Importando e montando…"
                  title="Importa produtos Shopee do tema do dia (rodízio), monta o rascunho com os melhores e faz a faxina dos expirados."
                  className="whitespace-nowrap rounded-full bg-pirraia px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-pirraia-dark"
                >
                  Rodar loop do dia
                </BotaoSubmit>
              </form>
              {/* loop com TEMA escolhido (manual): dropdown + palavra custom */}
              <form action={rodarLoopDoDia} className="flex flex-wrap items-center gap-1.5">
                <select
                  name="tema"
                  className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs text-tinta outline-none focus:border-pirraia"
                >
                  {TEMAS.map((t) => (
                    <option key={t.keyword} value={t.keyword}>
                      {t.nome}
                    </option>
                  ))}
                </select>
                <input
                  name="tema_custom"
                  placeholder="ou palavra…"
                  className="w-28 rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs text-tinta outline-none focus:border-pirraia"
                />
                <BotaoSubmit
                  pendingLabel="Importando…"
                  title="Importa da Shopee o tema escolhido (ou a palavra digitada) e monta o rascunho."
                  className="whitespace-nowrap rounded-full bg-pirraia px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-pirraia-dark"
                >
                  Montar tema
                </BotaoSubmit>
              </form>
              {/* automático: a IA escolhe da vitrine já curada */}
              <form action={montarCarrosselAuto}>
                <BotaoSubmit
                  pendingLabel="Montando…"
                  title="A IA escolhe os melhores produtos JÁ na vitrine (temático, sem repetir os postados) e monta o rascunho."
                  className="whitespace-nowrap rounded-full bg-tinta px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-pirraia"
                >
                  Montar da vitrine
                </BotaoSubmit>
              </form>
            </div>
          </div>
          <form action={montarCarrossel} className="mt-4">
            <div className="grid max-h-[420px] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4">
              {produtos.map((p) => (
                <label
                  key={p.id}
                  className="relative cursor-pointer rounded-xl border border-black/10 p-2 transition-colors has-[:checked]:border-pirraia has-[:checked]:ring-2 has-[:checked]:ring-pirraia"
                >
                  <input type="checkbox" name="produtoIds" value={p.id} className="peer sr-only" />
                  <span className="absolute right-2 top-2 z-10 hidden h-5 w-5 items-center justify-center rounded-full bg-pirraia text-[11px] font-bold text-white peer-checked:flex">
                    ✓
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.imagem_url ?? ""}
                    alt={p.titulo}
                    className="aspect-square w-full rounded-lg object-cover"
                  />
                  <div className="mt-1.5 line-clamp-2 text-[11px] font-semibold text-tinta">{p.titulo}</div>
                  <div className="text-[11px] font-bold text-tinta">{brl(p.preco)}</div>
                </label>
              ))}
            </div>
            <BotaoSubmit
              pendingLabel="Montando o carrossel…"
              className="mt-4 rounded-lg bg-pirraia px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-pirraia-dark"
            >
              Montar carrossel
            </BotaoSubmit>
          </form>
        </section>

        {/* MONTAR CARROSSEL DE VÍDEO */}
        <section className="rounded-2xl bg-white p-5 shadow-carta">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-fumo">Montar carrossel de vídeo</h2>
              <p className="mt-1 max-w-xl text-xs text-fumo">
                Marca de 2 a 9 produtos que já têm vídeo. A capa (foto + gancho) entra como 1º slide e cada
                produto vira um vídeo. Só aparece aqui quem tem vídeo pronto —{" "}
                <a href="/admin/videos" className="font-semibold text-pirraia hover:underline">
                  subir vídeos
                </a>
                .
              </p>
            </div>
            <span className="rounded-full bg-black/5 px-3 py-1 text-[11px] font-bold text-fumo">
              {produtosComVideo.length} com vídeo
            </span>
          </div>
          {produtosComVideo.length < 2 ? (
            <p className="mt-4 rounded-xl border border-black/10 bg-areia/50 px-4 py-3 text-xs text-fumo">
              Você precisa de pelo menos 2 produtos com vídeo pronto.{" "}
              <a href="/admin/videos" className="font-semibold text-pirraia hover:underline">
                Sobe os vídeos aqui.
              </a>
            </p>
          ) : (
            <form action={montarCarrosselVideo} className="mt-4">
              <div className="grid max-h-[420px] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4">
                {produtosComVideo.map((p) => (
                  <label
                    key={p.id}
                    className="relative cursor-pointer rounded-xl border border-black/10 p-2 transition-colors has-[:checked]:border-pirraia has-[:checked]:ring-2 has-[:checked]:ring-pirraia"
                  >
                    <input type="checkbox" name="produtoIds" value={p.id} className="peer sr-only" />
                    <span className="absolute right-2 top-2 z-10 hidden h-5 w-5 items-center justify-center rounded-full bg-pirraia text-[11px] font-bold text-white peer-checked:flex">
                      ✓
                    </span>
                    <span className="absolute left-2 top-2 z-10 rounded-full bg-black/70 px-1.5 py-0.5 text-[9px] font-bold text-white">
                      VÍDEO
                    </span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.imagem_url ?? ""}
                      alt={p.titulo}
                      className="aspect-square w-full rounded-lg object-cover"
                    />
                    <div className="mt-1.5 line-clamp-2 text-[11px] font-semibold text-tinta">{p.titulo}</div>
                    <div className="text-[11px] font-bold text-tinta">{brl(p.preco)}</div>
                  </label>
                ))}
              </div>
              <BotaoSubmit
                pendingLabel="Montando o carrossel de vídeo…"
                className="mt-4 rounded-lg bg-tinta px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-pirraia"
              >
                Montar carrossel de vídeo
              </BotaoSubmit>
            </form>
          )}
        </section>

        {/* STORIES automáticos */}
        <section className="rounded-2xl bg-white p-5 shadow-carta">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-fumo">Stories automáticos</h2>
              <p className="mt-1 max-w-2xl text-xs text-fumo">
                Um cron dispara a arte de um produto no story em cada horário (recomendado 8/dia:
                09h, 11h, 13h, 15h, 18h, 20h, 22h, 23h). Escolhe da vitrine (ou fila), sem repetir os
                últimos 2 dias. Sem link clicável (bloqueio da Meta) — a arte manda pro link da bio.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <form action={postarStoryAgora}>
                <BotaoSubmit
                  disabled={!igOn}
                  pendingLabel="Postando story…"
                  title={igOn ? "Posta 1 story agora (teste do fluxo automático)" : "Configure o Instagram no servidor primeiro"}
                  className="whitespace-nowrap rounded-full bg-[#C13584] px-4 py-2 text-xs font-bold text-white transition hover:brightness-95 disabled:opacity-40"
                >
                  Postar story agora
                </BotaoSubmit>
              </form>
              <form action={postarReelTeste}>
                <BotaoSubmit
                  disabled={!igOn}
                  pendingLabel="Postando reel… (demora)"
                  title="EXPERIMENTAL: pega um produto AliExpress com vídeo e tenta publicar como Reel (vídeo cru)."
                  className="whitespace-nowrap rounded-full border border-black/10 px-4 py-2 text-xs font-bold text-tinta transition-colors hover:bg-areia disabled:opacity-40"
                >
                  Postar Reel (teste)
                </BotaoSubmit>
              </form>
            </div>
          </div>

          {storiesRecentes.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-fumo">Últimos stories</div>
              <div className="flex flex-wrap gap-2">
                {storiesRecentes.map((s) => {
                  const p = mapaProd.get(s.produto_id);
                  return (
                    <div key={s.id} className="w-[70px]" title={p?.titulo ?? `#${s.produto_id}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p?.imagem_url ?? ""}
                        alt=""
                        className={`h-[92px] w-[70px] rounded-md object-cover ${s.ok ? "" : "opacity-40 ring-1 ring-red-300"}`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* RASCUNHOS */}
        {rascunhos.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-fumo">Rascunhos</h2>
            {rascunhos.map((c) => (
              <div key={c.id} className="rounded-2xl bg-white p-5 shadow-carta">
                {c.tipo === "video" && (
                  <div className="mb-3 inline-flex items-center rounded-full bg-tinta px-3 py-1 text-[11px] font-bold text-white">
                    CARROSSEL DE VÍDEO · capa + vídeos dos produtos
                  </div>
                )}
                <div className="flex flex-wrap items-start gap-3">
                  {/* prévia da CAPA (1º slide) */}
                  <div className="flex flex-col items-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/capa/${c.id}?preview=1&g=${encodeURIComponent(c.gancho).slice(0, 40)}`}
                      alt="capa do carrossel"
                      className="h-[150px] w-[120px] rounded-lg object-cover ring-2 ring-pirraia"
                    />
                    <span className="mt-1 text-[10px] font-bold uppercase text-pirraia">capa</span>
                  </div>
                  {/* produtos do rascunho: foto + título + preço + remover */}
                  <div className="flex flex-1 flex-wrap gap-2">
                    {(c.produto_ids ?? []).map((pid, i) => {
                      const p = mapaProd.get(pid);
                      const foraDoPost = i >= 9; // além dos 9 primeiros não vai pro post
                      return (
                        <div
                          key={pid}
                          className={`relative w-[124px] ${foraDoPost ? "opacity-45" : ""}`}
                          title={foraDoPost ? "Fora do post (o Instagram leva só 9). Remova outros pra este entrar." : p?.titulo ?? ""}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p?.imagem_url ?? ""}
                            alt={p?.titulo ?? ""}
                            className="h-[124px] w-[124px] rounded-lg object-cover"
                          />
                          <form action={removerDoCarrossel} className="absolute right-1 top-1">
                            <input type="hidden" name="carrosselId" value={c.id} />
                            <input type="hidden" name="produtoId" value={pid} />
                            <button
                              type="submit"
                              aria-label="Remover do carrossel"
                              title="Remover do carrossel"
                              className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-sm font-bold text-fumo shadow transition-colors hover:text-red-600"
                            >
                              ×
                            </button>
                          </form>
                          <div className="mt-1 line-clamp-2 text-[11px] font-medium text-tinta">
                            {p?.titulo ?? `#${pid}`}
                          </div>
                          <div className="text-[11px] font-bold text-tinta">{brl(Number(p?.preco ?? 0))}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <p className="mt-2 text-xs text-fumo">
                  {(c.produto_ids ?? []).length} produtos no rascunho · o post leva a capa +{" "}
                  {Math.min(9, (c.produto_ids ?? []).length)} (os além do 9º ficam esmaecidos e não vão) —
                  remove os que não curtiu.
                </p>

                {c.status === "erro" && c.erro && (
                  <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                    Falhou na última tentativa: {c.erro}
                  </p>
                )}

                {/* gancho da capa: form próprio — salva e a prévia da capa atualiza */}
                <form action={atualizarGancho} className="mt-3">
                  <input type="hidden" name="carrosselId" value={c.id} />
                  <label className="text-xs font-medium text-fumo">
                    Gancho da capa (edita e clica em Atualizar capa pra ver o resultado)
                    <div className="mt-1 flex gap-2">
                      <input
                        name="gancho"
                        defaultValue={c.gancho}
                        className="min-w-0 flex-1 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-tinta outline-none focus:border-pirraia"
                      />
                      <BotaoSubmit
                        pendingLabel="Atualizando…"
                        className="shrink-0 rounded-lg border border-black/10 px-4 py-2 text-xs font-bold text-tinta transition-colors hover:bg-areia"
                      >
                        Atualizar capa
                      </BotaoSubmit>
                    </div>
                  </label>
                </form>

                <form action={publicarCarrossel} className="mt-3">
                  <input type="hidden" name="carrosselId" value={c.id} />
                  <label className="block text-xs font-medium text-fumo">
                    Legenda (dá pra editar antes de publicar)
                    <textarea
                      name="legenda"
                      defaultValue={c.legenda}
                      rows={6}
                      className="mt-1 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-tinta outline-none focus:border-pirraia"
                    />
                  </label>
                  <div className="mt-3 flex items-center gap-2">
                    <BotaoSubmit
                      disabled={!igOn}
                      pendingLabel="Publicando no Instagram…"
                      title={igOn ? "Publica o carrossel no feed do @pirraiashop" : "Configure o Instagram no servidor primeiro"}
                      className="rounded-lg bg-[#C13584] px-5 py-2 text-sm font-bold text-white transition hover:brightness-95 disabled:opacity-40"
                    >
                      Publicar no Instagram
                    </BotaoSubmit>
                  </div>
                </form>

                <form action={descartarCarrossel} className="mt-2">
                  <input type="hidden" name="carrosselId" value={c.id} />
                  <BotaoSubmit
                    spinner={false}
                    pendingLabel="Descartando…"
                    className="text-xs font-semibold text-fumo hover:text-red-600"
                  >
                    Descartar rascunho
                  </BotaoSubmit>
                </form>
              </div>
            ))}
          </section>
        )}

        {/* PUBLICADOS */}
        {publicados.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-fumo">Publicados</h2>
            {publicados.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-carta">
                <div className="flex flex-wrap gap-1.5">
                  {(c.produto_ids ?? []).slice(0, 5).map((pid) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={pid}
                      src={mapaProd.get(pid)?.imagem_url ?? ""}
                      alt=""
                      className="h-12 w-12 rounded-md object-cover"
                    />
                  ))}
                </div>
                <span className="ml-auto text-xs font-medium text-emerald-700">
                  publicado · {(c.produto_ids ?? []).length} itens
                </span>
              </div>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
