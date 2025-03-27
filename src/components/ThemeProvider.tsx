// src/components/ThemeProvider.tsx
'use client'

import * as React from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
// FIX: Import type directly from 'next-themes'
import type { ThemeProviderProps } from 'next-themes';

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
    // Enable system preference, store theme in localStorage, apply class to 'html' tag
    return <NextThemesProvider attribute="class" defaultTheme="system" enableSystem {...props}>{children}</NextThemesProvider>
}