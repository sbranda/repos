// Reglas de GitHub para las etiquetas (topics): minúsculas, letras, números y guiones,
// empiezan con letra o número, hasta 50 caracteres y hasta 20 por repo.

export const MAX_TOPICS = 20
const MAX_LENGTH = 50

/** Convierte lo que escribió la persona en una etiqueta válida, o '' si no queda nada. */
export function normalizeTopic(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // saca tildes: "publicación" → "publicacion"
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_LENGTH)
    .replace(/-+$/, '')
}

export function sameTopics(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((t, i) => t === b[i])
}
