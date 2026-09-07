param([string]$TexBin = "work/runtime/tex/TinyTeX/bin/windows")
$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
    New-Item -ItemType Directory -Force docs/media | Out-Null
    foreach ($example in @("calculus-area", "shape-motion")) {
        $video = & ./.venv/Scripts/python.exe -m renderer.manim_renderer.render_job "examples/$example.json" --tex-bin $TexBin
        if ($LASTEXITCODE -ne 0) { throw "Rendering $example failed." }
        Copy-Item -LiteralPath $video -Destination "docs/media/$example.mp4" -Force
        & ffmpeg -y -hide_banner -loglevel error -i "docs/media/$example.mp4" -filter_complex '[0:v]fps=10,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse' -loop 0 "docs/media/$example.gif"
        if ($LASTEXITCODE -ne 0) { throw "Creating the $example GIF failed." }
    }
} finally {
    Pop-Location
}
