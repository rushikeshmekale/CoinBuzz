import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "dark" | "light" | "system";

const ThemeCtx = createContext<{
  theme: Theme;
  set: (t: Theme) => void;
} | null>(null);

// 🔥 detect system theme
const getSystemTheme = (): "dark" | "light" => {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("system");

  // load saved theme
  useEffect(() => {
    const stored = (localStorage.getItem("cb-theme") as Theme | null) || "system";
    setTheme(stored);
  }, []);

  // apply theme
  useEffect(() => {
    const root = document.documentElement;

    const applyTheme = () => {
      const actualTheme = theme === "system" ? getSystemTheme() : theme;

      root.classList.remove("dark", "light");
      root.classList.add(actualTheme);
    };

    applyTheme();

    // 🔥 listen to system changes
    if (theme === "system") {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      media.addEventListener("change", applyTheme);
      return () => media.removeEventListener("change", applyTheme);
    }
  }, [theme]);

  // save preference
  useEffect(() => {
    localStorage.setItem("cb-theme", theme);
  }, [theme]);

  return <ThemeCtx.Provider value={{ theme, set: setTheme }}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
