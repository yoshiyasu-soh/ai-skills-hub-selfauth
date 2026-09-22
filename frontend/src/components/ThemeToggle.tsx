import { useTheme } from "../lib/ThemeContext";
import { MoonIcon, SunIcon } from "./icons";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "ライトモードに切り替え" : "ダークモードに切り替え"}
      className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-ink-secondary transition-colors hover:border-border-hover hover:bg-surface-2 hover:text-ink"
    >
      {isDark ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
    </button>
  );
}
