import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Privacidade — pirraiashop",
  description: "Como o pirraiashop trata dados de quem visita a vitrine.",
};

const ATUALIZADO = "12 de agosto de 2026";
const CONTATO = "contato@pirraiashop.com.br";

export default function Privacidade() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 text-tinta">
      <Link href="/" className="text-sm font-semibold text-pirraia hover:underline">
        ← voltar pra vitrine
      </Link>
      <h1 className="mt-4 text-3xl font-extrabold">Política de Privacidade</h1>
      <p className="mt-1 text-sm text-fumo">Última atualização: {ATUALIZADO}</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-tinta/90">
        <section>
          <h2 className="text-lg font-bold text-tinta">Quem somos</h2>
          <p className="mt-2">
            O <strong>pirraiashop</strong> (pirraiashop.com.br) é uma vitrine de curadoria de
            achadinhos com <strong>links de afiliado</strong> de lojas parceiras (como Shopee,
            AliExpress, Mercado Livre e TikTok Shop). Não vendemos produtos diretamente: ao clicar
            num achado, você é levado ao site da loja parceira, onde a compra acontece.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-tinta">Que dados coletamos</h2>
          <p className="mt-2">Não pedimos cadastro nem login. Não coletamos seu nome, e-mail ou telefone. O que tratamos é:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>Cliques nos produtos</strong> (contagem) e a origem do acesso (parâmetros de
              campanha, tipo <code>utm_source</code>), pra sabermos quais achados fazem sentido.
            </li>
            <li>
              <strong>Pixel da Meta (Facebook/Instagram)</strong>: eventos de visita e interesse,
              usados pra medir e otimizar anúncios. Isso usa cookies da Meta.
            </li>
            <li>
              <strong>Dados técnicos padrão</strong> (tipo de navegador e dispositivo, páginas
              vistas), coletados pelo próprio pixel/analytics.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-tinta">Cookies</h2>
          <p className="mt-2">
            Usamos cookies essenciais pro site funcionar e o cookie do pixel da Meta pra medição de
            anúncios. Você pode bloquear cookies nas configurações do seu navegador.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-tinta">Com quem compartilhamos</h2>
          <p className="mt-2">
            Compartilhamos dados de evento com a <strong>Meta</strong> (via pixel e API de
            conversões) apenas pra medir campanhas. Ao clicar num produto, você vai pro site da loja
            parceira, que passa a tratar seus dados pela <strong>política de privacidade dela</strong>.
            Não vendemos seus dados.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-tinta">Links de afiliado</h2>
          <p className="mt-2">
            Os links contêm um código de rastreio de afiliado. Se você comprar, podemos receber uma
            comissão da loja — e isso <strong>não deixa o preço mais caro pra você</strong>.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-tinta">Seus direitos (LGPD)</h2>
          <p className="mt-2">
            Você pode pedir acesso, correção ou exclusão dos dados que tratamos, e tirar dúvidas
            sobre privacidade, pelo e-mail <a href={`mailto:${CONTATO}`} className="font-semibold text-pirraia hover:underline">{CONTATO}</a>.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-tinta">Menores de idade</h2>
          <p className="mt-2">O site não é direcionado a menores de 18 anos.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-tinta">Alterações</h2>
          <p className="mt-2">
            Podemos atualizar esta política. A data de “última atualização” no topo sempre reflete a
            versão vigente.
          </p>
        </section>
      </div>

      <div className="mt-10 border-t border-black/10 pt-6 text-xs text-fumo">
        <Link href="/termos" className="font-semibold text-pirraia hover:underline">Termos de Serviço</Link>
        <span className="mx-2">·</span>
        pirraia<span className="text-pirraia">.</span> achadinhos
      </div>
    </main>
  );
}
