param(
  [string]$BBox = "105.325,20.885,105.665,21.145",
  [double]$MinConfidence = 0.55,
  [switch]$KeepGeoJson
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$CacheDir = Join-Path $PSScriptRoot ".cache\overture-places"
$GeoJsonFile = Join-Path $CacheDir "hoalac-overture-places.geojson"

New-Item -ItemType Directory -Force -Path $CacheDir | Out-Null

$Overture = Get-Command overturemaps -ErrorAction SilentlyContinue
if (-not $Overture) {
  throw "Missing 'overturemaps'. Install it first: pip install -U overturemaps"
}

Write-Host ""
Write-Host "=== Hola Maps: Overture Places scan ==="
Write-Host "BBox:               $BBox"
Write-Host "Minimum confidence: $MinConfidence"
Write-Host ""

Remove-Item -Force $GeoJsonFile -ErrorAction SilentlyContinue

& overturemaps download "--bbox=$BBox" "-f" "geojson" "--type=place" "-o" $GeoJsonFile
if ($LASTEXITCODE -ne 0) {
  throw "Overture download failed with exit code $LASTEXITCODE."
}

if (-not (Test-Path $GeoJsonFile)) {
  throw "Overture download finished but the GeoJSON file was not created."
}

$ResolvedGeoJson = (Resolve-Path $GeoJsonFile).Path
Push-Location (Join-Path $RepoRoot "backend")
try {
  node "src/scripts/importOverturePlaces.js" "--file" $ResolvedGeoJson "--min-confidence" ([string]$MinConfidence)
  if ($LASTEXITCODE -ne 0) {
    throw "Database staging failed with exit code $LASTEXITCODE."
  }
} finally {
  Pop-Location
}

if (-not $KeepGeoJson) {
  Remove-Item -Force $GeoJsonFile -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "DONE."
Write-Host "Review records at: /admin/place-imports"
