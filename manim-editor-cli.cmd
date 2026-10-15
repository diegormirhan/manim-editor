@echo off
rem The editor's command line, run with the Python and Manim beside this file. Start with: manim-editor-cli guide
setlocal
set "PYTHONPATH=%~dp0"
set "PYTHONUTF8=1"
"%~dp0.venv\Scripts\python.exe" -m renderer.manim_renderer.cli %*
