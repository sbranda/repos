// Colores de los lenguajes más comunes, para el punto y la franja de cada tarjeta.
const COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572a5',
  Java: '#b07219',
  Kotlin: '#a97bff',
  'C#': '#178600',
  'C++': '#f34b7d',
  C: '#555555',
  Go: '#00add8',
  Rust: '#dea584',
  PHP: '#4f5d95',
  Ruby: '#701516',
  Swift: '#f05138',
  Dart: '#00b4ab',
  HTML: '#e34c26',
  CSS: '#663399',
  SCSS: '#c6538c',
  Vue: '#41b883',
  Svelte: '#ff3e00',
  Shell: '#89e051',
  'Jupyter Notebook': '#da5b0b',
  Astro: '#ff5a03',
  MDX: '#fcb32c',
}

const FALLBACK = '#8b8fa3'

export function languageColor(lang: string | null): string {
  if (!lang) return FALLBACK
  return COLORS[lang] ?? hashColor(lang)
}

/** Color estable para lenguajes que no están en la tabla. */
function hashColor(s: string): string {
  let h = 0
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360
  return `hsl(${h} 55% 55%)`
}
