"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <span className={`btn btn-ghost ${className}`} style={{ width: 36, padding: "0.5rem" }} />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      className={`btn btn-ghost ${className}`}
      style={{ width: 36, padding: "0.5rem" }}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "切换到亮色" : "切换到暗色"}
      title={isDark ? "切换到亮色" : "切换到暗色"}
    >
      {isDark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
