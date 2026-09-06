# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

- Windows desktop application built with Tauri.
- React, TypeScript, and Vite for the frontend.
- Manim Community Edition and Python for rendering.
- The Windows installer must bundle the complete rendering environment without requiring a preinstalled Python, Manim, or a later dependency download.
- Installation and rendering must work offline. A large installer is acceptable.

## Users

- Academic students who create mathematical animations.
- Content creators who currently use Manim to produce videos.

Both groups want to spend less time translating a visual idea into repetitive Python and discovering the classes and parameters needed to express it.

## Product Purpose

Provide a visual desktop editor for creating Manim animations without writing Python line by line. Users assemble elements and animations on a timeline, render through Manim, inspect the result, revise the project, and render again.

The first successful release is a focused MVP that demonstrates this complete workflow. It does not attempt to expose the entire Manim API.

## Positioning

The product combines a familiar video-editor workflow with deterministic Manim code generation. Unlike a code assistant or API reference, it represents scenes, elements, and animations as editable visual project data.

## Operating Context

- Projects are created and edited only inside the application.
- The central preview displays the most recent Manim render; it is not a live rendering engine.
- Users update elements or animations and explicitly render again to refresh the preview.
- The application does not import arbitrary existing Manim Python projects.
- The application can export readable Python, but exported Python is not imported back into the project.

## Capabilities and Constraints

- A versioned JSON project document is the single source of truth.
- Python is a deterministic, one-way generated output.
- Adding an element makes it visible without assigning an entrance animation automatically.
- Users explicitly add animations to elements.
- The MVP element catalog includes `Text`, `MathTex`, circles, rectangles, lines, arrows, axes, function graphs, and element groups.
- The MVP animation catalog includes `Create`, `Write`, `FadeIn`, `FadeOut`, `Transform`, and `MoveTo`.
- The MVP supports sequential animations and explicit parallel groups, but not arbitrary partial clip overlaps.
- Function-graph fields accept restricted mathematical notation such as `x^2`, `sin(x)`, and `sqrt(x)`, never arbitrary Python expressions.
- In the MVP, `Transform` creates and owns a hidden destination definition. When the animation finishes, that destination replaces the source as the editable timeline element.
- Transforming between two elements that are already visible is outside the MVP.
- Rendering latency inherent to Manim is accepted; eliminating it is not an MVP goal.
- Windows packaging must be validated through an early technical spike before the editor architecture depends on an unproven distribution strategy.
- The packaging spike must measure installer size and verify redistribution licenses for every bundled dependency.
- New elements and animations must be added incrementally through cohesive definitions and focused Manim adapters.
- Code must avoid redundant domain rules and speculative abstraction.
- Behavior changes are developed test-first whenever practical.
- Code comments are short, rare, and written in English.

## Brand Commitments

Apply Apple design principles—clarity, agency, familiarity, responsiveness, restraint, accessibility, and craft—while respecting Windows conventions rather than imitating macOS chrome.

## Evidence on Hand

No user interviews, usage measurements, existing prototype, brand assets, or validated time-saving benchmark are available yet. Portfolio claims must not invent these.

## Portfolio Demonstration

The official MVP proof is a 30–45 second animation that creates axes and the graph of `f(x) = x^2`, writes its equation, fades in an annotation, transforms the graph into `f(x) = (x - 2)^2 + 1`, moves the annotation, and fades it out. The scenario also exercises an explicit parallel group and exports both MP4 and readable Python.

## Product Principles

- Keep the common animation workflow visual and explicit.
- Preserve user agency; do not add animations or change project content implicitly.
- Keep Manim as the authority for rendered output.
- Add supported Manim capabilities incrementally through clear, testable boundaries.
- Prefer a small, complete workflow over broad but shallow API coverage.

## Accessibility & Inclusion

Keyboard navigation, reduced motion, increased contrast, and reduced transparency need explicit acceptance criteria before implementation.
