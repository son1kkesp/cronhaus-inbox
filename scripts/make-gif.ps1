# make-gif.ps1 — Ensambla screenshots en GIF animado
param(
  [string]$DocsDir = "C:\Users\Usuario\Documents\MI-PERFIL\cronhaus-inbox\docs",
  [string]$OutGif  = "C:\Users\Usuario\Documents\MI-PERFIL\cronhaus-inbox\docs\demo.gif"
)

$frames = @(
  @{ file = "demo-1-home.png";               delay = 2.5 },
  @{ file = "demo-2-duplicada-top.png";      delay = 2.5 },
  @{ file = "demo-3-duplicada-findings.png"; delay = 3.0 },
  @{ file = "demo-4-ledger.png";             delay = 2.8 },
  @{ file = "demo-5-correcta.png";           delay = 2.5 },
  @{ file = "demo-6-ledger-final.png";       delay = 4.0 }
)

# Temp dir para frames redimensionados
$tempDir = Join-Path $env:TEMP "cronhaus-gif-frames"
if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }
New-Item -ItemType Directory -Path $tempDir | Out-Null

# Paso 1: redimensionar cada frame a 800px de ancho
$i = 0
foreach ($f in $frames) {
  $src = Join-Path $DocsDir $f.file
  $dst = Join-Path $tempDir ("frame_{0:D2}.png" -f $i)
  & ffmpeg -y -i $src -vf "scale=800:-1:flags=lanczos" $dst -loglevel error
  $i++
}

# Paso 2: crear concat.txt sin BOM (ASCII puro)
$concatLines = New-Object System.Collections.Generic.List[string]
$i = 0
foreach ($f in $frames) {
  $framePath = (Join-Path $tempDir ("frame_{0:D2}.png" -f $i)) -replace '\\','/'
  $concatLines.Add("file '$framePath'")
  $concatLines.Add("duration $($f.delay)")
  $i++
}
# Repetir el ultimo frame sin duration (requerido)
$lastIdx = $frames.Count - 1
$lastPath = (Join-Path $tempDir ("frame_{0:D2}.png" -f $lastIdx)) -replace '\\','/'
$concatLines.Add("file '$lastPath'")

$concatFile = Join-Path $tempDir "concat.txt"
[System.IO.File]::WriteAllLines($concatFile, $concatLines, [System.Text.UTF8Encoding]::new($false))

# Paso 3: generar paleta
$palettePath = Join-Path $tempDir "palette.png"
& ffmpeg -y -f concat -safe 0 -i $concatFile `
  -vf "fps=0.4,scale=800:-1:flags=lanczos,palettegen=max_colors=128:stats_mode=diff" `
  $palettePath -loglevel warning

# Paso 4: render GIF usando paletteuse
& ffmpeg -y -f concat -safe 0 -i $concatFile -i $palettePath `
  -lavfi "fps=0.4,scale=800:-1:flags=lanczos [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" `
  $OutGif -loglevel warning

if (Test-Path $OutGif) {
  $size = (Get-Item $OutGif).Length
  Write-Host "GIF generado: $OutGif ($([math]::Round($size/1MB,2)) MB)"
} else {
  Write-Error "ERROR: No se genero el GIF"; exit 1
}
