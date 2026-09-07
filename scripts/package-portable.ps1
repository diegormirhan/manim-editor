# Builds a self-contained "portable" folder and zip: the release executable
# plus every runtime resource next to it, matching the layout project_root()
# looks for first (see src-tauri/src/project_commands.rs). No installer, no
# admin rights: extract the zip anywhere and run manim-editor.exe.
param(
  [string]$Output = "work/portable/manim-editor-portable-windows.zip",
  [switch]$SkipBuild
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$env:CARGO_HOME = Join-Path $root "work/cargo"
$env:RUSTUP_HOME = Join-Path $root "work/rustup"
$env:PATH = (Join-Path $env:CARGO_HOME "bin") + [IO.Path]::PathSeparator + $env:PATH

if (-not $SkipBuild) {
  Push-Location $root
  npm run build
  Pop-Location
  Push-Location (Join-Path $root "src-tauri")
  cargo build --release --no-default-features
  Pop-Location
}

$exe = Join-Path $root "src-tauri/target/release/manim-editor.exe"
if (-not (Test-Path $exe)) { throw "Release executable not found at $exe. Build it first." }

$payload = Join-Path $root "work/portable/manim-editor"
if (Test-Path $payload) { Remove-Item $payload -Recurse -Force }
New-Item -ItemType Directory -Force -Path $payload | Out-Null

Copy-Item $exe (Join-Path $payload "manim-editor.exe") -Force
Copy-Item (Join-Path $root "renderer") (Join-Path $payload "renderer") -Recurse -Force
Copy-Item (Join-Path $root "contracts") (Join-Path $payload "contracts") -Recurse -Force
Copy-Item (Join-Path $root ".venv") (Join-Path $payload ".venv") -Recurse -Force
New-Item -ItemType Directory -Force -Path (Join-Path $payload "work/runtime") | Out-Null
Copy-Item (Join-Path $root "work/runtime/tex") (Join-Path $payload "work/runtime/tex") -Recurse -Force
Copy-Item (Join-Path $root "README.md") (Join-Path $payload "README.md") -Force
Copy-Item (Join-Path $root "LICENSE") (Join-Path $payload "LICENSE") -Force -ErrorAction SilentlyContinue

$destination = Join-Path $root $Output
New-Item -ItemType Directory -Force -Path (Split-Path $destination) | Out-Null
if (Test-Path $destination) { Remove-Item $destination -Force }
Compress-Archive -Path (Join-Path $payload "*") -DestinationPath $destination -CompressionLevel Optimal

$sizeMb = [Math]::Round((Get-Item $destination).Length / 1MB, 1)
Write-Output "$destination ($sizeMb MB)"
