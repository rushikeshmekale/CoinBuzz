import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme";

export function ThemeToggle() {
  const { theme, set } = useTheme();

  // 🧠 detect actual theme (important for system mode)
  const isDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  const toggleTheme = () => {
    // if system → switch to opposite manually
    if (theme === "system") {
      set(isDark ? "light" : "dark");
    } else {
      set(theme === "dark" ? "light" : "dark");
    }
  };

  return (
    <button
      onClick={toggleTheme}
      aria-label="Toggle theme"
      className="flex items-center justify-center h-9 w-9 rounded-lg bg-gradient-to-br from-[#22c55e] to-[#4ade80] text-black shadow-glow hover:opacity-90 transition-opacity"
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
