// Guarda la última lista de repos para que la app abra al instante y funcione sin conexión.
// Se guarda en el mismo lugar que el token: en este navegador si elegiste "Recordarlo",
// o solo mientras la pestaña esté abierta si no. Se borra al salir.

import type { Repo, User } from './github'
import { storage } from './util'

const KEY = 'repos:cache'
const VERSION = 1

export interface CachedData {
  user: User
  repos: Repo[]
  savedAt: number
}

/** Nos quedamos solo con los campos que usa la app: la respuesta completa de GitHub es mucho más grande. */
function slim(r: Repo): Repo {
  return {
    id: r.id,
    name: r.name,
    full_name: r.full_name,
    owner: { login: r.owner.login },
    html_url: r.html_url,
    description: r.description,
    private: r.private,
    archived: r.archived,
    fork: r.fork,
    language: r.language,
    default_branch: r.default_branch,
    pushed_at: r.pushed_at,
    updated_at: r.updated_at,
    stargazers_count: r.stargazers_count,
    open_issues_count: r.open_issues_count,
    homepage: r.homepage,
    has_pages: r.has_pages,
    topics: r.topics ?? [],
  }
}

export function saveCache(user: User, repos: Repo[], savedAt: number, persist: boolean) {
  const data = {
    v: VERSION,
    savedAt,
    user: { login: user.login, name: user.name, avatar_url: user.avatar_url },
    repos: repos.map(slim),
  }
  storage.set(KEY, JSON.stringify(data), persist)
}

export function loadCache(): CachedData | null {
  const raw = storage.get(KEY)
  if (!raw) return null
  try {
    const data = JSON.parse(raw)
    if (data?.v !== VERSION || !data.user?.login || !Array.isArray(data.repos)) return null
    return { user: data.user, repos: data.repos, savedAt: Number(data.savedAt) || 0 }
  } catch {
    return null
  }
}

export function clearCache() {
  storage.remove(KEY)
}
