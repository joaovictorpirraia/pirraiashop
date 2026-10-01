import { supabaseAdmin } from "@/lib/supabase";
import { brl } from "@/lib/format";
import { BotaoSubmit } from "@/components/BotaoSubmit";
import { CopiarTexto } from "@/components/CopiarTexto";
import { instagramConfigurado } from "@/lib/instagram";
import {
  adicionarProduto3D,
  removerProduto3D,
  gerarLegenda3D,
  salvarLegenda3D,
  publicarNoFeed3D,
  precificarImportado3D,
  descartarImportado3D,
} from "../actions";

export const dynamic = "force-dynamic";

interface Post3D {
  id: number;
  produto_id: number;
  legenda: string | null;
  hashtags: string[] | null;
  status: string;
}

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

// bookmarklet de LOTE: na sua página de Coleções > Modelos do MakerWorld, varre a API
// de favoritos (paginada) no SEU navegador logado e manda tudo pro /admin/importar-3d.
const BOOKMARKLET_LOTE =
  "javascript:(async function(){try{var uid=localStorage.getItem('uid');var m=location.pathname.match(/@([^/]+)/);var h=m?('@'+m[1]):'';if(!uid){alert('Abra sua pagina de Colecoes do MakerWorld, logado, e clique aqui la.');return;}var itens=[],off=0,total=null;for(var gd=0;gd<40;gd++){var r=await fetch('https://makerworld.com/api/v1/design-service/favorites/designs/'+uid+'?handle='+encodeURIComponent(h)+'&limit=20&offset='+off,{headers:{accept:'application/json'},credentials:'include'});if(!r.ok)break;var j=await r.json();if(total==null)total=j.total||j.totalCount||j.count||0;var a=j.hits||j.list||j.designs||j.data||(Array.isArray(j)?j:[]);if(!a||!a.length)break;for(var i=0;i<a.length;i++){var d=a[i].design||a[i];var id=d.id||d.designId||a[i].designId||a[i].id;var t=d.title||d.name||a[i].title||'';var im=d.cover||d.coverUrl||d.coverPic||a[i].cover||(d.covers&&d.covers[0])||'';if(im&&im.url)im=im.url;var lc=d.license||d.licenseType||a[i].license||'';if(id&&t&&im)itens.push({id:id,titulo:t,imagem_url:im,licenca:lc,fonte:'https://makerworld.com/models/'+id});}off+=20;if(total&&itens.length>=total)break;}if(!itens.length){alert('Nao achei itens. Confirme que esta na aba Colecoes > Modelos, logado.');return;}var f=document.createElement('form');f.method='POST';f.action='https://pirraiashop.com.br/admin/importar-3d';f.target='_blank';var ip=document.createElement('input');ip.type='hidden';ip.name='itens';ip.value=JSON.stringify(itens);f.appendChild(ip);document.body.appendChild(f);f.submit();}catch(e){alert('Erro: '+e.message);}})();";

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

  // rascunhos de legenda 3D (canal instagram_3d), um por produto
  const ids = lista.map((p) => p.id);
  const { data: postsRaw } = ids.length
    ? await supabase.from("posts").select("id, produto_id, legenda, hashtags, status").eq("canal", "instagram_3d").in("produto_id", ids)
    : { data: [] as Post3D[] };
  const postPorProduto = new Map<number, Post3D>();
  for (const post of (postsRaw ?? []) as Post3D[]) postPorProduto.set(post.produto_id, post);
  const igOn = instagramConfigurado();

  // fila de importados: peças próprias status 'novo' (sem preço, fora da /3d)
  const { data: importadosRaw } = await supabase
    .from("produtos")
    .select("id, titulo, imagem_url, licenca")
    .eq("proprio", true)
    .eq("status", "novo")
    .order("id", { ascending: false })
    .limit(300);
  const importados = (importadosRaw ?? []) as { id: number; titulo: string; imagem_url: string | null; licenca: string | null }[];

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

        <div className="mt-4 border-t border-black/10 pt-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-fumo">Importar coleção inteira</h3>
          <p className="mt-1 text-xs text-fumo">
            <b>Arrasta</b> este outro botão pra a barra. Depois, na sua página de <b>Coleções → Modelos</b> do
            MakerWorld (logado), clica nele: ele puxa <b>todos</b> os modelos salvos de uma vez pra fila de
            preços aqui embaixo. Nada vai pra /3d até você botar o preço.
          </p>
          <div
            className="mt-3"
            dangerouslySetInnerHTML={{
              __html: `<a href="${BOOKMARKLET_LOTE}" class="inline-block rounded-lg bg-pirraia px-4 py-2 text-sm font-bold text-white no-underline">Importar coleção Pirraia 3D</a>`,
            }}
          />
          <p className="mt-2 text-[11px] text-fumo">
            Também é pra <b>arrastar</b>, não clicar. Use na página da sua coleção do MakerWorld.
          </p>
        </div>
      </section>

      {/* FILA: importados sem preço */}
      {importados.length > 0 && (
        <section className="mb-8 rounded-2xl border border-amber-300 bg-amber-50/40 p-5">
          <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-amber-800">
            Importados — defina o preço ({importados.length})
          </h2>
          <p className="mb-3 text-xs text-amber-800/80">
            Vieram da sua coleção do MakerWorld. <b>Confira a licença</b> (âmbar = precisa da licença
            comercial do criador), bota o preço e publica na /3d. Ou descarta o que não vai vender.
          </p>
          <div className="flex flex-col gap-3">
            {importados.map((p) => {
              const livre = licencaComercialLivre(p.licenca ?? "");
              return (
                <div key={p.id} className="flex items-center gap-3 rounded-xl border border-black/10 bg-white p-2.5">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-black/5">
                    {p.imagem_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imagem_url} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-1 text-xs font-semibold text-tinta">{p.titulo}</div>
                    <div className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${livre ? "bg-emerald-100 text-emerald-700" : "bg-amber-200 text-amber-900"}`}>
                      {p.licenca ? (livre ? "licença ok p/ vender" : `licença: ${p.licenca}`) : "licença não detectada"}
                    </div>
                  </div>
                  <form action={precificarImportado3D} className="flex items-center gap-1.5">
                    <input type="hidden" name="produtoId" value={p.id} />
                    <span className="text-xs text-tinta/50">R$</span>
                    <input name="preco" type="number" step="0.01" min="0" required placeholder="49.90" className="w-20 rounded-lg border border-black/10 px-2 py-1.5 text-sm text-tinta outline-none focus:border-pirraia" />
                    <BotaoSubmit pendingLabel="…" className="rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-95">
                      Publicar
                    </BotaoSubmit>
                  </form>
                  <form action={descartarImportado3D}>
                    <input type="hidden" name="produtoId" value={p.id} />
                    <button type="submit" className="text-[11px] text-tinta/40 hover:text-red-600">descartar</button>
                  </form>
                </div>
              );
            })}
          </div>
        </section>
      )}

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
            Foto do PC (a tua foto do print converte mais)
            <input name="foto" type="file" accept="image/*" className="rounded-lg border border-black/10 px-3 py-2 text-sm text-tinta file:mr-3 file:rounded-md file:border-0 file:bg-pirraia file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white outline-none" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-fumo sm:col-span-2">
            …ou cole uma URL (é o que vem do MakerWorld pelo bookmarklet)
            <input name="imagem_url" defaultValue={searchParams.imagem_url || ""} placeholder="https://..." className="rounded-lg border border-black/10 px-3 py-2 text-sm text-tinta outline-none focus:border-pirraia" />
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
      <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-fumo">Na /3d ({lista.length})</h2>
      <p className="mb-3 text-xs text-tinta/60">
        Cada peça gera a <b>arte 4:5</b> (pra postar no feed) e a <b>legenda</b> por IA (tom de
        encomenda, CTA no WhatsApp). {igOn ? "Dá pra publicar direto no feed." : "Publicação direta desligada (sem IG_* no servidor) — copie a legenda e poste na mão."}
      </p>
      {lista.length === 0 ? (
        <p className="text-sm text-tinta/50">Nenhuma peça 3D ainda. Adiciona a primeira acima.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {lista.map((p) => {
            const post = postPorProduto.get(p.id);
            return (
              <div key={p.id} className="flex flex-col gap-3 rounded-2xl border border-black/10 bg-white p-3 sm:flex-row">
                {/* foto + arte */}
                <div className="flex shrink-0 gap-3">
                  <div className="h-28 w-28 overflow-hidden rounded-xl bg-black/5">
                    {p.imagem_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imagem_url} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="flex flex-col justify-between">
                    <div>
                      <div className="line-clamp-2 max-w-[220px] text-sm font-semibold text-tinta">{p.titulo}</div>
                      <div className="text-base font-bold text-tinta">{brl(Number(p.preco))}</div>
                    </div>
                    <a href={`/api/criativo3d/${p.id}`} target="_blank" rel="noreferrer" className="inline-block rounded-full bg-tinta px-3 py-1.5 text-center text-[11px] font-bold text-white hover:opacity-90">
                      Ver arte 4:5 ↗
                    </a>
                  </div>
                </div>

                {/* legenda */}
                <div className="flex flex-1 flex-col gap-2">
                  {!post ? (
                    <form action={gerarLegenda3D}>
                      <input type="hidden" name="produtoId" value={p.id} />
                      <BotaoSubmit pendingLabel="Gerando…" className="rounded-lg bg-pirraia px-4 py-2 text-xs font-bold text-white transition hover:opacity-90">
                        Gerar legenda com IA
                      </BotaoSubmit>
                    </form>
                  ) : (
                    <>
                      <form action={salvarLegenda3D} className="flex flex-col gap-1.5">
                        <input type="hidden" name="postId" value={post.id} />
                        <textarea name="legenda" rows={4} defaultValue={post.legenda ?? ""} className="resize-y rounded-lg border border-black/10 px-3 py-2 text-xs text-tinta outline-none focus:border-pirraia" />
                        <input name="hashtags" defaultValue={(post.hashtags ?? []).join(" ")} placeholder="hashtags separadas por espaço" className="rounded-lg border border-black/10 px-3 py-1.5 text-xs text-tinta outline-none focus:border-pirraia" />
                        <div className="flex flex-wrap items-center gap-2">
                          <BotaoSubmit pendingLabel="Salvando…" className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-bold text-tinta hover:bg-areia/40">
                            Salvar edição
                          </BotaoSubmit>
                        </div>
                      </form>
                      <div className="flex flex-wrap items-center gap-2">
                        <form action={gerarLegenda3D}>
                          <input type="hidden" name="produtoId" value={p.id} />
                          <BotaoSubmit pendingLabel="Regerando…" className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-bold text-tinta hover:bg-areia/40">
                            Regerar com IA
                          </BotaoSubmit>
                        </form>
                        {igOn && post.status !== "publicado" && (
                          <form action={publicarNoFeed3D}>
                            <input type="hidden" name="postId" value={post.id} />
                            <input type="hidden" name="produtoId" value={p.id} />
                            <BotaoSubmit pendingLabel="Publicando…" className="rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-95">
                              Publicar no feed
                            </BotaoSubmit>
                          </form>
                        )}
                        {post.status === "publicado" && (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">publicado ✓</span>
                        )}
                      </div>
                      <CopiarTexto
                        texto={[post.legenda?.trim(), (post.hashtags ?? []).map((h) => "#" + h).join(" ")].filter(Boolean).join("\n\n")}
                        rotulo="Copiar legenda + hashtags"
                      />
                    </>
                  )}
                </div>

                {/* remover */}
                <form action={removerProduto3D} className="shrink-0">
                  <input type="hidden" name="produtoId" value={p.id} />
                  <button type="submit" className="text-[11px] text-tinta/40 hover:text-red-600">
                    remover
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
