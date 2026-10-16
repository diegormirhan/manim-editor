# Automating manim-editor

A manim-editor project is one JSON file. The editor, its command line and Manim all read that same file, so a script or
an AI agent can write a whole video as data, check it, look at it frame by frame, render it, and hand it to a person
to finish in the editor. Nothing here runs arbitrary Python: the file describes the scene and the editor writes the
Manim code.

## The command line

`manim-editor-cli.cmd` sits next to `manim-editor.exe`: in `%LOCALAPPDATA%\manim-editor` for the EXE installer,
`C:\Program Files\manim-editor` for the MSI, the extracted folder for the portable zip, or the root of a source
checkout. It runs the Python, Manim and LaTeX that ship with the editor, offline.

| Command | What it does |
|---|---|
| `manim-editor-cli guide` | Prints this guide, followed by every element kind and its fields. |
| `manim-editor-cli schema` | Prints the JSON Schema every project must satisfy. |
| `manim-editor-cli check scene.json` | Validates the project with the editor's own rules and summarises it. |
| `manim-editor-cli frame scene.json --at 2.5 -o frame.png` | Draws Manim's frame at 2.5 s and prints where each element sits, as `[left, bottom, right, top]` in scene units. |
| `manim-editor-cli render scene.json -o scene.mp4` | Renders the video, 1080p at 30 fps by default. The extension picks the format: `.mp4`, `.webm`, `.gif` or `.mov`. `--transparent` works with `.webm` and `.mov`. |
| `manim-editor-cli python scene.json -o scene.py` | Writes the readable Manim Python the editor generates. |
| `manim-editor-cli timeline scene.json -o folder` | Renders each layer as a transparent ProRes 4444 video and writes `timeline.xml` (FCP7 XML, for Premiere Pro, DaVinci Resolve and VEGAS Pro) and `timeline.fcpxml` (Final Cut Pro, DaVinci Resolve), which place every layer on its own track at its time. |

Each command accepts `-` instead of a file to read the project from standard input. A failure exits with code 1 and
prints the reason on standard error, in the same words the editor shows.

To open a project in the editor, pass its path: `manim-editor.exe scene.json`. File › Open works too, and the editor
saves the same format back.

## A good loop for an agent

1. Write the project and run `check` until it says `Valid`.
2. Run `frame` at the moments that matter and look at the images. The boxes it prints tell whether text runs off the
   frame or two elements collide.
3. Adjust positions, sizes and timing, and repeat.
4. `render` the video.

## The project

```json
{
  "schemaVersion": 1,
  "name": "Pythagoras",
  "scene": {
    "durationMs": 6000,
    "background": "#000000",
    "elements": {
      "square": { "kind": "square", "size": 2, "position": [-3, 0, 0], "appearsAtMs": 0, "layer": 0, "color": "#58C4DD" },
      "formula": { "kind": "mathTex", "latex": "a^2 + b^2 = c^2", "position": [2, 0, 0], "appearsAtMs": 1000, "layer": 1 },
      "brace": { "kind": "brace", "targetId": "formula", "label": "\\text{Pythagoras}", "position": [0, 0, 0], "appearsAtMs": 2500, "layer": 2 }
    },
    "animations": [
      { "kind": "create", "targetId": "square", "startMs": 0, "durationMs": 1500 },
      { "kind": "write", "targetId": "formula", "startMs": 1000, "durationMs": 1500 },
      { "kind": "fadeIn", "targetId": "brace", "startMs": 2500, "durationMs": 800 },
      { "kind": "rotate", "targetId": "square", "startMs": 2000, "durationMs": 2000, "degrees": 90 },
      { "kind": "indicate", "targetId": "formula", "startMs": 4000, "durationMs": 1000 }
    ]
  }
}
```

**Space.** Positions are scene units. The frame spans x from −7.11 to 7.11 and y from −4 to 4, with the origin at its
centre, x to the right and y up. The third coordinate is ignored. `position` is an element's centre; for lines and
arrows it is the start, and `end` is the other end.

**Time.** Times are integer milliseconds from the start of the scene. They land on a 15 fps grid, so an animation
lasts at least 67 ms. Every element appears at `appearsAtMs` and stays until the scene ends, or until
`disappearsAtMs` when it is set.

**Layers.** `layer` is the element's row in the timeline, from 0. Higher layers draw on top. Two elements on the same
layer cannot be on screen at the same time, as two clips on one video track cannot overlap. Without `layer`, an
element takes its position among the elements.

**Animations.** Each animation moves one element, its `targetId`, from `startMs` for `durationMs`.

- Animations of different elements may overlap freely. One element plays one animation at a time.
- Entrances (`create`, `write`, `fadeIn`, `grow`, `drawBorder`) start exactly when their element appears, and
  replace its instant appearance. An element has at most one.
- `fadeOut` ends its element's time on screen, so nothing of that element may follow it.
- `moveTo` takes `destination`, `rotate` takes `degrees` (counterclockwise), `scaleTo` takes a relative `factor` and
  `recolor` takes `color`. No other animation takes these fields.
- `transform` takes `destinationId`: another element that stays hidden until the transform ends and then replaces
  the target. Put the destination on the target's layer, as the next clip on the same track. Its own animations
  start when the transform ends.
- `indicate` and `wiggle` draw attention without changing the element.

**Element references.** A graph links to its axes with `axesId`, an area under a graph names it with `graphId`, and a
brace or highlight box names the element it surrounds with `targetId`. An annotation cannot surround another
annotation.

**Expressions.** A function graph's `expression` is restricted notation: `x`, numbers, `+ - * / ^`, implicit
multiplication such as `2x`, and `sin`, `cos`, `tan`, `sqrt`, `abs`, `exp`, `ln`, `log`. It is never Python.

**Text.** `mathTex` is LaTeX math without `$`; `tex` is LaTeX text with math between `$` signs; `text` is plain text
with any Unicode. Escape backslashes in JSON: `"\\frac{1}{2}"`.
