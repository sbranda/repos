// Qué cuenta se está mirando: la personal, una organización o todas juntas.
// Las cuentas salen de los dueños de los repos que el token deja ver.

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Repo } from './github'
import { storage } from './util'

/** '' = todas las cuentas. */
export type Account = string

export interface Owner {
  login: string
  count: number
  personal: boolean
}

const key = (login: string) => `repos:account:${login.toLowerCase()}`

export function useAccount(login: string | null, repos: Repo[]) {
  const [saved, setSaved] = useState<Account | null>(null)
  useEffect(() => setSaved(login ? storage.get(key(login)) : null), [login])

  const owners: Owner[] = useMemo(() => {
    const count = new Map<string, number>()
    for (const r of repos) count.set(r.owner.login, (count.get(r.owner.login) ?? 0) + 1)
    return [...count]
      .map(([o, n]) => ({ login: o, count: n, personal: o.toLowerCase() === login?.toLowerCase() }))
      .sort((a, b) => Number(b.personal) - Number(a.personal) || a.login.localeCompare(b.login))
  }, [repos, login])

  // Si lo guardado ya no está (otra cuenta, otro token), se vuelve a la personal; si no tiene repos, a todas.
  const account: Account = useMemo(() => {
    if (saved === '' || owners.length < 2) return ''
    if (saved && owners.some((o) => o.login === saved)) return saved
    return owners.find((o) => o.personal)?.login ?? ''
  }, [saved, owners])

  const setAccount = useCallback(
    (a: Account) => {
      setSaved(a)
      if (login) storage.set(key(login), a, true)
    },
    [login],
  )

  const scoped = useMemo(() => (account ? repos.filter((r) => r.owner.login === account) : repos), [repos, account])

  // Para las búsquedas de Pendientes y Resumen. Se arma como texto para que no cambie en cada render.
  const ownersKey = account || owners.map((o) => o.login).join(',') || login || ''
  const searchOwners = useMemo(() => ownersKey.split(',').filter(Boolean), [ownersKey])

  return { owners, account, setAccount, scoped, searchOwners }
}
