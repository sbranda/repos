// Tema claro/oscuro elegido a mano, o el del sistema. La elección se guarda en localStorage.
// index.html aplica el tema antes de pintar (para que no parpadee); acá lo mantenemos al día.

import { useEffect, useState } from 'react'
import { storage } from './util'

export type ThemeChoice = 'system' | 'light' | 'dark'

export const THEME_KEY = 'repos:theme'
const COLORS = { light: '#6d28d9', dark: '#0c0a17' }

export function readTheme(): ThemeChoice {
  const v = storage.get(THEME_KEY)
  return v === 'light' || v === 'dark' ? v : 'system'
}

function systemDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
}

export function applyTheme(choice: ThemeChoice) {
  const resolved = choice === 'system' ? (systemDark() ? 'dark' : 'light') : choice
  document.documentElement.dataset.theme = resolved
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLORS[resolved])
}

export function useTheme(): [ThemeChoice, (t: ThemeChoice) => void] {
  const [theme, setTheme] = useState<ThemeChoice>(readTheme)

  useEffect(() => {
    applyTheme(theme)
    if (theme === 'system') storage.remove(THEME_KEY)
    else storage.set(THEME_KEY, theme, true)
    if (theme !== 'system' || typeof matchMedia !== 'function') return
    // Siguiendo al sistema: si cambia mientras la app está abierta, la app cambia también.
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  return [theme, setTheme]
}
