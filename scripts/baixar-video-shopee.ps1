<#
  Baixador de video de produto da Shopee - RODA LOCAL, no seu PC (IP residencial).
  O servidor de producao NAO consegue fazer isso (a Shopee bloqueia IP de datacenter);
  por isso e um script pra rodar na sua maquina.

  Ele raspa o HTML da pagina do produto (que traz a URL do video embutida), baixa o
  .mp4 do CDN da Shopee, casa pelo item_id com o produto da vitrine e:
    - nomeia o arquivo pelo nome do produto (pasta videos-shopee/), E
    - se achar a service role no .env.local, SOBE o video pro sistema (raw-{id}.mp4)
      e marca como pendente. Ai no admin (/admin/videos) e so clicar "Processar
      pendentes" pra virar 4:5 -- sem arrastar nada.

  COMO USAR (no PowerShell, dentro da pasta do projeto):
    .\scripts\baixar-video-shopee.ps1 "https://shopee.com.br/...i.SHOP.ITEM" "https://..."
    # ou poe os links num links.txt (um por linha) e roda sem argumentos:
    .\scripts\baixar-video-shopee.ps1

  AVISO: isso e raspagem (contra os termos da Shopee) e e fragil - se eles mudarem o
  HTML, quebra. Uso por sua conta, pro seu proprio material de afiliado.
#>

$ErrorActionPreference = "Stop"
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}

$Links = @($args)
$Pasta = "videos-shopee"
$ArquivoLinks = "links.txt"
$ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"

# ---- le URL + chaves do .env.local (anon pra casar; service pra subir o video) ----
$supaUrl = $null; $anon = $null; $service = $null
if (Test-Path ".env.local") {
  Get-Content ".env.local" | ForEach-Object {
    if ($_ -match '^\s*NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.+?)\s*$') { $supaUrl = $Matches[1].Trim('"').Trim("'") }
    if ($_ -match '^\s*NEXT_PUBLIC_SUPABASE_ANON_KEY\s*=\s*(.+?)\s*$') { $anon = $Matches[1].Trim('"').Trim("'") }
    if ($_ -match '^\s*SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.+?)\s*$') { $service = $Matches[1].Trim('"').Trim("'") }
  }
}
$chaveLeitura = if ($service) { $service } else { $anon }   # service le tudo; anon so vitrine
$temBase = [bool]$supaUrl -and [bool]$chaveLeitura
$temUpload = [bool]$supaUrl -and [bool]$service
if (-not $temBase) {
  Write-Host "(sem .env.local com URL/chave - os arquivos vao ficar com o item_id no nome)" -ForegroundColor DarkYellow
}
if ($temBase -and -not $temUpload) {
  Write-Host "(sem service role no .env.local - so baixa; nao sobe pro sistema)" -ForegroundColor DarkYellow
}

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

# acha o produto pelo item_id -> devolve @{ id; titulo } (ou $null)
function Get-Produto([string]$item) {
  if (-not $temBase) { return $null }
  try {
    $u = "$supaUrl/rest/v1/produtos?item_id=eq.$item&select=id,titulo&limit=1"
    $r = Invoke-RestMethod -Uri $u -Headers @{ apikey = $chaveLeitura; Authorization = "Bearer $chaveLeitura" } -TimeoutSec 20
    if ($r -and @($r).Count -ge 1) { return @{ id = $r[0].id; titulo = $r[0].titulo } }
  }
  catch {}
  return $null
}

