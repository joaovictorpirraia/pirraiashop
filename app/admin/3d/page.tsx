import { supabaseAdmin } from "@/lib/supabase";
import { brl } from "@/lib/format";
import { BotaoSubmit } from "@/components/BotaoSubmit";
import { adicionarProduto3D, removerProduto3D } from "../actions";

export const dynamic = "force-dynamic";

interface Prod3D {
  id: number;
  titulo: string;
  preco: string | number | null;
  imagem_url: string | null;
  descricao: string | null;
}

// bookmarklet do MakerWorld: pega og:title, og:image e license da página do modelo
// (que passou o Cloudflare no navegador do dono) e abre este form pré-preenchido.
// Só aspas simples + \x22 no regex, pra caber num href sem escape.
const BOOKMARKLET =
  "javascript:(function(){var g=function(p){var l=document.getElementsByTagName('meta');for(var i=0;i<l.length;i++){if(l[i].getAttribute('property')===p)return l[i].content||''}return ''};var t=(g('og:title')||document.title||'').split(' | ')[0].split(' - ')[0].trim();var img=g('og:image');var lic='';try{var s=JSON.stringify(window.__NEXT_DATA__);var m=s.match(/license\\x22:\\x22([^\\x22]+)/);if(m)lic=m[1];}catch(e){}var u='https://pirraiashop.com.br/admin/3d?titulo='+encodeURIComponent(t)+'&imagem_url='+encodeURIComponent(img)+'&licenca='+encodeURIComponent(lic)+'&fonte='+encodeURIComponent(location.href.split('#')[0]);window.open(u,'_blank');})();";

/** true se a licença permite vender print sem pagar (Public Domain / CC0 / BY sem NC). */
function licencaComercialLivre(lic: string): boolean {
  const l = lic.toLowerCase();
  if (l.includes("nc") || l.includes("standard digital")) return false;
  return l.includes("public domain") || l.includes("cc0") || /(^|[^n])by/.test(l);
}

