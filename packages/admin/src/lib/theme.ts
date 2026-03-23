import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() =>
    (localStorage.getItem('ucli-theme') as Theme) ?? 'light',
  )

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('ucli-theme', theme)
  }, [theme])

  function toggleTheme() {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'))
  }

  return { theme, toggleTheme }
}

// Apply saved theme immediately on module load (before React renders)
// to prevent flash of wrong theme
const saved = localStorage.getItem('ucli-theme') as Theme | null
if (saved === 'dark') {
  document.documentElement.classList.add('dark')
}
