import { useEffect, useState } from "react";
import { readSettings, type Settings } from "../domain/render-settings";

const KEY = "manim-editor-settings";

export const storedSettings = (): Settings => {
  try { return readSettings(JSON.parse(localStorage.getItem(KEY) ?? "null")); } catch { return readSettings(null); }
};

/** Preferences that belong to this computer, not to a project; every change passes the domain's checks. */
export function useSettings() {
  const [settings, setSettings] = useState(storedSettings);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* storage blocked: settings last for this session */ }
  }, [settings]);
  const update = (patch: Partial<Settings>) => setSettings(current => readSettings({ ...current, ...patch }));
  return [settings, update] as const;
}
