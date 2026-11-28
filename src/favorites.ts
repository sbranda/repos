// Repos favoritos: se guardan en este navegador y se muestran arriba de la lista.

import { useCallback, useState } from 'react'
import { storage } from './util'

export const FAVS_KEY = 'repos:favs'

function load(): Set<number> {
  try {
    const ids = JSON.parse(storage.get(FAVS_KEY) ?? '[]')
    return new Set(Array.isArray(ids) ? ids.filter((x) => typeof x === 'number') : [])
  } catch {
    return new Set()
  }
}

export function useFavorites(): { favs: Set<number>; toggleFav: (id: number) => void } {
  const [favs, setFavs] = useState<Set<number>>(load)
  const toggleFav = useCallback((id: number) => {
    setFavs((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      storage.set(FAVS_KEY, JSON.stringify([...next]), true)
      return next
    })
  }, [])
  return { favs, toggleFav }
}
