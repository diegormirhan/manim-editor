$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$env:CARGO_HOME = Join-Path $projectRoot 'work/cargo'
$env:RUSTUP_HOME = Join-Path $projectRoot 'work/rustup'
$env:PATH = (Join-Path $env:CARGO_HOME 'bin') + [IO.Path]::PathSeparator + $env:PATH
Set-Location $projectRoot
$command = if ($args.Count -gt 0) { $args[0] } else { 'dev' }
if ($command -eq 'build') {
  # Installers carry an updater signature; the private key stays outside the repository.
  if (-not $env:TAURI_SIGNING_PRIVATE_KEY -and -not $env:TAURI_SIGNING_PRIVATE_KEY_PATH) {
    $key = Join-Path $HOME '.tauri/manim-editor.key'
    if (-not (Test-Path $key)) { throw "Updater signing key not found at $key. See README.md, Updates." }
    $env:TAURI_SIGNING_PRIVATE_KEY_PATH = $key
  }
  if ($null -eq $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD) { $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = '' }
}
& npm.cmd run tauri -- $command
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
if ($command -eq 'build') { & node scripts/updater-manifest.mjs }
exit $LASTEXITCODE
