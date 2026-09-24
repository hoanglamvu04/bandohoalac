function Get-HolaPmtilesCli {
  param(
    [string]$ToolsRoot = (Join-Path $PSScriptRoot ".tools")
  )

  $existing = Get-Command pmtiles -ErrorAction SilentlyContinue
  if ($existing) {
    return $existing.Source
  }

  $pmtilesDir = Join-Path $ToolsRoot "pmtiles"
  $localExe = Join-Path $pmtilesDir "pmtiles.exe"

  if (Test-Path $localExe) {
    return $localExe
  }

  if ($env:OS -ne "Windows_NT") {
    throw "pmtiles CLI is not installed. Install it from protomaps/go-pmtiles releases."
  }

  New-Item -ItemType Directory -Force -Path $pmtilesDir | Out-Null

  Write-Host "pmtiles CLI not found. Downloading the latest Windows release automatically..."

  $headers = @{
    "User-Agent" = "HolaMaps-build-script"
    "Accept" = "application/vnd.github+json"
  }

  $release = Invoke-RestMethod -Uri "https://api.github.com/repos/protomaps/go-pmtiles/releases/latest" -Headers $headers

  $arch = if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") { "arm64" } else { "x86_64" }
  $asset = $release.assets | Where-Object { $_.name -match "Windows_$arch\.zip$" } | Select-Object -First 1

  if (-not $asset) {
    throw "Could not find a Windows $arch pmtiles release asset."
  }

  $zipPath = Join-Path $pmtilesDir "pmtiles.zip"
  $extractDir = Join-Path $pmtilesDir "extract"

  Remove-Item -Force $zipPath -ErrorAction SilentlyContinue
  Remove-Item -Recurse -Force $extractDir -ErrorAction SilentlyContinue

  Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zipPath -UseBasicParsing
  Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force

  $downloadedExe = Get-ChildItem -Path $extractDir -Filter "pmtiles.exe" -Recurse | Select-Object -First 1

  if (-not $downloadedExe) {
    throw "pmtiles.exe was not found inside the downloaded archive."
  }

  Copy-Item $downloadedExe.FullName $localExe -Force
  Remove-Item -Force $zipPath -ErrorAction SilentlyContinue
  Remove-Item -Recurse -Force $extractDir -ErrorAction SilentlyContinue

  Write-Host "pmtiles CLI ready: $localExe"
  return $localExe
}
