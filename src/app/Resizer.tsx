/**
 * A separator that resizes the panel beside it, by dragging or with the arrow keys. `grow` is the
 * pointer direction that enlarges the panel: 1 for right or down, -1 for left or up.
 */
export function Resizer({ label, axis, size, min, max, grow, onResize }: {
  label: string; axis: "x" | "y"; size: number; min: number; max: number; grow: 1 | -1; onResize: (size: number) => void;
}) {
  const clamp = (value: number) => Math.round(Math.min(max, Math.max(min, value)));
  const along = (event: { clientX: number; clientY: number }) => (axis === "x" ? event.clientX : event.clientY);
  const drag = (event: React.PointerEvent) => {
    event.preventDefault();
    const start = along(event), from = size;
    document.body.style.userSelect = "none";
    const follow = (pointer: PointerEvent) => onResize(clamp(from + grow * (along(pointer) - start)));
    const stop = () => {
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", follow);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", follow);
    window.addEventListener("pointerup", stop);
  };
  // Like the pointer, the arrows move the separator along its axis.
  const [backward, forward] = axis === "x" ? ["ArrowLeft", "ArrowRight"] : ["ArrowUp", "ArrowDown"];
  return <div className="resizer" role="separator" tabIndex={0} aria-label={label}
    aria-orientation={axis === "x" ? "vertical" : "horizontal"} aria-valuenow={size} aria-valuemin={min} aria-valuemax={max}
    onPointerDown={drag} onKeyDown={event => {
      const step = event.key === forward ? 24 : event.key === backward ? -24 : 0;
      if (!step) return;
      // The arrows step through frames everywhere else.
      event.preventDefault();
      onResize(clamp(size + grow * step));
    }} />;
}
