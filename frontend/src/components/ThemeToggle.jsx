import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const readTheme = () => document.documentElement.classList.contains("dark");

export function setTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.classList.toggle("dark", isDark);
  try { localStorage.setItem("theme", isDark ? "dark" : "light"); } catch { /* Session-only theme. */ }
  window.dispatchEvent(new CustomEvent("app-theme-change", { detail: isDark }));
}

export default function ThemeToggle({ className = "" }) {
  const [isDark, setIsDark] = useState(readTheme);
  useEffect(() => {
    const syncTheme = (event) => setIsDark(Boolean(event.detail));
    window.addEventListener("app-theme-change", syncTheme);
    return () => window.removeEventListener("app-theme-change", syncTheme);
  }, []);
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";
  const Icon = isDark ? Sun : Moon;
  return (
    <button type="button" onClick={() => setTheme(isDark ? "light" : "dark")}
      className={"inline-flex items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--surface-card)] p-2.5 text-[var(--text-primary)] shadow-sm transition-colors hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] " + className}
      aria-label={label} aria-pressed={isDark} title={label}>
      <Icon size={20} aria-hidden="true" />
    </button>
  );
}
