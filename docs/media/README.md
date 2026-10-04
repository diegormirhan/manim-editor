# README media

## Provenance

The videos and GIFs were generated locally on September 7, 2026; the screenshots were
captured again on October 4, 2026, after the interface redesign. No stock images, copied
3Blue1Brown footage, AI-generated screenshots, or mocked rendering responses are used.
The original scene definitions are included in this repository.

| Asset | Source | Capture / encoding |
|---|---|---|
| [calculus-area.mp4](calculus-area.mp4) | [calculus-area.json](../../examples/calculus-area.json) | Manim CE 0.21.0, Cairo, H.264, 854 × 480, 15 fps, 13 s / 195 frames |
| [shape-motion.mp4](shape-motion.mp4) | [shape-motion.json](../../examples/shape-motion.json) | Manim CE 0.21.0, Cairo, H.264, 854 × 480, 15 fps, 15 s / 225 frames |
| [calculus-area.gif](calculus-area.gif) | calculus-area.mp4 | FFmpeg, full duration, 640 × 360, 10 fps, generated palette |
| [shape-motion.gif](shape-motion.gif) | shape-motion.mp4 | FFmpeg, full duration, 640 × 360, 10 fps, generated palette |
| [calculus-area-dark.png](../screenshots/calculus-area-dark.png) | Tauri app displaying calculus-area.json | WebView2 content capture, 1440 × 1000, dark theme, paused near 9.9 s |
| [calculus-area-light.png](../screenshots/calculus-area-light.png) | Same app and render | WebView2 content capture, 1440 × 1000, light theme, paused near 9.9 s |
| [shape-motion-dark.png](../screenshots/shape-motion-dark.png) | Tauri app displaying shape-motion.json | WebView2 content capture, 1440 × 1000, dark theme, paused near 10.8 s |
| [projects-dark.png](../screenshots/projects-dark.png) | Tauri app's Projects screen after both renders | WebView2 content capture, 1440 × 1000, dark theme |

Screenshots show the application content. The app draws its own title bar, so the one
in the screenshots is the app's; the window frame and its shadow are not included.
Viewport dimensions are set through the debugging protocol; the screenshot script
does not replace UI markup, change styles, or inject a pretend preview. Before it starts,
it lists the three bundled example files (their real paths in `examples/`) as recent
projects, so the Projects screen opens them without a native file dialog; each one is
still read by the Rust and Python bridge. It then clicks Render, waits for the actual
native bridge to complete, seeks the resulting video, and finally returns to Projects.

## Rebuild videos and GIFs

Prepare the Python/Manim/TeX environment described in the [main README](../../README.md).
FFmpeg must be on PATH. From the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/generate-demo-media.ps1
```

Use `-TexBin C:/path/to/tex/bin/windows` with another TeX installation. The script
replaces only the two named MP4/GIF pairs under `docs/media`; isolated render jobs
remain under the ignored `work/renders` directory.

## Capture the desktop application

Use a disposable development window: the capture opens the examples and replaces its
current project. Save any work and close existing debug windows first.

In one terminal, with Rust available:

```powershell
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = '--remote-debugging-port=9223'
npm run desktop
```

When the Projects screen is showing, in a second terminal:

```powershell
node scripts/capture-readme.mjs
```

The script requires Node 24, connects to the local page target, renders both examples,
captures both themes, and replaces the four named screenshots. Close the debugging window
afterward and run `Remove-Item Env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` in the first
terminal; do not leave remote debugging enabled for normal use. The script restores the
original viewport and the recent-project, session and theme entries it changed.

## Inspect the encoded output

```powershell
ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,r_frame_rate,nb_frames:format=duration,size -of json docs/media/calculus-area.mp4
ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,r_frame_rate,nb_frames:format=duration,size -of json docs/media/shape-motion.mp4
```

GIFs provide GitHub-compatible inline motion; MP4 links retain the complete encoded
video without relying on unsupported relative HTML video embeds.
