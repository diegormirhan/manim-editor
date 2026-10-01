import { useEffect, useState } from "react";

type Theme = "dark" | "light";
const storageKey = "manim-editor-theme";
const systemQuery = "(prefers-color-scheme: light)";

function systemTheme(): Theme {
  try { return window.matchMedia(systemQuery).matches ? "light" : "dark"; } catch { return "dark"; }
}

function savedTheme(): Theme | null {
  try { const saved = localStorage.getItem(storageKey); if (saved === "dark" || saved === "light") return saved; } catch {}
  return null;
}

// Follows the operating system until the user picks a theme; the toggle's choice then sticks.
export function useTheme() {
  const [chosen, setChosen] = useState<Theme | null>(savedTheme);
  const [system, setSystem] = useState<Theme>(systemTheme);
  const theme = chosen ?? system;

  useEffect(() => {
    let query: MediaQueryList;
    try { query = window.matchMedia(systemQuery); } catch { return; }
    const update = () => setSystem(query.matches ? "light" : "dark");
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setChosen(next);
    try { localStorage.setItem(storageKey, next); } catch {}
  };
  return { theme, toggleTheme };
}
