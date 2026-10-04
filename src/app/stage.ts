import type { CSSProperties } from "react";

/** A surface painted with the scene's background, with ink that stays readable on it. */
export function stageStyle(background?: string): CSSProperties | undefined {
  if (!background) return undefined;
  const [r, g, b] = [1, 3, 5].map(index => parseInt(background.slice(index, index + 2), 16));
  const light = 0.2126 * r + 0.7152 * g + 0.0722 * b > 140;
  return { "--stage": background, ...(light && { "--stage-ink": "#18181b", "--stage-muted": "#52525b", "--stage-media": "rgb(0 0 0 / .08)", "--stage-media-ink": "#27272a" }) } as CSSProperties;
}
