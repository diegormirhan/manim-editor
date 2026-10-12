$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$env:CARGO_HOME = Join-Path $projectRoot 'work/cargo'
$env:RUSTUP_HOME = Join-Path $projectRoot 'work/rustup'
$env:PATH = (Join-Path $env:CARGO_HOME 'bin') + [IO.Path]::PathSeparator + $env:PATH
Set-Location $projectRoot
$command = if ($args.Count -gt 0) { $args[0] } else { 'dev' }
# Installers carry their own Python; updater-manifest.mjs signs them once they are built.
if ($command -eq 'build') { & (Join-Path $PSScriptRoot 'prepare-runtime.ps1') }
& npm.cmd run tauri -- $command
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
if ($command -eq 'build') { & node scripts/updater-manifest.mjs }
exit $LASTEXITCODE
