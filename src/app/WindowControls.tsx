import { useEffect, useState } from "react";
import { closeWindow, minimizeWindow, toggleMaximizeWindow, watchMaximized } from "../infrastructure/window";
import { Hint } from "./Hint";

// Drawn like the Windows 11 caption glyphs: 10px, hairline strokes.
const glyph = (path: string) =>
  <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><path d={path} fill="none" stroke="currentColor" strokeWidth="1" /></svg>;

/** Minimize, maximize and close, on the right of the app's own title bar. */
export function WindowControls() {
  const [maximized, setMaximized] = useState(false);
  useEffect(() => watchMaximized(setMaximized), []);
  return (
    <div className="window-controls">
      <Hint label="Minimize"><button aria-label="Minimize" onClick={() => void minimizeWindow()}>{glyph("M0 5.5h10")}</button></Hint>
      <Hint label={maximized ? "Restore down" : "Maximize"}>
        <button aria-label={maximized ? "Restore down" : "Maximize"} onClick={() => void toggleMaximizeWindow()}>
          {maximized ? glyph("M.5 2.5h7v7h-7zM2.5 2.5v-2h7v7h-2") : glyph("M.5.5h9v9h-9z")}
        </button>
      </Hint>
      <Hint label="Close"><button className="close" aria-label="Close" onClick={() => void closeWindow()}>{glyph("M0 0l10 10M10 0L0 10")}</button></Hint>
    </div>
  );
}
