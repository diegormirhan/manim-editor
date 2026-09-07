# Rendering Pipeline

## Current implementation versus target

The event protocol, source maps, and cancellation flow below are design targets.
Today Rust dispatches a blocking Python bridge on a background task. Python validates
the snapshot, creates the isolated job directory, generates `scene.py`, and invokes
Manim CE with Cairo at 480p / 15 fps. Logs remain in the job directory; there is no
streamed progress or user cancellation yet. The subprocess timeout is
`60 + scene duration in seconds * 20`. A successful path updates the preview, and
a failed render preserves the previous successful preview.

## Contract

Rendering consumes an immutable snapshot of a valid project and produces either a successful artifact or a structured terminal failure. Editing the project during rendering does not mutate the running job.

## Flow

1. The user selects **Render**.
2. The frontend validates the current project and sends a render request through a typed Tauri command.
3. Rust creates an isolated job directory and persists the immutable project snapshot.
4. The Python compiler validates the snapshot again at the trust boundary.
5. The compiler creates readable Manim Python and source mappings from generated lines to project identifiers.
6. The Manim adapter renders with explicit quality and output arguments.
7. Structured events report phase, progress, warnings, cancellation, or failure.
8. On success, Rust publishes the new artifact and the preview loads it.
9. On failure, the previous successful preview remains available.

## Render states

```text
idle → validating → compiling → rendering → publishing → succeeded
  └────────────── validation_failed
                  compiling ────────────── compilation_failed
                               rendering ─ render_failed
             any active state ──────────── cancelling → cancelled
```

Only one terminal state is emitted for a job. Late subprocess output cannot change a terminal state.

## Event protocol

Events should be newline-delimited JSON rather than parsing human-oriented Manim logs for application state.

```json
{
  "jobId": "render-42",
  "type": "phaseChanged",
  "phase": "rendering",
  "message": "Rendering scene 1 of 1"
}
```

Human-readable Manim output may still be retained in diagnostic logs.

## Cancellation

- Cancellation targets a specific render job.
- Rust owns the child process and termination lifecycle.
- Partial output never replaces the last successful preview.
- Temporary files are removed only after the process is confirmed terminated.

## Generated Python

- Formatting is deterministic.
- Stable element names make exports readable and diffs understandable.
- Code comments are short, rare, and in English.
- Generated source contains no arbitrary code copied from project fields.
- Export and render use the same compiler path to prevent behavioral drift.

## Function expressions

Graph expressions are untrusted input. The expression field accepts a restricted mathematical notation rather than Python code. The expression layer must:

- parse a documented mathematical grammar;
- allow only known symbols, numeric constants, and approved functions;
- return position-aware validation errors;
- generate safe Python expressions or a controlled callable;
- reject imports, attribute access, statements, and arbitrary function calls.

The implemented parser uses a closed node vocabulary in TypeScript and Python,
checked against `contracts/expression-cases.json`. It accepts mathematical notation,
not Python. A 65-point finite-value check detects many invalid domains but does not
prove that the function is defined everywhere between samples.

## Caching

Render caching is not required for the first vertical slice. When introduced, cache keys derive from normalized project content, compiler version, Manim version, render settings, and relevant assets. Cache behavior must not change output correctness.
