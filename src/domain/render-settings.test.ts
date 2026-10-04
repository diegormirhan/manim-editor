import { expect, test } from "vitest";
import {
  DEFAULT_SETTINGS, describeOutput, describeQuality, outputFrames, readSettings, renderOptions, supportsTransparency,
} from "./render-settings";

test("stored settings fall back to defaults wherever they leave the contract", () => {
  expect(readSettings(null)).toEqual(DEFAULT_SETTINGS);
  expect(readSettings("garbage")).toEqual(DEFAULT_SETTINGS);
  const read = readSettings({
    preview: { resolution: "2160p", fps: 30 },
    output: { resolution: "1440p", fps: 24, format: "avi", transparent: "yes" },
    snapping: "no", loop: true,
  });
  // A 4K preview is not offered, 24 fps is off the 15 fps grid, and AVI is not a format.
  expect(read.preview).toEqual({ resolution: DEFAULT_SETTINGS.preview.resolution, fps: 30 });
  expect(read.output).toEqual({ ...DEFAULT_SETTINGS.output, resolution: "1440p" });
  expect(read.snapping).toBe(DEFAULT_SETTINGS.snapping);
  expect(read.loop).toBe(true);
});

test("transparency survives only in containers with an alpha channel", () => {
  expect(supportsTransparency("mov")).toBe(true);
  expect(supportsTransparency("gif")).toBe(false);
  expect(readSettings({ output: { format: "webm", transparent: true } }).output.transparent).toBe(true);
  expect(readSettings({ output: { format: "mp4", transparent: true } }).output.transparent).toBe(false);
});

test("render requests carry exactly the contract's keys", () => {
  expect(renderOptions({ resolution: "720p", fps: 30 })).toEqual({ resolution: "720p", fps: 30, format: "mp4", transparent: false });
  expect(renderOptions(DEFAULT_SETTINGS.output, "mov", true)).toEqual({ resolution: "1080p", fps: 60, format: "mov", transparent: true });
});

test("descriptions and frame counts read as the user will see them", () => {
  expect(describeQuality({ resolution: "480p", fps: 15 })).toBe("480p · 15 fps");
  expect(describeOutput({ resolution: "2160p", fps: 60, format: "mov", transparent: true })).toBe("2160p · 60 fps · MOV · transparent");
  // 12 s on the 15 fps grid is 180 frames, which 60 fps renders four times over.
  expect(outputFrames(12_000, 60)).toBe(720);
  expect(outputFrames(3_000, 15)).toBe(45);
});
