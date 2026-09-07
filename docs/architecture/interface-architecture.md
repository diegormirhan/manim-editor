# Interface Architecture

## Current implementation versus target

The sections below retain the interaction design targets. Today the library and
inspector are stacked in a scrollable left sidebar, not switched through a search
or back control. The app supports English copy, dark/light themes, explicit rendering,
undo/redo, seconds-based fields, and clip drag/resize with keyboard nudging. Elements
are added at time zero, not a playhead. Preview/playhead synchronization, cancellation,
library search, and the more advanced layout controls remain future work. The minimum
window is 800 × 650. Current screenshots and verified capabilities live in the
[README](../../README.md).

## Mode

This is an **Operate** interface: users arrive to construct, render, inspect, and revise an animation. Task clarity and predictable controls outrank visual spectacle.

Apple design principles guide behavior and craft. The application still follows Windows conventions and does not imitate macOS window chrome.

## Workspace topology

```text
┌──────────────────────────────────────────────────────────────┐
│ Project controls                  Saved       Render          │
├────────────────┬─────────────────────────────────────────────┤
│ Library or     │                                             │
│ Inspector      │          Last successful preview            │
│                │                                             │
├────────────────┼─────────────────────────────────────────────┤
│                │ Timeline                                    │
│                │ ─ Equation ─────[ Write ]──────[ FadeOut ]  │
│                │ ─ Axes ─────────[ Create ]─────────────────  │
└────────────────┴─────────────────────────────────────────────┘
```

### Project bar

- Shows project identity and persistence state.
- Keeps **Render** as the primary action.
- Exposes render progress, cancellation, and completion without blocking editing.
- Uses explicit labels for important actions; icon-only controls are reserved for universally familiar commands with accessible names and tooltips.

### Context sidebar

The same stable region switches between two modes:

- **Library:** searchable elements, graphs, and animations.
- **Inspector:** properties of the selected element or animation clip.

Selection changes the sidebar content without opening floating property windows. A clear back affordance returns to the library. Common controls appear first; advanced Manim-specific properties remain one level deeper.

### Preview

- Displays the last successful Manim render.
- Never pretends to be synchronized while the project contains unrendered changes.
- Shows a visible **Changes not rendered** state after an edit.
- Keeps the previous successful preview available when validation or rendering fails.
- Provides playback controls, current time, total duration, and a way to locate the current preview time on the timeline.

### Timeline

- Owns temporal order, appearance points, animation clips, and duration.
- Tracks are associated with stable element identifiers.
- Adding an element at the playhead creates an instantaneous appearance point, not an automatic entrance animation.
- Dragged clips follow the pointer continuously and preserve the initial grab offset.
- Snapping communicates its target before release and never hides a timeline validity rule.
- Invalid overlaps are prevented or explained by the domain layer rather than silently corrected by the view.

## Primary workflow

1. The user finds an element in the library and adds it at the playhead.
2. A track and appearance point are created, and the new element becomes selected.
3. The sidebar changes to the element inspector.
4. The user edits content, position, alignment, scale, rotation, color, opacity, and layer order as supported by the element.
5. The user returns to the library and adds an animation to the selected element.
6. The animation appears as a timeline clip and becomes selected for duration and parameter editing.
7. The workspace indicates that changes have not been rendered.
8. The user selects **Render**.
9. Progress is shown while the project remains editable.
10. A successful artifact replaces the preview; a failure leaves the previous preview intact and identifies the related element or clip when possible.

## Interaction principles

### Immediate response

- Buttons respond on pointer down; the action commits on release.
- Selection, focus, drag, and validation feedback appear without artificial delay.
- Starting a render acknowledges the request immediately, even though Manim output takes longer.

### Agency and forgiveness

- Undo and redo cover project-editing commands.
- The editor never adds an animation implicitly.
- Destructive confirmation is reserved for changes that undo cannot recover.
- Render cancellation is explicit and does not delete the last successful artifact.

### Spatial consistency

- Panels open and close from their own edges.
- Contextual content originates from the selected item rather than appearing in an unrelated area.
- Enter and exit paths are symmetric.
- The timeline playhead, preview time, and selected clip remain visibly related.

### Motion grammar

- Gesture-driven motion uses interruptible, critically damped springs.
- Timeline drags track the pointer one-to-one and hand release velocity into settling behavior.
- Bounce is reserved for momentum-driven movement and never decorates ordinary panel transitions.
- Reduced motion replaces spatial transitions with short cross-fades or immediate state changes.
- Motion explains state change; it does not decorate Manim's own preview.

## Windows adaptation

- Use the Windows system font stack rather than bundling a macOS imitation.
- Preserve expected keyboard focus, context menus, window controls, and shortcut behavior.
- Materials may use restrained translucency where it communicates hierarchy, with solid fallbacks for reduced transparency and increased contrast.
- Familiar video-editor patterns are used when they strengthen predictability, but the interface avoids inheriting complexity that the MVP does not need.

## Inspector model

Shared element properties are grouped consistently:

- **Content:** text, LaTeX, expression, or other kind-specific input.
- **Layout:** position preset, X/Y/Z offset, alignment, scale, and rotation.
- **Appearance:** color, opacity, stroke, fill, and layer order when supported.
- **Timing:** appearance time and visibility range.
- **Advanced:** less common Manim-specific properties supported by that element.

The schema describes data validity and defaults. Purpose-built inspector components own interaction quality. The UI must not render every property as an undifferentiated autogenerated form.

## Material states

- New empty project
- Element selected
- Animation selected
- Unsaved changes
- Changes not rendered
- Validation failure
- Render queued or starting
- Render in progress
- Cancelling
- Render succeeded
- Render failed with a previous preview
- Render failed without any preview
- Missing or incompatible rendering dependency

## Accessibility baseline

- Complete keyboard access for library search, selection, property editing, timeline navigation, rendering, undo, and redo.
- Visible focus indicators and logical focus restoration when panels change context.
- Text alternatives for icon-only controls.
- Status updates that do not rely only on color.
- Increased-contrast and reduced-transparency fallbacks.
- Reduced motion without removing useful state feedback.

## Open design decisions

- Final visual world, palette, density, and material treatment.
- Exact placement of the sidebar toggle between library and inspector.
- Minimum supported window size and compact layout behavior.
- Light mode, dark mode, or both in the first release.
- Exact keyboard shortcut map.
- Visual treatment for invalid and overlapping timeline clips.
