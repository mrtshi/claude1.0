import { useEffect, useState } from "react";

export default function Header() {
  const [logoFailed, setLogoFailed] = useState(false);
  const [dark, setDark] = useState(false);

  // Restore the saved theme (or system preference) on mount.
  useEffect(() => {
    let saved = null;
    try {
      saved = localStorage.getItem("theme");
    } catch (e) {
      saved = null;
    }
    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = saved ? saved === "dark" : prefersDark;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch (e) {
      // storage unavailable (e.g. private mode) — theme still toggles
    }
  }

  return (
    <header className="sticky top-0 z-20 bg-white/40 backdrop-blur-md border-b border-white/50 shadow-sm">
      <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-center relative">
        {!logoFailed ? (
          <img
            src="https://www.polair.com/local/templates/cult/img/logo.svg"
            alt="Polair"
            className="h-8 sm:h-9 w-auto"
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <span className="text-xl sm:text-2xl font-semibold tracking-wide text-polair-dark">
            Polair
          </span>
        )}

        {/* Theme toggle: sun / moon, top right corner */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={dark ? "Включить светлую тему" : "Включить тёмную тему"}
          title={dark ? "Светлая тема" : "Тёмная тема"}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full bg-white border border-gray-300 text-base leading-none hover:border-polair-blue transition-colors"
        >
          <span aria-hidden="true">{dark ? "☀️" : "🌙"}</span>
        </button>
      </div>
    </header>
  );
}
