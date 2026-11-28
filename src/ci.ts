// Estado de la última ejecución de GitHub Actions (en la rama principal) de cada repo.
// Se pide de a pocos repos a la vez y se guarda, así no se repiten pedidos sin necesidad.

import { useEffect, useState } from 'react'
import { GitHubError, type GitHub, type Repo, type WorkflowRun } from './github'
import { storage } from './util'

export type CiKind = 'ok' | 'fail' | 'running' | 'other' | 'none'

export interface CiInfo {
  kind: CiKind
  /** Conclusión tal como la da GitHub (cancelled, skipped, timed_out…), para mostrarla. */
  conclusion?: string | null
  url?: string
  name?: string | null
  /** Cuándo empezó la ejecución. */
  at?: string
  /** Con qué push se consultó: si el repo recibe otro push, se vuelve a consultar. */
  pushed: string | null
  checked: number
}

export type CiMap = Record<number, CiInfo>

export const CI_KEY = 'repos:ci'
/** Un resultado terminado se reusa hasta 15 minutos; uno en curso se vuelve a pedir en cada actualización. */
const MAX_AGE = 15 * 60 * 1000
const PARALLEL = 4

export function ciFromRun(run: WorkflowRun | null): Omit<CiInfo, 'pushed' | 'checked'> {
  if (!run) return { kind: 'none' }
  const base = { conclusion: run.conclusion, url: run.html_url, name: run.name, at: run.created_at }
  if (run.status !== 'completed') return { kind: 'running', ...base }
  if (run.conclusion === 'success') return { kind: 'ok', ...base }
  if (run.conclusion === 'failure' || run.conclusion === 'timed_out' || run.conclusion === 'startup_failure') return { kind: 'fail', ...base }
  return { kind: 'other', ...base }
}

export const CI_LABEL: Record<CiKind, string> = { ok: 'Pasó', fail: 'Falló', running: 'En curso', other: 'Otro', none: 'Sin Actions' }

function load(): CiMap {
  try {
    return JSON.parse(storage.get(CI_KEY) ?? '{}') as CiMap
  } catch {
    return {}
  }
}

function fresh(info: CiInfo | undefined, repo: Repo): boolean {
  return !!info && info.kind !== 'running' && info.pushed === repo.pushed_at && Date.now() - info.checked < MAX_AGE
}

/**
 * Trae el estado de Actions de los repos no archivados. `version` cambia cada vez que se actualiza
 * la lista, y ahí se vuelven a pedir los que cambiaron, están en curso o ya son viejos.
 */
export function useCiStatuses(
  gh: GitHub | null,
  repos: Repo[],
  version: number | null,
  online: boolean,
  loading: boolean,
): { ci: CiMap; pending: number } {
  const [ci, setCi] = useState<CiMap>(load)
  const [pending, setPending] = useState(0)

  useEffect(() => {
    if (!gh || !online || !version || loading) return
    let cancelled = false
    const known = load()
    const todo = repos.filter((r) => !r.archived && !fresh(known[r.id], r))
    // Los archivados no corren Actions: los sacamos para no mostrar algo viejo.
    const keep: CiMap = {}
    for (const r of repos) if (!r.archived && known[r.id]) keep[r.id] = known[r.id]
    setCi(keep)
    setPending(todo.length)
    if (!todo.length) return
    // Esperamos un momento: al abrir, la lista guardada y la recién traída llegan casi juntas.
    let started = false

    const result: CiMap = { ...keep }
    let i = 0
    let dirty = false
    const flush = () => {
      if (cancelled || !dirty) return
      dirty = false
      setCi({ ...result })
      storage.set(CI_KEY, JSON.stringify(result), true)
    }
    const timer = setInterval(flush, 400)

    async function worker() {
      while (!cancelled && i < todo.length) {
        const repo = todo[i++]
        try {
          const run = await gh!.latestRun(repo)
          result[repo.id] = { ...ciFromRun(run), pushed: repo.pushed_at, checked: Date.now() }
        } catch (err) {
          // Actions desactivado o sin permiso: lo tratamos como "sin Actions" y no insistimos.
          if (err instanceof GitHubError && (err.status === 403 || err.status === 404)) {
            result[repo.id] = { kind: 'none', pushed: repo.pushed_at, checked: Date.now() }
          }
          // Otros errores (red, límite): se vuelve a probar en la próxima actualización.
        }
        dirty = true
        if (!cancelled) setPending((n) => n - 1)
      }
    }

    const start = setTimeout(() => {
      started = true
      Promise.all(Array.from({ length: Math.min(PARALLEL, todo.length) }, worker)).then(() => {
        clearInterval(timer)
        dirty = true
        flush()
      })
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(start)
      clearInterval(timer)
      if (!started) setPending(0)
    }
    // Solo al actualizar la lista (version), no cada vez que se edita un repo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gh, version, online, loading])

  return { ci, pending }
}

export function clearCi() {
  storage.remove(CI_KEY)
}
