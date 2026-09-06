import { useEffect, useState } from "react";
export function useTheme() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    try { const saved = localStorage.getItem("manim-editor-theme"); if (saved === "dark" || saved === "light") return saved; } catch {}
    return "dark";
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("manim-editor-theme", theme); } catch {}
  }, [theme]);
  return { theme, toggleTheme: () => setTheme(current => current === "dark" ? "light" : "dark") };
}