export default async function Admin3D({
  searchParams,
}: {
  searchParams: {
    ok?: string;
    erro?: string;
    removido?: string;
    titulo?: string;
    imagem_url?: string;
    licenca?: string;
    fonte?: string;
  };
}) {
  const supabase = supabaseAdmin();
  const { data } = await supabase
    .from("links")
    .select("slug, produto:produtos!inner(id, titulo, preco, imagem_url, descricao, proprio, status)")
    .eq("ativo", true)
    .limit(300);

  const lista = ((data ?? []) as unknown[])
    .map((l) => {
      const p = (l as { slug: string; produto: (Prod3D & { proprio: boolean; status: string }) | (Prod3D & { proprio: boolean; status: string })[] }).produto;
      const prod = Array.isArray(p) ? p[0] : p;
      return { slug: (l as { slug: string }).slug, ...prod };
    })
    .filter((p) => p && p.proprio && ["curado", "publicado"].includes(p.status));

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-tinta">Produtos 3D (venda direta)</h1>
        <div className="flex items-center gap-2 text-sm">
          <a href="/3d" target="_blank" rel="noreferrer" className="font-semibold text-pirraia hover:underline">
            ver a aba /3d ↗
          </a>
          <a href="/admin" className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-bold text-tinta hover:bg-white">
            ← Admin
          </a>
        </div>
      </div>
      <p className="mb-4 text-sm text-tinta/70">
        Peças que você imprime e vende direto (via WhatsApp). Entram na aba <b>/3d</b>, não na vitrine
        de achadinhos. O botão de compra já vai com a mensagem de encomenda pronta.
      </p>

      {searchParams.ok && (
        <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">
          Produto 3D adicionado! Já está na aba /3d.
        </p>
      )}
      {searchParams.removido && (
        <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">
          Produto removido da /3d.
        </p>
      )}
      {searchParams.erro && (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
          Faltou algo (título, foto e preço são obrigatórios; a foto tem que ser uma URL http).
        </p>
      )}

      {/* BOOKMARKLET do MakerWorld */}
      <section className="mb-6 rounded-2xl border border-black/10 bg-white p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-fumo">Puxar do MakerWorld (1 clique)</h2>
        <p className="mt-1 text-xs text-fumo">
          <b>Arrasta</b> o botão abaixo pra tua barra de favoritos. Depois, numa página de modelo do
          MakerWorld, clica nele: ele abre este cadastro já com <b>nome + foto + licença</b>. Você só
          confere a licença e põe o preço.
        </p>
        <div
          className="mt-3"
          dangerouslySetInnerHTML={{
            __html: `<a href="${BOOKMARKLET}" class="inline-block rounded-lg bg-tinta px-4 py-2 text-sm font-bold text-white no-underline">Mandar pro Pirraia 3D</a>`,
          }}
        />
        <p className="mt-2 text-[11px] text-fumo">
          Não clica aqui — <b>arrasta</b> pra a barra de favoritos. Depois use na página do modelo.
        </p>
      </section>

      {/* FORM: adicionar produto 3D */}
      <section className="mb-8 rounded-2xl border border-black/10 bg-white p-5">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-fumo">Adicionar peça 3D</h2>

        {searchParams.licenca && (
          <div
            className={`mb-3 rounded-lg border px-3 py-2 text-xs ${
              licencaComercialLivre(searchParams.licenca)
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-300 bg-amber-50 text-amber-800"
            }`}
          >
            Licença do modelo: <b>{searchParams.licenca}</b>.{" "}
            {licencaComercialLivre(searchParams.licenca)
              ? "Livre pra comércio (dê crédito ao criador se for BY)."
              : "ATENÇÃO: essa licença NÃO libera vender o print sem a licença comercial do criador. Confirma no perfil dele antes de vender."}
          </div>
        )}
        {searchParams.imagem_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={searchParams.imagem_url} alt="" className="mb-3 h-32 w-32 rounded-lg object-cover" />
        )}

        <form action={adicionarProduto3D} className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs font-semibold text-fumo sm:col-span-2">
            Nome da peça
            <input name="titulo" required defaultValue={searchParams.titulo || ""} placeholder="ex: Suporte de celular articulado" className="rounded-lg border border-black/10 px-3 py-2 text-sm text-tinta outline-none focus:border-pirraia" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-fumo sm:col-span-2">
            URL da foto (a tua foto do print converte mais; ou a do modelo)
            <input name="imagem_url" required defaultValue={searchParams.imagem_url || ""} placeholder="https://..." className="rounded-lg border border-black/10 px-3 py-2 text-sm text-tinta outline-none focus:border-pirraia" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-fumo">
            Preço (R$)
            <input name="preco" required type="number" step="0.01" min="0" placeholder="49.90" className="rounded-lg border border-black/10 px-3 py-2 text-sm text-tinta outline-none focus:border-pirraia" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-fumo">
            Slug (opcional)
            <input name="slug" placeholder="suporte-celular" className="rounded-lg border border-black/10 px-3 py-2 text-sm text-tinta outline-none focus:border-pirraia" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-fumo sm:col-span-2">
            Descrição (opcional)
            <textarea name="descricao" rows={2} placeholder="material, cores, prazo…" className="resize-y rounded-lg border border-black/10 px-3 py-2 text-sm text-tinta outline-none focus:border-pirraia" />
          </label>
          <div className="sm:col-span-2">
            <BotaoSubmit pendingLabel="Adicionando…" className="rounded-lg bg-[#25D366] px-5 py-2 text-sm font-bold text-white transition hover:brightness-95">
              Adicionar à /3d
            </BotaoSubmit>
          </div>
        </form>
      </section>

      {/* LISTA */}
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-fumo">Na /3d ({lista.length})</h2>
      {lista.length === 0 ? (
        <p className="text-sm text-tinta/50">Nenhuma peça 3D ainda. Adiciona a primeira acima.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {lista.map((p) => (
            <div key={p.id} className="flex flex-col overflow-hidden rounded-2xl border border-black/10 bg-white">
              <div className="aspect-square bg-black/5">
                {p.imagem_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imagem_url} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1 p-2.5">
                <div className="line-clamp-2 text-xs font-medium text-tinta">{p.titulo}</div>
                <div className="text-sm font-bold text-tinta">{brl(Number(p.preco))}</div>
                <form action={removerProduto3D} className="mt-auto">
                  <input type="hidden" name="produtoId" value={p.id} />
                  <button type="submit" className="text-[11px] text-tinta/50 hover:text-red-600">
                    remover
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
