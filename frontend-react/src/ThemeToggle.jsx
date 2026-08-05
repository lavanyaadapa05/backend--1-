import { useEffect, useState } from "react";

const STORAGE_KEY = "payflow-theme";

function getInitialTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch (e) { /* ignore */ }
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

export function useTheme() {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) { /* ignore */ }
  }, [theme]);

  return [theme, setTheme];
}

export default function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={onToggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
    >
      <span className={`theme-toggle-track ${isDark ? "dark" : "light"}`}>
        <span className="theme-toggle-thumb">
          <svg className="icon-sun" viewBox="0 0 24 24" width="13" height="13">
            <circle cx="12" cy="12" r="4.5" fill="currentColor" />
            <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <line x1="12" y1="1.8" x2="12" y2="4.2" />
              <line x1="12" y1="19.8" x2="12" y2="22.2" />
              <line x1="1.8" y1="12" x2="4.2" y2="12" />
              <line x1="19.8" y1="12" x2="22.2" y2="12" />
              <line x1="4.4" y1="4.4" x2="6.1" y2="6.1" />
              <line x1="17.9" y1="17.9" x2="19.6" y2="19.6" />
              <line x1="4.4" y1="19.6" x2="6.1" y2="17.9" />
              <line x1="17.9" y1="6.1" x2="19.6" y2="4.4" />
            </g>
          </svg>
          <svg className="icon-moon" viewBox="0 0 24 24" width="13" height="13">
            <path fill="currentColor" d="M20.7 14.9A8.5 8.5 0 1 1 9.1 3.3a7 7 0 1 0 11.6 11.6z" />
          </svg>
        </span>
      </span>
    </button>
  );
}

