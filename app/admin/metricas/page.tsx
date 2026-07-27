import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface LinkRow {
  id: number;
  slug: string;
  cliques: number;
  produto: { titulo: string; imagem_url: string | null };
}
interface CliqueRow {
  link_id: number;
  utm_source: string | null;
  criado_em: string;
}

const diaISO = (d: Date) => d.toISOString().slice(0, 10);

export default async function Metricas() {
  const supabase = supabaseAdmin();

  const desde = new Date(Date.now() - 30 * 864e5).toISOString();

  const [{ data: linksRaw }, { data: cliquesRaw }] = await Promise.all([
    supabase
      .from("links")
      .select("id, slug, cliques, produto:produtos!inner(titulo, imagem_url)")
      .order("cliques", { ascending: false }),
    supabase
      .from("cliques")
      .select("link_id, utm_source, criado_em")
      .gte("criado_em", desde)
      .order("criado_em", { ascending: false })
      .limit(5000),
  ]);

  const links = ((linksRaw ?? []) as unknown[]).map((l) => {
    const row = l as LinkRow & { produto: LinkRow["produto"] | LinkRow["produto"][] };
    const produto = Array.isArray(row.produto) ? row.produto[0] : row.produto;
    return { ...row, produto } as LinkRow;
  });
  const cliques = (cliquesRaw ?? []) as CliqueRow[];

  const totalGeral = links.reduce((s, l) => s + (l.cliques ?? 0), 0);
  const hojeISO = diaISO(new Date());
  const seteDias = diaISO(new Date(Date.now() - 6 * 864e5));
  const cliquesHoje = cliques.filter((c) => diaISO(new Date(c.criado_em)) === hojeISO).length;
  const cliques7d = cliques.filter((c) => diaISO(new Date(c.criado_em)) >= seteDias).length;

  // série dos últimos 14 dias
  const dias: { label: string; iso: string; n: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5);
    dias.push({ iso: diaISO(d), label: `${d.getDate()}/${d.getMonth() + 1}`, n: 0 });
  }
  const idxDia = new Map(dias.map((d, i) => [d.iso, i]));
  for (const c of cliques) {
    const i = idxDia.get(diaISO(new Date(c.criado_em)));
    if (i !== undefined) dias[i].n++;
  }
  const maxDia = Math.max(1, ...dias.map((d) => d.n));

  // origem (utm_source) nos últimos 30 dias
  const porOrigem = new Map<string, number>();
  for (const c of cliques) {
    const k = c.utm_source?.trim() || "sem origem";
    porOrigem.set(k, (porOrigem.get(k) ?? 0) + 1);
  }
  const origens = [...porOrigem.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxOrigem = Math.max(1, ...origens.map(([, n]) => n));

  const topProdutos = links.filter((l) => l.cliques > 0).slice(0, 8);
  const semDados = totalGeral === 0;

  return (
    <div className="min-h-screen bg-areia">
      <header className="sticky top-0 z-30 border-b border-black/5 bg-areia/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3.5">
          <span className="text-lg font-extrabold tracking-tight text-tinta">
            pirraia<span className="text-pirraia">.</span>{" "}
            <span className="text-fumo">métricas</span>
          </span>
          <a
            href="/admin"
            className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-bold text-tinta transition-colors hover:bg-white"
          >
            ← Admin
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-5 py-8">
        {/* números-chave */}
        <section className="grid grid-cols-3 gap-3">
          {[
            { rotulo: "Cliques hoje", valor: cliquesHoje },
            { rotulo: "Últimos 7 dias", valor: cliques7d },
            { rotulo: "Total (sempre)", valor: totalGeral },
          ].map((s) => (
            <div key={s.rotulo} className="rounded-2xl bg-white p-4 shadow-carta">
              <div className="text-2xl font-extrabold tabular-nums tracking-tight text-tinta">
                {s.valor.toLocaleString("pt-BR")}
              </div>
              <div className="mt-0.5 text-xs text-fumo">{s.rotulo}</div>
            </div>
          ))}
        </section>

        {semDados ? (
          <p className="rounded-2xl bg-white p-8 text-center text-sm text-fumo shadow-carta">
            Ainda sem cliques. Assim que o tráfego começar a passar pelos links{" "}
            <code className="rounded bg-areia px-1">/r/…</code>, os números aparecem aqui.
          </p>
        ) : (
          <>
            {/* série por dia */}
            <section className="rounded-2xl bg-white p-5 shadow-carta">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-fumo">
                Cliques por dia · 14 dias
              </h2>
              <div className="flex h-32 items-end gap-1.5">
                {dias.map((d) => (
                  <div key={d.iso} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t bg-pirraia/85"
                      style={{ height: `${(d.n / maxDia) * 100}%`, minHeight: d.n > 0 ? "3px" : "0" }}
                      title={`${d.label}: ${d.n}`}
                    />
                    <span className="text-[9px] tabular-nums text-fumo">{d.label}</span>
                  </div>
                ))}
              </div>
            </section>

            <div className="grid gap-6 sm:grid-cols-2">
              {/* top produtos */}
              <section>
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-fumo">
                  Top produtos
                </h2>
                <ul className="space-y-2">
                  {topProdutos.map((l) => (
                    <li
                      key={l.id}
                      className="flex items-center gap-3 rounded-xl bg-white p-2.5 shadow-carta"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={l.produto.imagem_url ?? ""}
                        alt={l.produto.titulo}
                        className="h-9 w-9 shrink-0 rounded-lg object-cover"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm text-tinta">
                        {l.produto.titulo}
                      </span>
                      <span className="shrink-0 text-sm font-bold tabular-nums text-tinta">
                        {l.cliques}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              {/* origem */}
              <section>
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-fumo">
                  Origem · 30 dias
                </h2>
                <ul className="space-y-2.5 rounded-2xl bg-white p-4 shadow-carta">
                  {origens.map(([nome, n]) => (
                    <li key={nome}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="truncate text-tinta">{nome}</span>
                        <span className="tabular-nums font-semibold text-fumo">{n}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-areia">
                        <div
                          className="h-full rounded-full bg-pirraia"
                          style={{ width: `${(n / maxOrigem) * 100}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
