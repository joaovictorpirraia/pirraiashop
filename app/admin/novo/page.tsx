import { adicionarProduto } from "../actions";

export const dynamic = "force-dynamic";

export default function Novo({
  searchParams,
}: {
  searchParams: { erro?: string };
}) {
  const erro = searchParams.erro === "1";

  return (
    <div className="min-h-screen bg-areia">
      <header className="sticky top-0 z-30 border-b border-black/5 bg-areia/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3.5">
          <span className="text-lg font-extrabold tracking-tight text-tinta">
            pirraia<span className="text-pirraia">.</span>{" "}
            <span className="text-fumo">adicionar produto</span>
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
        <p className="mb-5 text-sm text-fumo">
          Cadastra um achado real direto na vitrine. Pega o título, a imagem e o preço na
          página do produto, e o <b className="text-tinta">link de afiliado</b> você gera no
          painel de afiliado da Shopee.
        </p>

        {erro && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Faltou algum campo obrigatório (ou o link não começa com http). Confere e tenta de novo.
          </div>
        )}

        <form action={adicionarProduto} className="space-y-4 rounded-2xl bg-white p-5 shadow-carta">
          <Campo nome="titulo" rotulo="Título *" placeholder="Ex.: Organizador de Gaveta 6 Divisórias" required />
          <Campo
            nome="short_url"
            rotulo="Link de afiliado (short_url) *"
            placeholder="https://s.shopee.com.br/..."
            required
          />
          <Campo
            nome="imagem_url"
            rotulo="URL da imagem *"
            placeholder="https://cf.shopee.com.br/... (imagem da própria Shopee)"
            required
          />
          <p className="-mt-2 text-xs text-fumo">
            Use a imagem da Shopee (clica com o botão direito na foto → copiar endereço). Domínios da
            Shopee já estão liberados; imagem de outro site pode não carregar.
          </p>

          <div className="flex gap-3">
            <Campo nome="preco" rotulo="Preço *" placeholder="19.90" tipo="number" required />
            <Campo nome="preco_antigo" rotulo="Preço antigo" placeholder="34.90" tipo="number" />
          </div>
          <p className="-mt-2 text-xs text-fumo">
            Se puser o preço antigo, o selo de desconto sai calculado sozinho.
          </p>

          <div className="flex gap-3">
            <Campo nome="categoria" rotulo="Categoria" placeholder="Casa" />
            <Campo nome="loja_nome" rotulo="Loja" placeholder="Nome da loja" />
          </div>

          <Campo
            nome="slug"
            rotulo="Slug (opcional)"
            placeholder="deixe em branco pra gerar do título"
          />

          <button
            type="submit"
            className="w-full rounded-lg bg-pirraia py-2.5 text-sm font-bold text-white transition-colors hover:bg-pirraia-dark"
          >
            Adicionar à vitrine
          </button>
        </form>
      </main>
    </div>
  );
}

function Campo({
  nome,
  rotulo,
  placeholder,
  tipo = "text",
  required = false,
}: {
  nome: string;
  rotulo: string;
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
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-sm text-tinta outline-none focus:border-pirraia"
      />
    </label>
  );
}
