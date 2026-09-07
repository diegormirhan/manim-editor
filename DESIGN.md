---
name: manim-editor
description: A restrained Windows workspace for assembling and rendering mathematical animations.
colors:
  accent-light: "#1465ce"
  accent-dark: "#5b9bea"
  canvas-light: "#f1f2f4"
  canvas-dark: "#17191d"
  chrome-light: "#fafbfd"
  chrome-dark: "#1d2025"
  sidebar-light: "#f8f9fb"
  sidebar-dark: "#1a1d22"
  text-light: "#24272d"
  text-dark: "#edf1f7"
  muted-light: "#59616e"
  muted-dark: "#aab2bf"
  line-light: "#d8dce3"
  line-dark: "#343941"
  field-light: "#fff"
  field-dark: "#242830"
  field-line-light: "#cbd0d8"
  field-line-dark: "#454c58"
  hover-light: "#e0e5ed"
  hover-dark: "#2a3038"
  library-light: "#eaf0fa"
  library-dark: "#27374f"
  selected-light: "#edf3fc"
  selected-dark: "#202d3e"
  presence-light: "#c8ddfa"
  presence-dark: "#29496f"
  presence-text-light: "#204575"
  presence-text-dark: "#edf5ff"
  animation-light: "#e5dafa"
  animation-dark: "#493a68"
  animation-text-light: "#49336e"
  animation-text-dark: "#f3edff"
  animation-line-light: "#9077bf"
  animation-line-dark: "#a98be1"
  stage: "#08090b"
typography:
  title:
    fontFamily: '"Segoe UI", system-ui, sans-serif'
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: '"Segoe UI", system-ui, sans-serif'
    fontSize: "14px"
    lineHeight: 1.5
  label:
    fontFamily: '"Segoe UI", system-ui, sans-serif'
    fontSize: "12px"
  catalog-heading:
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.04em"
  code:
    fontFamily: "Consolas, monospace"
    fontSize: "14px"
rounded:
  clip-body: "4px"
  clip: "5px"
  control: "6px"
  stage: "7px"
spacing:
  catalog-gap: "6px"
  control: "8px"
  group: "12px"
  panel: "22px"
components:
  button-primary:
    backgroundColor: "{colors.accent-light}"
    textColor: "{colors.field-light}"
    rounded: "{rounded.control}"
    padding: "9px 16px"
  button-primary-dark:
    backgroundColor: "{colors.accent-dark}"
    textColor: "{colors.field-light}"
    rounded: "{rounded.control}"
    padding: "9px 16px"
  button-ghost:
    backgroundColor: "transparent"
    rounded: "{rounded.control}"
    padding: "8px"
  library-button:
    backgroundColor: "{colors.library-light}"
    rounded: "{rounded.control}"
    padding: "8px"
  input:
    backgroundColor: "{colors.field-light}"
    rounded: "{rounded.control}"
    padding: "8px"
  presence-clip:
    backgroundColor: "{colors.presence-light}"
    textColor: "{colors.presence-text-light}"
    rounded: "{rounded.clip}"
    height: "30px"
  animation-clip:
    backgroundColor: "{colors.animation-light}"
    textColor: "{colors.animation-text-light}"
    rounded: "{rounded.clip}"
    height: "30px"
---

# Design System: manim-editor

## Overview

**Creative North Star: "Clarity and restraint"**

The established direction applies Apple principles of clarity, agency, familiarity, and restraint to a Windows application. Segoe UI, compact controls, and quiet panel boundaries keep attention on the rendered scene and its timeline. This describes the current interface, not a redesign or an accessibility certification.

**Key Characteristics:**

- Dense, practical desktop controls.
- Paired light and dark themes with blue selection.
- A consistently black video stage.
- A stacked library and inspector beside the preview and timeline.

Evidence: `src/app/style.css`, `src/app/App.tsx`, `src/app/Timeline.tsx`, and the light/dark calculus screenshots in `docs/screenshots/`. Source styles remain the implementation authority; these extracted tokens describe their current values.

## Colors

### Primary

Selection blue identifies the render action, focus outlines, library icons, and element-presence borders. The lighter dark-theme accent follows the same roles. Pale blue library buttons and selected rows provide broad, quiet state backgrounds.

### Secondary

Purple distinguishes animation clips from blue element-presence clips. These colors encode timeline meaning; colors inside rendered mathematical scenes belong to project content.

