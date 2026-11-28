// Repos favoritos: se guardan en este navegador, aparte para cada cuenta de GitHub,
// y se muestran arriba de la lista.

import { useCallback, useEffect, useState } from 'react'
import { storage } from './util'

const OLD_KEY = 'repos:favs'
const key = (login: string) => `repos:favs:${login.toLowerCase()}`

function load(login: string | null): Set<number> {
  if (!login) return new Set()
  try {
    let raw = storage.get(key(login))
    // Antes se guardaban sin separar por cuenta: se pasan a la primera cuenta que entra.
    if (raw === null && (raw = storage.get(OLD_KEY)) !== null) {
      storage.set(key(login), raw, true)
      storage.remove(OLD_KEY)
    }
    const ids = JSON.parse(raw ?? '[]')
    return new Set(Array.isArray(ids) ? ids.filter((x) => typeof x === 'number') : [])
  } catch {
    return new Set()
  }
}

export function useFavorites(login: string | null): { favs: Set<number>; toggleFav: (id: number) => void } {
  const [favs, setFavs] = useState<Set<number>>(() => load(login))
  useEffect(() => setFavs(load(login)), [login])
  const toggleFav = useCallback(
    (id: number) => {
      if (!login) return
      setFavs((prev) => {
        const next = new Set(prev)
        next.has(id) ? next.delete(id) : next.add(id)
        storage.set(key(login), JSON.stringify([...next]), true)
        return next
      })
    },
    [login],
  )
  return { favs, toggleFav }
}
