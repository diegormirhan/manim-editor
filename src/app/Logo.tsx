import { useId } from "react";

const WAVE = "M38 136C68 56 98 56 128 136S188 216 218 136";

/**
 * The app's mark, also its icon (src-tauri/icon.svg): a playhead scrubbing a curve, the part
 * already played lit. Its parts carry classes so the launch animation can play them.
 */
export function Logo({ size = 22 }: { size?: number }) {
  const id = useId().replace(/[^\w-]/g, "");
  return (
    <svg className="logo" viewBox="0 0 256 256" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id={id + "tile"} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1d1d22" /><stop offset="1" stopColor="#09090b" />
        </linearGradient>
        <clipPath id={id + "played"}><rect className="logo-reveal" width="128" height="256" /></clipPath>
      </defs>
      <g className="logo-tile">
        <rect x="8" y="8" width="240" height="240" rx="56" fill={`url(#${id}tile)`} />
        {/* A hairline at any size, so the dark tile still reads on a dark title bar. */}
        <rect x="8.5" y="8.5" width="239" height="239" rx="55.5" fill="none" stroke="#fff" strokeOpacity=".22" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </g>
      <path className="logo-ghost" d={WAVE} fill="none" stroke="#fff" strokeOpacity=".32" strokeWidth="20" strokeLinecap="round" />
      <path d={WAVE} fill="none" stroke="#fff" strokeWidth="20" strokeLinecap="round" clipPath={`url(#${id}played)`} />
      <g className="logo-playhead" fill="#f66140">
        <path d="M128 64V218" stroke="#f66140" strokeWidth="10" strokeLinecap="round" />
        <path d="M108 30h40v22l-20 16-20-16z" stroke="#f66140" strokeWidth="4" strokeLinejoin="round" />
      </g>
      <circle className="logo-dot" cx="128" cy="136" r="17" fill="#f66140" stroke="#141418" strokeWidth="7" />
    </svg>
  );
}

/** The mark with the product name, at the left of every title bar. */
export const Wordmark = () => <><Logo /><span className="brand-name">manim-editor</span></>;
