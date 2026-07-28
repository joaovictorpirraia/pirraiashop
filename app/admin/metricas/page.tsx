import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface LinkRow {
  id: number;
  slug: string;
  cliques: number;
  produto: { titulo: string; imagem_url: string | null; categoria: string | null };
}
interface CliqueRow {
  link_id: number;
  utm_source: string | null;
  utm_medium: string | null;
  criado_em: string;
}

const diaISO = (d: Date) => d.toISOString().slice(0, 10);

// Dia/hora do clique em horário de Brasília — o servidor (VPS) pode rodar em UTC,
// então não dá pra confiar no fuso local do Node. Deriva com Intl no America/Sao_Paulo.
const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const fmtBRT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Sao_Paulo",
  weekday: "short",
  hour: "2-digit",
  hour12: false,
});
const WD_IDX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};
function partesBRT(iso: string): { wd: number; hr: number } {
  const p = fmtBRT.formatToParts(new Date(iso));
  const wd = WD_IDX[p.find((x) => x.type === "weekday")?.value ?? "Sun"] ?? 0;
  const hrRaw = Number(p.find((x) => x.type === "hour")?.value ?? "0");
  return { wd, hr: hrRaw === 24 ? 0 : hrRaw };
}

export default async function Metricas() {
  const supabase = supabaseAdmin();

  const desde = new Date(Date.now() - 30 * 864e5).toISOString();

  const [{ data: linksRaw }, { data: cliquesRaw }] = await Promise.all([
    supabase
      .from("links")
      .select("id, slug, cliques, produto:produtos!inner(titulo, imagem_url, categoria)")
      .order("cliques", { ascending: false }),
    supabase
      .from("cliques")
      .select("link_id, utm_source, utm_medium, criado_em")
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

  // dia da semana e hora (Brasília), 30 dias
  const porDiaSemana = new Array(7).fill(0) as number[];
  const porHora = new Array(24).fill(0) as number[];
  for (const c of cliques) {
    const { wd, hr } = partesBRT(c.criado_em);
    porDiaSemana[wd]++;
    porHora[hr]++;
  }
  const maxDiaSemana = Math.max(1, ...porDiaSemana);
  const maxHora = Math.max(1, ...porHora);
  const melhorDia = porDiaSemana.indexOf(Math.max(...porDiaSemana));
  const melhorHora = porHora.indexOf(Math.max(...porHora));

  // origem: utm_source + utm_medium (per-UTM), 30 dias
  const porOrigem = new Map<string, number>();
  for (const c of cliques) {
    const src = c.utm_source?.trim() || "sem origem";
    const med = c.utm_medium?.trim();
    const k = med ? `${src} · ${med}` : src;
    porOrigem.set(k, (porOrigem.get(k) ?? 0) + 1);
  }
  const origens = [...porOrigem.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxOrigem = Math.max(1, ...origens.map(([, n]) => n));

  // por categoria (junta link -> produto.categoria), 30 dias
  const catPorLink = new Map(links.map((l) => [l.id, l.produto?.categoria?.trim() || "sem categoria"]));
  const porCategoria = new Map<string, number>();
  for (const c of cliques) {
    const cat = catPorLink.get(c.link_id) ?? "sem categoria";
    porCategoria.set(cat, (porCategoria.get(cat) ?? 0) + 1);
  }
  const categorias = [...porCategoria.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxCategoria = Math.max(1, ...categorias.map(([, n]) => n));

  const topProdutos = links.filter((l) => l.cliques > 0).slice(0, 8);
  const semDados = totalGeral === 0;
  const semJanela = cliques.length === 0; // sem cliques nos últimos 30 dias

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

            {semJanela ? (
              <p className="rounded-2xl bg-white p-6 text-center text-sm text-fumo shadow-carta">
                Sem cliques nos últimos 30 dias — os cortes por dia, horário, origem e
                categoria aparecem quando houver tráfego recente.
              </p>
            ) : (
              <>
                {/* melhores dias e horários */}
                <div className="grid gap-6 sm:grid-cols-2">
                  <section className="rounded-2xl bg-white p-5 shadow-carta">
                    <div className="mb-4 flex items-baseline justify-between">
                      <h2 className="text-sm font-bold uppercase tracking-wide text-fumo">
                        Dia da semana
                      </h2>
                      <span className="text-xs font-semibold text-pirraia">
                        pico: {DIAS_SEMANA[melhorDia]}
                      </span>
                    </div>
                    <div className="flex h-28 items-end gap-2">
                      {porDiaSemana.map((n, i) => (
                        <div key={i} className="flex flex-1 flex-col items-center gap-1">
                          <div
                            className={`w-full rounded-t ${i === melhorDia ? "bg-pirraia" : "bg-pirraia/40"}`}
                            style={{ height: `${(n / maxDiaSemana) * 100}%`, minHeight: n > 0 ? "3px" : "0" }}
                            title={`${DIAS_SEMANA[i]}: ${n}`}
                          />
                          <span className="text-[9px] text-fumo">{DIAS_SEMANA[i]}</span>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-2xl bg-white p-5 shadow-carta">
                    <div className="mb-4 flex items-baseline justify-between">
                      <h2 className="text-sm font-bold uppercase tracking-wide text-fumo">
                        Horário
                      </h2>
                      <span className="text-xs font-semibold text-pirraia">
                        pico: {String(melhorHora).padStart(2, "0")}h
                      </span>
                    </div>
                    <div className="flex h-28 items-end gap-px">
                      {porHora.map((n, h) => (
                        <div
                          key={h}
                          className={`flex-1 rounded-t ${h === melhorHora ? "bg-pirraia" : "bg-pirraia/40"}`}
                          style={{ height: `${(n / maxHora) * 100}%`, minHeight: n > 0 ? "3px" : "0" }}
                          title={`${String(h).padStart(2, "0")}h: ${n}`}
                        />
                      ))}
                    </div>
                    <div className="mt-1 flex justify-between text-[9px] tabular-nums text-fumo">
                      <span>0h</span>
                      <span>6h</span>
                      <span>12h</span>
                      <span>18h</span>
                      <span>23h</span>
                    </div>
                  </section>
                </div>

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

                  {/* categoria */}
                  <section>
                    <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-fumo">
                      Categoria · 30 dias
                    </h2>
                    <ul className="space-y-2.5 rounded-2xl bg-white p-4 shadow-carta">
                      {categorias.map(([nome, n]) => (
                        <li key={nome}>
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span className="truncate text-tinta">{nome}</span>
                            <span className="tabular-nums font-semibold text-fumo">{n}</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-areia">
                            <div
                              className="h-full rounded-full bg-tinta/70"
                              style={{ width: `${(n / maxCategoria) * 100}%` }}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>

                {/* origem (utm_source · utm_medium) */}
                <section>
                  <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-fumo">
                    Origem do tráfego · 30 dias
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
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
