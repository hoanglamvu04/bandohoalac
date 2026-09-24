param(
  [string]$BuildDate = "",
  [int]$MaxZoom = 17,
  [string]$BBox = "105.30,20.86,105.69,21.16"
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "pmtiles-tools.ps1")

$RepoRoot = Split-Path -Parent $PSScriptRoot
$OutputDir = Join-Path $RepoRoot "frontend\public\maps"
$OutputFile = Join-Path $OutputDir "hoalac.pmtiles"
$TempFile = Join-Path $OutputDir "hoalac.building.pmtiles"

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
Remove-Item -Force $TempFile -ErrorAction SilentlyContinue

function Resolve-BuildUrl {
  param([string]$RequestedDate)

  if ($RequestedDate) {
    return "https://build.protomaps.com/$RequestedDate.pmtiles"
  }

  for ($i = 1; $i -le 7; $i++) {
    $date = (Get-Date).AddDays(-$i).ToString("yyyyMMdd")
    $url = "https://build.protomaps.com/$date.pmtiles"
    try {
      Invoke-WebRequest -Uri $url -Method Head -TimeoutSec 15 -UseBasicParsing | Out-Null
      return $url
    } catch {
      Write-Host "Build $date not available, trying older build..."
    }
  }

  throw "Could not find a Protomaps daily build from the last 7 days."
}

$PmtilesExe = Get-HolaPmtilesCli
$SourceUrl = Resolve-BuildUrl -RequestedDate $BuildDate

Write-Host ""
Write-Host "Hola Maps local basemap"
Write-Host "Source:   $SourceUrl"
Write-Host "Coverage: Hoa Lac / Thach That focused service area"
Write-Host "BBox:     $BBox"
Write-Host "Zoom:     0-$MaxZoom"
Write-Host "Output:   $OutputFile"
Write-Host ""

& $PmtilesExe extract $SourceUrl $TempFile "--bbox=$BBox" "--maxzoom=$MaxZoom" "--download-threads=8"
if ($LASTEXITCODE -ne 0) {
  Remove-Item -Force $TempFile -ErrorAction SilentlyContinue
  throw "Protomaps extraction failed with exit code $LASTEXITCODE."
}

if (-not (Test-Path $TempFile)) {
  throw "Extraction finished but the temporary basemap archive was not created."
}

Move-Item -Force $TempFile $OutputFile

$SizeMb = [math]::Round((Get-Item $OutputFile).Length / 1MB, 1)
Write-Host ""
Write-Host "DONE: $OutputFile ($SizeMb MB)"
Write-Host "Basemap z17 is ready."
