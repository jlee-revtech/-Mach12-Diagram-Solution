'use client'

import { createContext, useContext, useEffect } from 'react'

/**
 * Theme context, retired to light-only when the app adopted the Tesseract
 * XPM design system (a light-chrome system; canvas colors come from the
 * --m12-* runtime variables in globals.css).
 *
 * The provider keeps the old API surface so existing call sites compile,
 * scrubs any persisted dark preference, and always reports 'light'.
 */

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  toggleTheme: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    localStorage.removeItem('m12-theme')
    document.documentElement.classList.remove('dark')
  }, [])

  return (
    <ThemeContext.Provider value={{ theme: 'light', toggleTheme: () => {} }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
