import contract from "../../contracts/render-options.json";

export type Resolution = keyof typeof contract.resolutions;
type VideoFormat = keyof typeof contract.formats;
type FrameRate = 15 | 30 | 60;
export type Quality = { resolution: Resolution; fps: FrameRate };
type OutputSettings = Quality & { format: VideoFormat; transparent: boolean };
export type Settings = {
  preview: Quality;
  output: OutputSettings;
  snapping: boolean;
  /** Dragged objects snap to the frame and to each other, with a line on each alignment. */
  alignmentGuides: boolean;
  loop: boolean;
  /** Manim's frame at the playhead while you edit, from a worker kept in the background. */
  livePreview: boolean;
  restoreSession: boolean;
};

export const RESOLUTIONS = Object.keys(contract.resolutions) as Resolution[];
export const PREVIEW_RESOLUTIONS = contract.previewResolutions as Resolution[];
export const FRAME_RATES = contract.frameRates as FrameRate[];
export const FORMATS = Object.keys(contract.formats) as VideoFormat[];

export const DEFAULT_SETTINGS: Settings = {
  preview: { resolution: "480p", fps: 15 },
  output: { resolution: "1080p", fps: 60, format: "mp4", transparent: false },
  snapping: true,
  alignmentGuides: true,
  loop: false,
  livePreview: true,
  restoreSession: true,
};

export const supportsTransparency = (format: VideoFormat) => contract.formats[format].transparency;
export const dimensions = (resolution: Resolution) => contract.resolutions[resolution];
export const formatName = (format: VideoFormat) => contract.formats[format].label;
export const formatCodec = (format: VideoFormat) => contract.formats[format].codec;
export const describeQuality = ({ resolution, fps }: Quality) => `${resolution} · ${fps} fps`;
export const describeOutput = (output: OutputSettings) =>
  `${describeQuality(output)} · ${formatName(output.format)}${output.transparent ? " · transparent" : ""}`;

/** What the bridge receives for a render: the contract's keys and nothing else. */
export const renderOptions = (quality: Quality, format: VideoFormat = "mp4", transparent = false) =>
  ({ resolution: quality.resolution, fps: quality.fps, format, transparent });

/** Settings read back from storage: anything unknown or outside the contract falls back to its default. */
export function readSettings(stored: unknown): Settings {
  const record = (value: unknown) => (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
  const one = <T,>(value: unknown, allowed: readonly T[], fallback: T) => (allowed.includes(value as T) ? value as T : fallback);
  const flag = (value: unknown, fallback: boolean) => (typeof value === "boolean" ? value : fallback);
  const value = record(stored), preview = record(value.preview), output = record(value.output);
  const defaults = DEFAULT_SETTINGS;
  const format = one(output.format, FORMATS, defaults.output.format);
  return {
    preview: {
      resolution: one(preview.resolution, PREVIEW_RESOLUTIONS, defaults.preview.resolution),
      fps: one(preview.fps, FRAME_RATES, defaults.preview.fps),
    },
    output: {
      resolution: one(output.resolution, RESOLUTIONS, defaults.output.resolution),
      fps: one(output.fps, FRAME_RATES, defaults.output.fps),
      format,
      transparent: flag(output.transparent, defaults.output.transparent) && supportsTransparency(format),
    },
    snapping: flag(value.snapping, defaults.snapping),
    alignmentGuides: flag(value.alignmentGuides, defaults.alignmentGuides),
    loop: flag(value.loop, defaults.loop),
    livePreview: flag(value.livePreview, defaults.livePreview),
    restoreSession: flag(value.restoreSession, defaults.restoreSession),
  };
}
