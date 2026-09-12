import type { Animation, Element } from "../domain/project";

const drawn = "M5 19l2.5-5.5L16 5l3 3-8.5 8.5zM14 7l3 3";
const motions: Record<Animation["kind"], string> = {
  create: drawn, write: drawn, drawBorder: drawn,
  fadeIn: "M3 12h10M9 8l4 4-4 4M15 5h4v14h-4",
  fadeOut: "M10 12h11M17 8l4 4-4 4M9 5H5v14h4",
  grow: "M9 9L4 4M15 9l5-5M9 15l-5 5M15 15l5 5M4 4v4M4 4h4M20 4v4M20 4h-4M4 20v-4M4 20h4M20 20v-4M20 20h-4",
  moveTo: "M5 12a1.5 1.5 0 100 .01M8 12h12M16 8l4 4-4 4",
  rotate: "M20 12a8 8 0 11-2.4-5.7M20 4v4h-4",
  scaleTo: "M4 20l6-6M4 20v-5M4 20h5M20 4l-6 6M20 4v5M20 4h-5",
  recolor: "M12 4c3 4 6 7 6 10a6 6 0 01-12 0c0-3 3-6 6-10z",
  indicate: "M12 4a8 8 0 110 16 8 8 0 010-16zM12 9.5a2.5 2.5 0 110 5 2.5 2.5 0 010-5z",
  wiggle: "M3 12c2-4 3-4 4.5 0s2.5 4 4.5 0 3-4 4.5 0 2.5 4 4.5 0",
  transform: "M3 8h7v7H3zM17.5 8a3.5 3.5 0 110 7 3.5 3.5 0 010-7zM10.5 11.5h3",
  parallel: "M4 8h16M4 16h16M7 5v6M7 13v6",
};

export function AnimationIcon({ kind, size = 12 }: { kind: Animation["kind"]; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={motions[kind]} /></svg>;
}

const glyphs: Record<Element["kind"], string> = {
  mathTex: "M5 7h6M8 7v10M14 9l5 8M19 9l-5 8",
  text: "M5 6h14M12 6v13M9 19h6",
  circle: "M12 4.5a7.5 7.5 0 110 15 7.5 7.5 0 010-15z",
  dot: "M12 9a3 3 0 110 6 3 3 0 010-6z",
  ellipse: "M3 12c0-3 4-5.5 9-5.5s9 2.5 9 5.5-4 5.5-9 5.5S3 15 3 12z",
  rectangle: "M3 7h18v10H3z",
  square: "M5 5h14v14H5z",
  triangle: "M12 4l8.5 15h-17z",
  regularPolygon: "M12 3.5l7.4 4.25v8.5L12 20.5l-7.4-4.25v-8.5z",
  arc: "M4 17a8 8 0 0116 0",
  line: "M4 19L20 5",
  arrow: "M4 19L19 6M11 6h8v8",
  axes: "M4 20V4M4 20h16M4 4l-2 3M4 4l2 3M20 20l-3-2M20 20l-3 2",
  numberPlane: "M3 12h18M12 3v18M3 7h18M3 17h18M7 3v18M17 3v18",
  numberLine: "M2 12h20M5 9v6M12 9v6M19 9v6",
  functionGraph: "M3 4c3 10 6 15 9 15s6-5 9-15",
  areaUnderGraph: "M3 20h18M5 20c2-8 5-13 9-13s5 4 5 13M9 20v-8M13 20V8M17 20v-9",
};

export function ElementIcon({ kind, size = 16 }: { kind: Element["kind"]; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={kind === "dot" ? "currentColor" : "none"}
    stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={glyphs[kind]} />
  </svg>;
}
