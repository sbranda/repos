import { Monitor, Moon, Sun } from 'lucide-react'
import type { ThemeChoice } from '../theme'

const NEXT: Record<ThemeChoice, ThemeChoice> = { system: 'light', light: 'dark', dark: 'system' }
const LABEL: Record<ThemeChoice, string> = { system: 'según el sistema', light: 'claro', dark: 'oscuro' }
const ICON = { system: Monitor, light: Sun, dark: Moon }

/** Un toque pasa por Sistema → Claro → Oscuro. */
export default function ThemeToggle({ theme, onChange }: { theme: ThemeChoice; onChange: (t: ThemeChoice) => void }) {
  const Icon = ICON[theme]
  const label = `Tema ${LABEL[theme]}. Cambiar a ${LABEL[NEXT[theme]]}`
  return (
    <button className="icon-btn theme-toggle" onClick={() => onChange(NEXT[theme])} title={label} aria-label={label}>
      <Icon size={18} />
    </button>
  )
}
