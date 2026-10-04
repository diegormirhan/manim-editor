import { useEffect, useLayoutEffect, useState } from "react";
import { flushSync } from "react-dom";

export type ThemePreference = "system" | "light" | "dark";
const KEY = "manim-editor-theme";
const darkScheme = () => window.matchMedia?.("(prefers-color-scheme: dark)");

/** Follows the operating system until the user picks a theme; that choice then sticks. */
export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(() => {
    try { const saved = localStorage.getItem(KEY); if (saved === "dark" || saved === "light" || saved === "system") return saved; } catch {}
    return "system";
  });
  const [systemDark, setSystemDark] = useState(() => darkScheme()?.matches ?? true);
  useEffect(() => {
    const query = darkScheme();
    const follow = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    query?.addEventListener("change", follow);
    return () => query?.removeEventListener("change", follow);
  }, []);
  const theme = preference === "system" ? (systemDark ? "dark" : "light") : preference;
  // Applied during the commit, so the view transition below captures the new theme.
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(KEY, preference); } catch {}
  }, [theme, preference]);
  /** A chosen theme cross-fades in (style.css), sparing the eyes a whole-window brightness jump. */
  const choose = (next: ThemePreference) => {
    const apply = () => flushSync(() => setPreference(next));
    if (document.startViewTransition) document.startViewTransition(apply); else apply();
  };
  return { theme, preference, setPreference: choose, toggleTheme: () => choose(theme === "dark" ? "light" : "dark") };
}
