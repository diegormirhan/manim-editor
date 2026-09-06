param([string]$Output = "work/offline/manim-editor-runtime.zip")
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$payload = Join-Path $root "work/offline/payload"
New-Item -ItemType Directory -Force -Path $payload | Out-Null
Copy-Item (Join-Path $root "renderer") (Join-Path $payload "renderer") -Recurse -Force
Copy-Item (Join-Path $root "contracts") (Join-Path $payload "contracts") -Recurse -Force
Copy-Item (Join-Path $root ".venv") (Join-Path $payload ".venv") -Recurse -Force
Copy-Item (Join-Path $root "work/runtime") (Join-Path $payload "runtime") -Recurse -Force
$destination = Join-Path $root $Output
New-Item -ItemType Directory -Force -Path (Split-Path $destination) | Out-Null
Compress-Archive -Path (Join-Path $payload "*") -DestinationPath $destination -Force
Write-Output $destination
