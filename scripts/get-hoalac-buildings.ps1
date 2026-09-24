param(
  [string]$BBox = "105.30,20.86,105.69,21.16",
  [int]$MinZoom = 14,
  [int]$MaxZoom = 17,
  [switch]$KeepSource
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$OutputDir = Join-Path $RepoRoot "frontend\public\maps"
$WorkDir = Join-Path $OutputDir ".buildings-build"
$SourceFile = Join-Path $WorkDir "overture-buildings.geojsonseq"
$OutputFile = Join-Path $OutputDir "hoalac-buildings.pmtiles"

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
New-Item -ItemType Directory -Force -Path $WorkDir | Out-Null

if (Test-Path $SourceFile) {
  Remove-Item -Force $SourceFile
}
if (Test-Path $OutputFile) {
  Remove-Item -Force $OutputFile
}

Write-Host ""
Write-Host "Hola Maps supplemental buildings"
Write-Host "Source:   Overture Maps Foundation - Buildings"
Write-Host "Coverage: $BBox"
Write-Host "Zoom:     $MinZoom-$MaxZoom"
Write-Host "Output:   $OutputFile"
Write-Host ""
Write-Host "This archive supplements places where the OSM/Protomaps basemap has sparse building footprints."
Write-Host "Attribution: © OpenStreetMap contributors, Overture Maps Foundation"
Write-Host ""

$DownloadArgs = @(
  "download",
  "--bbox=$BBox",
  "-f", "geojsonseq",
  "--type=building",
  "-o", $SourceFile
)

$Overture = Get-Command overturemaps -ErrorAction SilentlyContinue
$Uvx = Get-Command uvx -ErrorAction SilentlyContinue

if ($Overture) {
  & $Overture.Source @DownloadArgs
  if ($LASTEXITCODE -ne 0) {
    throw "Overture download failed with exit code $LASTEXITCODE."
  }
} elseif ($Uvx) {
  & $Uvx.Source overturemaps @DownloadArgs
  if ($LASTEXITCODE -ne 0) {
    throw "Overture download through uvx failed with exit code $LASTEXITCODE."
  }
} else {
  throw @"
Overture CLI was not found.
Install one of these, then run this script again:

  pip install overturemaps

or install uv and use:

  uvx overturemaps --help
"@
}

if (-not (Test-Path $SourceFile)) {
  throw "Overture download finished but the GeoJSONSeq source was not created."
}

$SourceMb = [math]::Round((Get-Item $SourceFile).Length / 1MB, 1)
Write-Host "Downloaded: $SourceMb MB"
Write-Host ""

$TippecanoeArgs = @(
  "-o", $OutputFile,
  "-l", "buildings",
  "-Z", "$MinZoom",
  "-z", "$MaxZoom",
  "-P",
  "-f",
  "--drop-densest-as-needed",
  "--no-tiny-polygon-reduction",
  "-y", "height",
  "-y", "num_floors",
  "--name=Hola Maps supplemental buildings",
  "--attribution=© OpenStreetMap contributors, Overture Maps Foundation",
  $SourceFile
)

$Tippecanoe = Get-Command tippecanoe -ErrorAction SilentlyContinue

if ($Tippecanoe) {
  & $Tippecanoe.Source @TippecanoeArgs
  if ($LASTEXITCODE -ne 0) {
    throw "Tippecanoe failed with exit code $LASTEXITCODE."
  }
} else {
  $Docker = Get-Command docker -ErrorAction SilentlyContinue
  if (-not $Docker) {
    throw @"
Tippecanoe was not found.

Install Tippecanoe, or install Docker Desktop. The script can build the
official Felt Tippecanoe Docker image automatically when Docker is available.
"@
  }

  $Image = "hola-tippecanoe:latest"
  & docker image inspect $Image *> $null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Building Tippecanoe Docker image (first run only)..."
    & docker build -t $Image "https://github.com/felt/tippecanoe.git#main"
    if ($LASTEXITCODE -ne 0) {
      throw "Could not build the Tippecanoe Docker image."
    }
  }

  $Mount = ($OutputDir -replace "\\", "/")
  $ContainerInput = "/data/.buildings-build/overture-buildings.geojsonseq"
  $ContainerOutput = "/data/hoalac-buildings.pmtiles"

  $ContainerArgs = @(
    "run", "--rm",
    "-v", "${Mount}:/data",
    $Image,
    "tippecanoe",
    "-o", $ContainerOutput,
    "-l", "buildings",
    "-Z", "$MinZoom",
    "-z", "$MaxZoom",
    "-P",
    "-f",
    "--drop-densest-as-needed",
    "--no-tiny-polygon-reduction",
    "-y", "height",
    "-y", "num_floors",
    "--name=Hola Maps supplemental buildings",
    "--attribution=© OpenStreetMap contributors, Overture Maps Foundation",
    $ContainerInput
  )

  & docker @ContainerArgs
  if ($LASTEXITCODE -ne 0) {
    throw "Tippecanoe Docker build failed with exit code $LASTEXITCODE."
  }
}

if (-not (Test-Path $OutputFile)) {
  throw "Building tiling finished but hoalac-buildings.pmtiles was not created."
}

$SizeMb = [math]::Round((Get-Item $OutputFile).Length / 1MB, 1)
Write-Host ""
Write-Host "DONE: $OutputFile ($SizeMb MB)"
Write-Host "Hola Maps will detect this archive automatically on the next page reload."

if (-not $KeepSource) {
  Remove-Item -Recurse -Force $WorkDir -ErrorAction SilentlyContinue
}
