import Script from "next/script";

/**
 * Pixel base do Meta. Renderiza nada se o ID não estiver no env —
 * então em dev/preview sem pixel o app roda igual, sem disparar nada.
 *
 * Injeta o stub fbq (que já enfileira eventos antes do fbevents.js carregar),
 * inicializa e dispara PageView. ViewContent e Lead vêm de fora:
 * ViewContent na home (client), Lead no redirect (CAPI server-side).
 */
export function MetaPixel({ pixelId }: { pixelId?: string }) {
  // Pixel ID do Meta é só dígitos. Validar antes de interpolar no script
  // fecha qualquer brecha de injeção no dangerouslySetInnerHTML.
  if (!pixelId || !/^\d{6,20}$/.test(pixelId)) return null;

  return (
    <>
      <Script
        id="meta-pixel"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixelId}');
fbq('track', 'PageView');`,
        }}
      />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          alt=""
          src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}
