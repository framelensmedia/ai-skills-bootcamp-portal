"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
// Basic types shim if needed, but usually we just pass props
type ThemeProviderProps = React.ComponentProps<typeof NextThemesProvider>;

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
    return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
