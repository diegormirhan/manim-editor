import { useEffect, useState } from "react";
import { Logo } from "./Logo";
import { version } from "../../package.json";

/**
 * The launch moment: the playhead scrubs the logo's curve the way it scrubs a render, then the
 * window opens on the projects. Any key or click skips it; reduced motion only fades.
 */
export function Splash({ onDone }: { onDone: () => void }) {
  const [skipped, setSkipped] = useState(false);
  useEffect(() => {
    const skip = () => setSkipped(true);
    window.addEventListener("keydown", skip);
    // A hidden window never runs animations, so the splash cannot wait on them alone.
    const fallback = setTimeout(onDone, 3000);
    return () => { window.removeEventListener("keydown", skip); clearTimeout(fallback); };
  }, [onDone]);
  return (
    <div className="splash" data-skipped={skipped || undefined} aria-hidden="true" onPointerDown={() => setSkipped(true)}
      onAnimationEnd={event => { if (event.target === event.currentTarget) onDone(); }}>
      <Logo size={96} />
      <p className="splash-name">manim-editor</p>
      <p className="splash-version">Version {version}</p>
    </div>
  );
}
