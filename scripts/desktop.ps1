$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$env:CARGO_HOME = Join-Path $projectRoot 'work/cargo'
$env:RUSTUP_HOME = Join-Path $projectRoot 'work/rustup'
$env:PATH = (Join-Path $env:CARGO_HOME 'bin') + [IO.Path]::PathSeparator + $env:PATH
Set-Location $projectRoot
if ($args.Count -gt 0) {
  & npm.cmd run tauri -- $args[0]
} else {
  & npm.cmd run tauri -- dev
}
exit $LASTEXITCODE
