param(
  [string]$BuildDate = "",
  [string]$OvertureRelease = "",
  [string]$BBox = "105.28,20.86,105.71,21.18",
  [int]$MaxZoom = 17
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== Hola Maps: rebuilding local map data ==="
Write-Host "Target communes: Yen Xuan, Hoa Lac, Yen Bai, Doai Phuong, Thach That, Ha Bang, Tay Phuong, Kieu Phu, Phu Cat"
Write-Host ""

& (Join-Path $PSScriptRoot "get-hoalac-pmtiles.ps1") `
  -BuildDate $BuildDate `
  -BBox $BBox `
  -MaxZoom $MaxZoom

& (Join-Path $PSScriptRoot "get-hoalac-buildings.ps1") `
  -Release $OvertureRelease `
  -BBox $BBox `
  -MaxZoom $MaxZoom

Write-Host ""
Write-Host "=== Hola Maps local map data is ready ==="
Write-Host "Reload /map."
