#requires -Version 7
<#
  Baixador de vídeo de produto da Shopee — RODA LOCAL, no seu PC (IP residencial).
  O servidor de produção NÃO consegue fazer isso (a Shopee bloqueia IP de datacenter);
  por isso é um script pra rodar na sua máquina.

  Ele raspa o HTML da página do produto (que traz a URL do vídeo embutida) e baixa o
  .mp4 do CDN da Shopee. Depois é só arrastar os vídeos em /admin/videos, no produto certo.

  COMO USAR (no PowerShell, dentro da pasta do projeto):
    # um ou vários links direto:
    .\scripts\baixar-video-shopee.ps1 "https://shopee.com.br/...i.SHOP.ITEM" "https://shopee.com.br/...outro"

    # ou põe os links num arquivo links.txt (um por linha) e roda sem argumentos:
    .\scripts\baixar-video-shopee.ps1

  Os .mp4 caem na pasta "videos-shopee".

  AVISO: isso é raspagem (contra os termos da Shopee) e é frágil — se eles mudarem o
  HTML, quebra. Uso por sua conta, pro seu próprio material de afiliado.
#>

$ErrorActionPreference = "Stop"
$Links = @($args)              # todos os links passados na linha de comando
$Pasta = "videos-shopee"       # pasta de saída (mude aqui se quiser)
$ArquivoLinks = "links.txt"    # alternativa: um link por linha nesse arquivo
$ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"

# junta links dos argumentos + do links.txt (se existir), tira comentários e repetidos
if (Test-Path $ArquivoLinks) {
  $Links += Get-Content $ArquivoLinks | Where-Object { $_.Trim() -ne "" -and -not $_.Trim().StartsWith("#") }
}
$Links = $Links | Where-Object { $_ -match "shopee" } | Select-Object -Unique

if (-not $Links) {
  Write-Host "Nenhum link da Shopee informado." -ForegroundColor Yellow
  Write-Host 'Uso: .\scripts\baixar-video-shopee.ps1 "<link1>" "<link2>"   (ou põe os links em links.txt, um por linha)' -ForegroundColor Yellow
  exit 1
}

New-Item -ItemType Directory -Force -Path $Pasta | Out-Null
$ok = 0; $falha = 0

foreach ($link in $Links) {
  try {
    if ($link -notmatch 'i\.(\d+)\.(\d+)') {
      Write-Host "  ! link sem shop/item (formato ...i.SHOP.ITEM): $link" -ForegroundColor Yellow
      $falha++; continue
    }
    $shop = $Matches[1]; $item = $Matches[2]
    Write-Host ("-> produto {0} ..." -f $item) -NoNewline

    $url = "https://shopee.com.br/product/$shop/$item"
    $html = (Invoke-WebRequest -Uri $url -Headers @{ "User-Agent" = $ua } -TimeoutSec 30).Content

    # o vídeo principal fica no 1º "video_info_list" do HTML (SSR)
    $idx = $html.IndexOf('"video_info_list":[{')
    if ($idx -lt 0) { Write-Host " sem vídeo nesse produto" -ForegroundColor Yellow; $falha++; continue }
    $janela = $html.Substring($idx, [Math]::Min(3000, $html.Length - $idx))
    $m = [regex]::Match($janela, 'https://[a-z0-9.\-]+\.susercontent\.com/[^"\\]+\.mp4')
    if (-not $m.Success) { Write-Host " achei o bloco mas não a URL do mp4" -ForegroundColor Yellow; $falha++; continue }

    $mp4 = $m.Value
    $dest = Join-Path $Pasta "shopee-$item.mp4"
    Invoke-WebRequest -Uri $mp4 -Headers @{ "User-Agent" = $ua } -OutFile $dest -TimeoutSec 120
    $kb = [Math]::Round((Get-Item $dest).Length / 1KB)
    Write-Host (" OK ({0} KB)  ->  {1}" -f $kb, $dest) -ForegroundColor Green
    $ok++
  }
  catch {
    Write-Host (" ERRO: {0}" -f $_.Exception.Message) -ForegroundColor Red
    $falha++
  }
}

Write-Host ""
Write-Host ("Pronto: {0} baixado(s), {1} falha(s).  Pasta: {2}" -f $ok, $falha, (Resolve-Path $Pasta)) -ForegroundColor Cyan
if ($ok -gt 0) {
  Write-Host "Agora é só arrastar os .mp4 em /admin/videos, cada um no produto certo." -ForegroundColor Cyan
}
