<#
  Baixador de video de produto da Shopee - RODA LOCAL, no seu PC (IP residencial).
  O servidor de producao NAO consegue fazer isso (a Shopee bloqueia IP de datacenter);
  por isso e um script pra rodar na sua maquina.

  Ele raspa o HTML da pagina do produto (que traz a URL do video embutida), baixa o
  .mp4 do CDN da Shopee, e CASA pelo item_id com o produto da sua vitrine pra nomear
  o arquivo com o NOME do produto (le a URL/chave publica do .env.local). Depois e so
  arrastar os videos em /admin/videos.

  COMO USAR (no PowerShell, dentro da pasta do projeto):
    # um ou varios links direto:
    .\scripts\baixar-video-shopee.ps1 "https://shopee.com.br/...i.SHOP.ITEM" "https://..."

    # ou poe os links num arquivo links.txt (um por linha) e roda sem argumentos:
    .\scripts\baixar-video-shopee.ps1

  Os .mp4 caem na pasta "videos-shopee". Se o produto nao estiver na vitrine (curado),
  o arquivo fica com o item_id (shopee-<item>.mp4).

  AVISO: isso e raspagem (contra os termos da Shopee) e e fragil - se eles mudarem o
  HTML, quebra. Uso por sua conta, pro seu proprio material de afiliado.
#>

$ErrorActionPreference = "Stop"
# TLS 1.2 (o PowerShell 5.1 usa 1.0 por padrao e a Shopee recusa)
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}

$Links = @($args)              # todos os links passados na linha de comando
$Pasta = "videos-shopee"       # pasta de saida (mude aqui se quiser)
$ArquivoLinks = "links.txt"    # alternativa: um link por linha nesse arquivo
$ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"

# ---- le a URL/chave publica do .env.local (pra casar item_id -> nome do produto) ----
$supaUrl = $null; $anon = $null
if (Test-Path ".env.local") {
  Get-Content ".env.local" | ForEach-Object {
    if ($_ -match '^\s*NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.+?)\s*$') { $supaUrl = $Matches[1].Trim('"').Trim("'") }
    if ($_ -match '^\s*NEXT_PUBLIC_SUPABASE_ANON_KEY\s*=\s*(.+?)\s*$') { $anon = $Matches[1].Trim('"').Trim("'") }
  }
}
$temBase = [bool]$supaUrl -and [bool]$anon
if (-not $temBase) {
  Write-Host "(sem .env.local com URL/anon - os arquivos vao ficar com o item_id no nome)" -ForegroundColor DarkYellow
}

# transforma o titulo do produto num nome de arquivo limpo (sem acento/simbolo)
function Get-Slug([string]$s) {
  if (-not $s) { return $null }
  $norm = $s.Normalize([Text.NormalizationForm]::FormD)
  $sb = New-Object Text.StringBuilder
  foreach ($ch in $norm.ToCharArray()) {
    if ([Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch) -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
      [void]$sb.Append($ch)
    }
  }
  $t = $sb.ToString().ToLower()
  $t = ($t -replace '[^a-z0-9]+', '-').Trim('-')
  if ($t.Length -gt 55) { $t = $t.Substring(0, 55).Trim('-') }
  return $t
}

# consulta o titulo do produto na vitrine (anon key so le curado/publicado - RLS)
function Get-TituloProduto([string]$item) {
  if (-not $temBase) { return $null }
  try {
    $u = "$supaUrl/rest/v1/produtos?item_id=eq.$item&select=titulo&limit=1"
    $r = Invoke-RestMethod -Uri $u -Headers @{ apikey = $anon; Authorization = "Bearer $anon" } -TimeoutSec 20
    if ($r -and @($r).Count -ge 1) { return $r[0].titulo }
  }
  catch {}
  return $null
}

# junta links dos argumentos + do links.txt (se existir), tira comentarios e repetidos
if (Test-Path $ArquivoLinks) {
  $Links += Get-Content $ArquivoLinks | Where-Object { $_.Trim() -ne "" -and -not $_.Trim().StartsWith("#") }
}
$Links = $Links | Where-Object { $_ -match "shopee" } | Select-Object -Unique

if (-not $Links) {
  Write-Host "Nenhum link da Shopee informado." -ForegroundColor Yellow
  Write-Host 'Uso: .\scripts\baixar-video-shopee.ps1 "<link1>" "<link2>"   (ou poe os links em links.txt, um por linha)' -ForegroundColor Yellow
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

    # casa com o produto da vitrine pra nomear pelo nome
    $titulo = Get-TituloProduto $item
    $slug = Get-Slug $titulo
    $nomeArq = if ($slug) { "$slug.mp4" } else { "shopee-$item.mp4" }
    $rotulo = if ($titulo) { $titulo } else { "produto $item (fora da vitrine)" }
    Write-Host ("-> {0} ..." -f $rotulo) -NoNewline

    $url = "https://shopee.com.br/product/$shop/$item"
    $html = (Invoke-WebRequest -Uri $url -Headers @{ "User-Agent" = $ua } -UseBasicParsing -TimeoutSec 30).Content

    # o video principal fica no 1o "video_info_list" do HTML (SSR)
    $idx = $html.IndexOf('"video_info_list":[{')
    if ($idx -lt 0) { Write-Host " sem video nesse produto" -ForegroundColor Yellow; $falha++; continue }
    $janela = $html.Substring($idx, [Math]::Min(3000, $html.Length - $idx))
    $m = [regex]::Match($janela, 'https://[a-z0-9.\-]+\.susercontent\.com/[^"\\]+\.mp4')
    if (-not $m.Success) { Write-Host " achei o bloco mas nao a URL do mp4" -ForegroundColor Yellow; $falha++; continue }

    $mp4 = $m.Value
    $dest = Join-Path $Pasta $nomeArq
    Invoke-WebRequest -Uri $mp4 -Headers @{ "User-Agent" = $ua } -UseBasicParsing -OutFile $dest -TimeoutSec 120
    $kb = [Math]::Round((Get-Item $dest).Length / 1KB)
    Write-Host (" OK ({0} KB)  ->  {1}" -f $kb, $nomeArq) -ForegroundColor Green
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
  Write-Host "O nome do arquivo e o nome do produto - mais facil de casar em /admin/videos." -ForegroundColor Cyan
}
