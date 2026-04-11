"use client";

import React from "react";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
type ThemeVars = React.CSSProperties & {
  [key: string]: string | number;
};
const performanceTheme: ThemeVars = {
  "--bg": "#f3f4f6",
  "--text": "#0f172a",
  "--muted": "#64748b",
  "--accent": "#059669",
};

const marketingTheme: ThemeVars = {
  "--bg": "#111111",
  "--text": "#D7D4D5",
  "--muted": "#8293A2",
  "--accent": "#8293A2",
};

function themeForPath(pathname: string):ThemeVars {
  if (pathname === "/" || pathname.startsWith("/about")) {
    return marketingTheme;
  }

  if (pathname.startsWith("/performance")) {
    return performanceTheme;
  }

  return marketingTheme;
}

export function RouteThemeProvider({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname() ?? "/";

  const theme = React.useMemo(() => themeForPath(pathname), [pathname]);

  return (
    <div
      className={cn(
        "min-h-screen w-full bg-[var(--bg)] text-[var(--text)] transition-colors duration-300",
        className
      )}
      style={{
        ...theme,
        color: "var(--text)",
        backgroundColor: "var(--bg)",
      }}
    >
      {children}
    </div>
  );
}
