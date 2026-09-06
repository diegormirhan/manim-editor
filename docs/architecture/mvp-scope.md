# MVP Scope

## Proof workflow

A user creates a project, adds mathematical elements without writing Python, configures them, places explicit animations on a timeline, renders locally through Manim, watches the resulting preview, revises the project, renders again, and exports the video and readable Python.

The official demonstration is a 30–45 second transformation of `f(x) = x^2` into `f(x) = (x - 2)^2 + 1`. It uses axes, function graphs, equations, an annotation, an explicit parallel group, and the initial animation catalog to prove the complete workflow.

## Included element families

- Plain text
- LaTeX mathematics
- Circle
- Rectangle
- Line
- Arrow
- Cartesian axes
- Function graph
- Element group

## Included product capabilities

- Create, open, and save the application's own project format.
- Add and remove supported elements.
- Edit content, transform, and appearance properties.
- Set the time at which an element appears without an implicit animation.
- Add, move, resize, and remove supported animation clips.
- Combine animations in an explicit parallel group.
- Render explicitly and display the last successful result.
- Show actionable validation and render diagnostics.
- Export MP4 and readable generated Python.
- Undo and redo editing operations.
- Install and render completely offline on Windows without requiring Python, Manim, or later dependency downloads.
- Accept a large installer when required to keep the rendering environment self-contained.

## Included animations

- `Create`
- `Write`
- `FadeIn`
- `FadeOut`
- `Transform`
- `MoveTo`

`Transform` creates a hidden destination inside its inspector. The destination replaces the source when the clip ends. Transforming between two elements already visible on the timeline is excluded from the MVP.

## Explicitly excluded

- Importing existing Python or Manim projects.
- Round-tripping edited exported Python.
- Full Manim API coverage.
- Arbitrary Python execution.
- Public plugin APIs.
- Cloud rendering or collaboration.
- A second real-time renderer that attempts to reproduce Manim in the frontend.
- Interactive viewer output such as web sliders or clickable mathematical simulations.
- Automatic AI scene generation.
- Eliminating Manim render latency.
- Arbitrary partial overlap between animation clips.

## Completion criteria still open

- Maximum acceptable render feedback latency before a progress state appears.
- Target installer size and acceptable build-time trade-offs after the packaging spike.
