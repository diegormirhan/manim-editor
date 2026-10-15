$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
    New-Item -ItemType Directory -Force docs/media | Out-Null
    foreach ($example in @("calculus-area", "shape-motion")) {
        & ./manim-editor-cli.cmd render "examples/$example.json" -o "docs/media/$example.mp4" --resolution 480p --fps 15
        if ($LASTEXITCODE -ne 0) { throw "Rendering $example failed." }
        & ffmpeg -y -hide_banner -loglevel error -i "docs/media/$example.mp4" -filter_complex '[0:v]fps=10,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse' -loop 0 "docs/media/$example.gif"
        if ($LASTEXITCODE -ne 0) { throw "Creating the $example GIF failed." }
    }
} finally {
    Pop-Location
}