### Neutral

Cool light surfaces and charcoal dark surfaces distinguish the canvas, toolbar, sidebar, fields, and timeline. Muted text supports timing, hints, and status. Thin neutral rules separate panels. The stage retains its near-black background in both themes.

## Typography

Segoe UI with system sans-serif fallbacks is the interface family. Section titles use the title role; field labels and supporting status use the smaller label role. Catalog headings use the compact catalog-heading role in uppercase. Timeline clip labels and ruler text are (11px). The empty preview heading is (18px), weight (500); there is no large display-type system. Textareas use Consolas with a monospace fallback. Numeric inputs, the ruler, and preview timing use tabular numerals.

## Layout

The viewport workspace has a minimum height of (650px), a (280px) sidebar, and a flexible right column. Its rows are a (64px) toolbar, a flexible preview with a minimum row height of (310px), and a (250px) timeline. The library and inspector stack in one scrolling sidebar spanning both lower rows. The timeline scrolls independently.

Panel padding is generally the panel spacing token. The preview uses (18px 32px 10px). Catalog buttons form two columns. Timeline labels occupy (160px), separated from the time lanes by (12px); clip position and width express their fraction of scene duration.

At a maximum viewport width of (850px), the sidebar becomes (230px), timeline labels become (110px), preview padding becomes (16px), and toolbar spacing tightens. Brand text and save status hide; timeline heading controls wrap. The implementation retains its desktop two-column structure.

## Elevation & Depth

The current system has no box shadows, gradients, or translucent panel materials. Tonal surfaces, one-pixel dividers, selected-row backgrounds, and clip outlines create separation. The preview's clipped dark rectangle provides the strongest visual contrast.

## Shapes

Controls use gently rounded corners; the clip body, clip shell, control, and stage radii are recorded above. Workspace panels meet along straight dividers. Inputs and editable clips have one-pixel borders. Clip labels truncate inside their bounds; video uses `object-fit: contain` inside the stage.

## Components

### Buttons and toolbar

Compact icon buttons use transparent backgrounds, inherited text color, and the control padding token. Toolbar icons are generally (18px); the Render icon is (15px). Render is the filled blue action, with weight (600). In light mode its hover is (#0c53ae); the more specific dark-theme button hover uses the dark hover token. All buttons move down (1px) while pressed, with no transition duration; reduced-motion preference removes that displacement. Disabled buttons use opacity (0.45).

The File toolbar is a right-aligned row of theme, open, save, export, and render controls. It is action navigation rather than a tab bar.

### Library

Two-column catalog buttons combine a plus icon and a short, left-aligned label. Group headings supply hierarchy without cards. Dark library text is (#e7f0ff), and its first icon uses (#78adf4). Disabled catalog entries use the not-allowed cursor.

### Inputs and fields

Fields use themed solid backgrounds, one-pixel borders, and the control radius/padding tokens. Labels sit above fields with a (7px) gap. Numeric fields align side by side when appropriate. The project-name field is borderless and capped at (240px); in dark mode it receives the dark field background through the existing input rule. Invalid inputs use a (#c0392b) border. Buttons and fields share a (2px) accent focus outline with a (3px) offset.

### Timeline clips

Blue presence clips and purple animation clips share a compact shell, ellipsized (11px) labels, and (8px) edge grips. The body uses a grab cursor, changing to grabbing while pressed; grips use an east-west resize cursor and a translucent blue hover. Arrow keys adjust time by (0.1s), and Escape cancels the active drag. Animation-owned presence spans omit resize grips. The selected element row receives the selected background; this is distinct from the clip's type color.

### Preview

The stage displays the latest rendered video with native controls. A centered icon, short heading, and instruction fill the empty state. Small status and duration text surround the stage; there is no decorative frame or custom playback chrome.

## Do's and Don'ts

- Do retain Segoe UI, compact density, and the established Windows workspace arrangement.
- Do preserve light/dark semantic pairs and the black stage.
- Do use blue for selection and presence, and purple for animation clips.
- Do retain visible focus outlines and the existing reduced-motion press override.
- Don't replace this interface with macOS window chrome or a new visual concept.
- Don't promote scene artwork colors into interface brand tokens.
- Don't describe unimplemented motion, materials, or accessibility guarantees as established behavior.
