import { supabaseAdmin } from "@/lib/supabase";
import { editarProduto } from "../../actions";

export const dynamic = "force-dynamic";

export default async function Editar({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { erro?: string };
}) {
  const supabase = supabaseAdmin();
  const produtoId = Number(params.id);
  const erro = searchParams.erro === "1";

  const { data: p } = await supabase
    .from("produtos")
    .select("id, titulo, categoria, preco, preco_antigo, imagem_url, loja_nome")
    .eq("id", produtoId)
    .maybeSingle();
  const { data: link } = await supabase
    .from("links")
    .select("id, slug, short_url")
    .eq("produto_id", produtoId)
    .eq("ativo", true)
    .maybeSingle();

  return (
    <div className="min-h-screen bg-areia">
      <header className="sticky top-0 z-30 border-b border-black/5 bg-areia/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3.5">
          <span className="text-lg font-extrabold tracking-tight text-tinta">
            pirraia<span className="text-pirraia">.</span>{" "}
            <span className="text-fumo">editar produto</span>
          </span>
          <a
            href="/admin"
            className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-bold text-tinta transition-colors hover:bg-white"
          >
            ← Admin
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-5 py-8">
        {!p || !link ? (
          <p className="rounded-2xl bg-white p-8 text-center text-sm text-fumo shadow-carta">
            Produto não encontrado (ou não está na vitrine). <a className="text-pirraia" href="/admin">Voltar</a>.
          </p>
        ) : (
          <>
            {erro && (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                Faltou um campo obrigatório (ou o link não começa com http). Confere e salva de novo.
              </div>
            )}

            <form action={editarProduto} className="space-y-4 rounded-2xl bg-white p-5 shadow-carta">
              <input type="hidden" name="produtoId" value={p.id} />
              <input type="hidden" name="linkId" value={link.id} />

              <Campo nome="titulo" rotulo="Título *" valor={p.titulo} required />
              <Campo nome="short_url" rotulo="Link de afiliado (short_url) *" valor={link.short_url} required />
              <Campo nome="imagem_url" rotulo="URL da imagem *" valor={p.imagem_url ?? ""} required />

              <div className="flex gap-3">
                <Campo nome="preco" rotulo="Preço *" valor={p.preco != null ? String(p.preco) : ""} tipo="number" required />
                <Campo nome="preco_antigo" rotulo="Preço antigo" valor={p.preco_antigo != null ? String(p.preco_antigo) : ""} tipo="number" />
              </div>
              <p className="-mt-2 text-xs text-fumo">
                Com preço antigo &gt; preço, o selo de desconto sai calculado.
              </p>

              <div className="flex gap-3">
                <Campo nome="categoria" rotulo="Categoria" valor={p.categoria ?? ""} placeholder="Ex.: Eletrônicos" />
                <Campo nome="loja_nome" rotulo="Loja" valor={p.loja_nome ?? ""} />
              </div>

              <Campo nome="slug" rotulo="Slug" valor={link.slug} />

              <button
                type="submit"
                className="w-full rounded-lg bg-pirraia py-2.5 text-sm font-bold text-white transition-colors hover:bg-pirraia-dark"
              >
                Salvar
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}

function Campo({
  nome,
  rotulo,
  valor,
  placeholder,
  tipo = "text",
  required = false,
}: {
  nome: string;
  rotulo: string;
  valor?: string;
  placeholder?: string;
  tipo?: string;
  required?: boolean;
}) {
  return (
    <label className="block flex-1 text-xs font-medium text-fumo">
      {rotulo}
      <input
        name={nome}
        type={tipo}
        step={tipo === "number" ? "0.01" : undefined}
        required={required}
        defaultValue={valor}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-sm text-tinta outline-none focus:border-pirraia"
      />
    </label>
  );
}