# sobe o video como raw-{id}.mp4 e marca video_raw_em (pra "Processar pendentes")
function Push-Video([int]$id, [string]$arquivo) {
  $up = "$supaUrl/storage/v1/object/videos/raw-$id.mp4"
  Invoke-WebRequest -Uri $up -Method Post -InFile $arquivo -ContentType "video/mp4" `
    -Headers @{ apikey = $service; Authorization = "Bearer $service"; "x-upsert" = "true" } `
    -UseBasicParsing -TimeoutSec 300 | Out-Null
  $patch = "$supaUrl/rest/v1/produtos?id=eq.$id"
  # so marca que tem o original. NAO mexe em video_url: produto novo continua null
  # (vira pendente -> Processar pendentes faz o 4:5); produto antigo que ja tem o 4:5
  # so ganha o flag (TikTok/Reel passam a funcionar, sem reprocessar).
  $body = @{ video_raw_em = (Get-Date).ToUniversalTime().ToString("o") } | ConvertTo-Json
  Invoke-RestMethod -Uri $patch -Method Patch -Body $body -TimeoutSec 20 `
    -Headers @{ apikey = $service; Authorization = "Bearer $service"; "Content-Type" = "application/json"; Prefer = "return=minimal" } | Out-Null
}

if (Test-Path $ArquivoLinks) {
  $Links += Get-Content $ArquivoLinks | Where-Object { $_.Trim() -ne "" -and -not $_.Trim().StartsWith("#") }
}
$Links = $Links | Where-Object { $_ -match "shopee" } | Select-Object -Unique

if (-not $Links) {
  Write-Host "Nenhum link da Shopee informado." -ForegroundColor Yellow
  Write-Host 'Uso: .\scripts\baixar-video-shopee.ps1 "<link1>" "<link2>"   (ou poe os links em links.txt)' -ForegroundColor Yellow
  exit 1
}

New-Item -ItemType Directory -Force -Path $Pasta | Out-Null
$ok = 0; $falha = 0; $subidos = 0

foreach ($link in $Links) {
  try {
    if ($link -notmatch 'i\.(\d+)\.(\d+)') {
      Write-Host "  ! link sem shop/item (formato ...i.SHOP.ITEM): $link" -ForegroundColor Yellow
      $falha++; continue
    }
    $shop = $Matches[1]; $item = $Matches[2]

    $prod = Get-Produto $item
    $slug = if ($prod) { Get-Slug $prod.titulo } else { $null }
    $nomeArq = if ($slug) { "$slug.mp4" } else { "shopee-$item.mp4" }
    $rotulo = if ($prod) { $prod.titulo } else { "produto $item (fora da vitrine)" }
    Write-Host ("-> {0} ..." -f $rotulo) -NoNewline

    $url = "https://shopee.com.br/product/$shop/$item"
    $html = (Invoke-WebRequest -Uri $url -Headers @{ "User-Agent" = $ua } -UseBasicParsing -TimeoutSec 30).Content

    $idx = $html.IndexOf('"video_info_list":[{')
    if ($idx -lt 0) { Write-Host " sem video nesse produto" -ForegroundColor Yellow; $falha++; continue }
    $janela = $html.Substring($idx, [Math]::Min(3000, $html.Length - $idx))
    $m = [regex]::Match($janela, 'https://[a-z0-9.\-]+\.susercontent\.com/[^"\\]+\.mp4')
    if (-not $m.Success) { Write-Host " achei o bloco mas nao a URL do mp4" -ForegroundColor Yellow; $falha++; continue }

    $mp4 = $m.Value
    $dest = Join-Path $Pasta $nomeArq
    Invoke-WebRequest -Uri $mp4 -Headers @{ "User-Agent" = $ua } -UseBasicParsing -OutFile $dest -TimeoutSec 120
    $kb = [Math]::Round((Get-Item $dest).Length / 1KB)
    Write-Host (" OK ({0} KB)" -f $kb) -NoNewline -ForegroundColor Green
    $ok++

    if ($temUpload -and $prod) {
      try {
        Push-Video ([int]$prod.id) $dest
        Write-Host "  -> subido pro sistema (pendente)" -ForegroundColor Green
        $subidos++
      }
      catch {
        Write-Host ("  -> baixou, mas falhou ao subir: {0}" -f $_.Exception.Message) -ForegroundColor Yellow
      }
    }
    else {
      Write-Host ""
    }
  }
  catch {
    Write-Host (" ERRO: {0}" -f $_.Exception.Message) -ForegroundColor Red
    $falha++
  }
}

Write-Host ""
Write-Host ("Pronto: {0} baixado(s), {1} subido(s) pro sistema, {2} falha(s)." -f $ok, $subidos, $falha) -ForegroundColor Cyan
if ($subidos -gt 0) {
  Write-Host "Agora vai em /admin/videos e clica 'Processar pendentes' (vira 4:5, 8 por vez)." -ForegroundColor Cyan
}
elseif ($ok -gt 0) {
  Write-Host "Arquivos em $Pasta (nomeados pelo produto). Arrasta em /admin/videos." -ForegroundColor Cyan
}
