# Domain Model

## Source of truth

The saved project JSON is the only editable source of truth. UI state may reference domain identifiers, but it does not redefine domain data. Generated Python and rendered media are derived artifacts.

## Project document

```text
Project
├── schemaVersion
├── metadata
├── canvas
├── renderSettings
└── scenes[]
    ├── id
    ├── name
    ├── elements{}
    └── timeline
        ├── duration
        ├── tracks[]
        └── clips[]
```

Elements use stable identifiers so animations, groups, diagnostics, and UI selection do not depend on array position.

## Element shape

Every element carries common properties and kind-specific properties:

```json
{
  "id": "equation-1",
  "kind": "mathTex",
  "name": "Pythagorean theorem",
  "appearsAtMs": 0,
  "transform": {
    "position": [0, 0, 0],
    "scale": 1,
    "rotationDegrees": 0
  },
  "style": {
    "color": "#FFFFFF",
    "opacity": 1,
    "zIndex": 0
  },
  "properties": {
    "latex": "a^2 + b^2 = c^2"
  }
}
```

The exact persisted schema will be defined test-first. This example communicates intent and is not yet a compatibility contract.

## Appearance without implicit animation

Adding an element sets its `appearsAtMs` to the current playhead. The compiler emits an instantaneous scene addition at that point. No entrance animation is created automatically.

If the user later attaches an entrance animation at the same point, the domain command must resolve the duplicate appearance explicitly rather than relying on compiler guesswork. The exact UX for that replacement is still open.

## Timeline clips

A clip identifies its animation, targets, start, duration, and animation-specific properties:

```json
{
  "id": "animation-1",
  "kind": "write",
  "targetIds": ["equation-1"],
  "startMs": 500,
  "durationMs": 1200,
  "properties": {}
}
```

The domain layer, rather than the timeline component, decides whether a clip placement is valid.

The MVP supports sequential clips and explicit parallel groups. Arbitrary partial overlaps are invalid. A parallel group owns its child clips and gives the compiler an explicit concurrency boundary instead of requiring it to infer intent from geometry.

## Transform lifecycle

An MVP `Transform` clip owns a hidden destination element definition:

1. The source remains the active timeline element before the clip.
2. The destination is editable through the clip inspector but is not independently visible.
3. The compiler transforms the source into the destination during the clip.
4. At the clip end, the destination becomes the active editable element and the source lifecycle ends.

The domain transition, not the React view or Python compiler, determines the active identity after the clip. Transforming between two elements that are already independently visible is outside the MVP.

## Commands

User changes are expressed as named commands such as:

- `addElement`
- `updateElementProperties`
- `moveElementAppearance`
- `addAnimationClip`
- `moveAnimationClip`
- `resizeAnimationClip`
- `removeTimelineItem`
- `groupElements`

Each command validates its input, produces one deterministic state transition, and records enough information for undo and redo. Persistence and rendering are not hidden command side effects.

## Schema evolution

- `schemaVersion` changes only when persisted data compatibility changes.
- Migrations operate one version at a time.
- The original document is preserved until migration succeeds.
- Migration fixtures cover the oldest supported version through the current version.
- Generated Python has no schema version because it is not imported.
