param(
  [string]$Release = "",
  [string]$BBox = "105.30,20.86,105.69,21.16",
  [int]$MinZoom = 14,
  [int]$MaxZoom = 17
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "pmtiles-tools.ps1")

$RepoRoot = Split-Path -Parent $PSScriptRoot
$OutputDir = Join-Path $RepoRoot "frontend\public\maps"
$OutputFile = Join-Path $OutputDir "hoalac-buildings.pmtiles"
$TempFile = Join-Path $OutputDir "hoalac-buildings.building.pmtiles"

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
Remove-Item -Force $TempFile -ErrorAction SilentlyContinue

function Resolve-OvertureRelease {
  param([string]$RequestedRelease)

  if ($RequestedRelease) {
    return $RequestedRelease
  }

  try {
    $headers = @{ "User-Agent" = "HolaMaps-build-script" }
    $catalog = Invoke-RestMethod -Uri "https://stac.overturemaps.org/catalog.json" -Headers $headers
    if ($catalog.latest) {
      return [string]$catalog.latest
    }
  } catch {
    Write-Host "Could not resolve Overture latest release from STAC."
  }

  throw "Could not determine the latest Overture release. Pass -Release manually."
}

$PmtilesExe = Get-HolaPmtilesCli
$ResolvedRelease = Resolve-OvertureRelease -RequestedRelease $Release
$SourceUrl = "https://overturemaps-extras-us-west-2.s3.us-west-2.amazonaws.com/tiles/$ResolvedRelease/buildings.pmtiles"

Write-Host ""
Write-Host "Hola Maps supplemental buildings"
Write-Host "Source:   Overture official Buildings PMTiles"
Write-Host "Release:  $ResolvedRelease"
Write-Host "Coverage: $BBox"
Write-Host "Zoom:     $MinZoom-$MaxZoom"
Write-Host "Output:   $OutputFile"
Write-Host ""

& $PmtilesExe extract $SourceUrl $TempFile "--bbox=$BBox" "--minzoom=$MinZoom" "--maxzoom=$MaxZoom" "--download-threads=8"
if ($LASTEXITCODE -ne 0) {
  Remove-Item -Force $TempFile -ErrorAction SilentlyContinue
  throw "Overture Buildings extraction failed with exit code $LASTEXITCODE."
}

if (-not (Test-Path $TempFile)) {
  throw "Overture extraction finished but the temporary building archive was not created."
}

Move-Item -Force $TempFile $OutputFile

$SizeMb = [math]::Round((Get-Item $OutputFile).Length / 1MB, 1)
Write-Host ""
Write-Host "DONE: $OutputFile ($SizeMb MB)"
Write-Host "Source layers: building + building_part"
Write-Host "Reload /map to enable the denser building footprints."
