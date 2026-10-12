# Builds work/runtime/python: a Python that runs on a computer without Python installed.
# The development .venv only points at the interpreter installed on this machine, so the
# packages travel with a copy of that interpreter and its standard library. The copy keeps the
# venv's Scripts\python.exe path, and the installers and the portable build ship it as .venv,
# so the app finds it where it always looks.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$venv = Join-Path $root '.venv'
$base = & (Join-Path $venv 'Scripts/python.exe') -c "import sys; print(sys.base_prefix)"
$runtime = Join-Path $root 'work/runtime/python'
if (Test-Path $runtime) { Remove-Item $runtime -Recurse -Force }
New-Item -ItemType Directory -Force -Path (Join-Path $runtime 'Scripts') | Out-Null

# python.exe looks for Lib\os.py from its own folder upwards, so Scripts\python.exe finds Lib beside Scripts.
Copy-Item (Join-Path $base '*.exe'), (Join-Path $base '*.dll') (Join-Path $runtime 'Scripts')
Copy-Item (Join-Path $base 'LICENSE.txt') $runtime
# Some Manim dependencies (mapbox_earcut, pyglm) link the Visual C++ runtime, which a clean Windows lacks.
Copy-Item (Join-Path $env:SystemRoot 'System32/msvcp140.dll') (Join-Path $runtime 'Scripts')
# The installed interpreter's own site-packages holds unrelated packages; only the venv's travel.
robocopy (Join-Path $base 'Lib') (Join-Path $runtime 'Lib') /E /XD site-packages /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "Copying the standard library failed ($LASTEXITCODE)." }
robocopy (Join-Path $base 'DLLs') (Join-Path $runtime 'DLLs') /E /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "Copying the interpreter's DLLs failed ($LASTEXITCODE)." }
robocopy (Join-Path $venv 'Lib/site-packages') (Join-Path $runtime 'Lib/site-packages') /E /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "Copying the packages failed ($LASTEXITCODE)." }

# The copy must not lean on the interpreter it came from.
$prefix = & (Join-Path $runtime 'Scripts/python.exe') -c "import sys; print(sys.prefix)"
if ((Resolve-Path $prefix).Path -ne (Resolve-Path $runtime).Path) { throw "The runtime resolved its prefix to $prefix instead of $runtime." }
$global:LASTEXITCODE = 0
Write-Output $runtime
