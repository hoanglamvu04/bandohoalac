param(
  [string]$BuildDate = "",
  [int]$MaxZoom = 16,
  [string]$BBox = "105.30,20.86,105.70,21.16"
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$OutputDir = Join-Path $RepoRoot "frontend\public\maps"
$OutputFile = Join-Path $OutputDir "hoalac.pmtiles"

# Tight extraction fence around the Hola Maps service polygon.
# The frontend/backend polygon is even more precise and masks/clips the
# outside area. This BBOX intentionally keeps a small tile buffer so roads
# and labels do not look cut off at the product boundary.

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

function Resolve-BuildUrl {
  param([string]$RequestedDate)

  if ($RequestedDate) {
    return "https://build.protomaps.com/$RequestedDate.pmtiles"
  }

  for ($i = 1; $i -le 7; $i++) {
    $date = (Get-Date).AddDays(-$i).ToString("yyyyMMdd")
    $url = "https://build.protomaps.com/$date.pmtiles"
    try {
      Invoke-WebRequest -Uri $url -Method Head -TimeoutSec 15 | Out-Null
      return $url
    } catch {
      Write-Host "Build $date not available, trying older build..."
    }
  }

  throw "Could not find a Protomaps daily build from the last 7 days."
}

$SourceUrl = Resolve-BuildUrl -RequestedDate $BuildDate
Write-Host ""
Write-Host "Hola Maps local basemap"
Write-Host "Source:  $SourceUrl"
Write-Host "Coverage: Hòa Lạc, Hạ Bằng, Thạch Thất, Tây Phương, Yên Xuân, Phú Cát"
Write-Host "Extended: nearby parts of Ba Vì + Quốc Oai"
Write-Host "BBox:     $BBox"
Write-Host "Zoom:     0-$MaxZoom"
Write-Host "Output:  $OutputFile"
Write-Host ""

$Pmtiles = Get-Command pmtiles -ErrorAction SilentlyContinue

if ($Pmtiles) {
  & pmtiles extract $SourceUrl $OutputFile "--bbox=$BBox" "--maxzoom=$MaxZoom" "--download-threads=8"
} else {
  $Docker = Get-Command docker -ErrorAction SilentlyContinue
  if (-not $Docker) {
    throw "Install either the pmtiles CLI or Docker Desktop, then run this script again."
  }

  $Mount = ($OutputDir -replace "\\", "/")
  & docker run --rm -v "$($Mount):/data" protomaps/go-pmtiles extract $SourceUrl /data/hoalac.pmtiles "--bbox=$BBox" "--maxzoom=$MaxZoom" "--download-threads=8"
}

if (-not (Test-Path $OutputFile)) {
  throw "Extraction finished but hoalac.pmtiles was not created."
}

$SizeMb = [math]::Round((Get-Item $OutputFile).Length / 1MB, 1)
Write-Host ""
Write-Host "DONE: $OutputFile ($SizeMb MB)"
Write-Host "Restart Vite and open http://localhost:5175/map"
