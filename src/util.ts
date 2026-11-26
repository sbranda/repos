const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
]

/** "hace 3 días", "hace 2 meses", etc. */
export function haceCuanto(iso: string | null): string {
  if (!iso) return 'nunca'
  const secs = (new Date(iso).getTime() - Date.now()) / 1000
  for (const [unit, size] of UNITS) {
    if (Math.abs(secs) >= size) return rtf.format(Math.round(secs / size), unit)
  }
  return 'recién'
}

export function diasDesde(iso: string | null): number {
  if (!iso) return Infinity
  return (Date.now() - new Date(iso).getTime()) / (24 * 3600 * 1000)
}

/** Lectura/escritura segura de storage (puede fallar en modo privado). */
export const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key) ?? sessionStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key: string, value: string, persist: boolean) {
    try {
      ;(persist ? localStorage : sessionStorage).setItem(key, value)
    } catch {
      /* ignorar */
    }
  },
  remove(key: string) {
    try {
      localStorage.removeItem(key)
      sessionStorage.removeItem(key)
    } catch {
      /* ignorar */
    }
  },
}
