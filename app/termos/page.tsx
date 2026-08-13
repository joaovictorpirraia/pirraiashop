import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Termos de Serviço — pirraiashop",
  description: "As regras de uso da vitrine pirraiashop.",
};

const ATUALIZADO = "12 de agosto de 2026";
const CONTATO = "contato@pirraiashop.com.br";

export default function Termos() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 text-tinta">
      <Link href="/" className="text-sm font-semibold text-pirraia hover:underline">
        ← voltar pra vitrine
      </Link>
      <h1 className="mt-4 text-3xl font-extrabold">Termos de Serviço</h1>
      <p className="mt-1 text-sm text-fumo">Última atualização: {ATUALIZADO}</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-tinta/90">
        <section>
          <h2 className="text-lg font-bold text-tinta">O que é o pirraiashop</h2>
          <p className="mt-2">
            O <strong>pirraiashop</strong> (pirraiashop.com.br) é uma vitrine de curadoria de
            achadinhos. Reunimos ofertas de lojas parceiras e disponibilizamos <strong>links de
            afiliado</strong> pra elas. <strong>Não vendemos nada diretamente</strong>: a compra, o
            pagamento e a entrega acontecem no site da loja parceira (como Shopee, AliExpress,
            Mercado Livre e TikTok Shop).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-tinta">Links de afiliado</h2>
          <p className="mt-2">
            Os links contêm um código de afiliado. Se você comprar por eles, podemos receber uma
            comissão da loja. Isso <strong>não altera o preço</strong> que você paga.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-tinta">Preços, estoque e disponibilidade</h2>
          <p className="mt-2">
            Preço, estoque, disponibilidade, frete, prazos e condições são definidos e controlados
            pelas <strong>lojas parceiras</strong> e podem mudar a qualquer momento — inclusive entre
            o momento em que você vê o achado aqui e o momento em que abre a loja. Fazemos o possível
            pra manter tudo atualizado, mas não garantimos a exatidão dessas informações.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-tinta">Responsabilidade</h2>
          <p className="mt-2">
            A relação de compra é <strong>entre você e a loja parceira</strong>. Qualquer questão
            sobre o produto, pagamento, entrega, troca, garantia ou atendimento é de
            responsabilidade da loja/vendedor onde a compra foi feita. O pirraiashop não se
            responsabiliza por esses itens.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-tinta">Uso do site</h2>
          <p className="mt-2">
            Você concorda em usar o site de forma legal e sem tentar prejudicar seu funcionamento
            (por exemplo, acessos automatizados abusivos). O conteúdo, a marca e a identidade
            “pirraiashop” são nossos.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-tinta">Contato</h2>
          <p className="mt-2">
            Dúvidas sobre estes termos: <a href={`mailto:${CONTATO}`} className="font-semibold text-pirraia hover:underline">{CONTATO}</a>.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-tinta">Alterações</h2>
          <p className="mt-2">
            Podemos atualizar estes termos. A data de “última atualização” no topo sempre reflete a
            versão vigente.
          </p>
        </section>
      </div>

      <div className="mt-10 border-t border-black/10 pt-6 text-xs text-fumo">
        <Link href="/privacidade" className="font-semibold text-pirraia hover:underline">Política de Privacidade</Link>
        <span className="mx-2">·</span>
        pirraia<span className="text-pirraia">.</span> achadinhos
      </div>
    </main>
  );
}
