import { useCallback, useEffect, useMemo, useState } from 'react'
import { GitHub, GitHubError, type Repo, type User } from './github'
import { storage } from './util'
import Login from './components/Login'
import RepoList, { applyFilters, DEFAULT_FILTERS, type Filters } from './components/RepoList'
import RepoDetail from './components/RepoDetail'
import BatchBar from './components/BatchBar'

const TOKEN_KEY = 'repos:token'

export default function App() {
  const [gh, setGh] = useState<GitHub | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [repos, setRepos] = useState<Repo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [booting, setBooting] = useState(true)

  const login = useCallback(async (token: string, remember: boolean) => {
    const client = new GitHub(token)
    const me = await client.me()
    storage.set(TOKEN_KEY, token, remember)
    setGh(client)
    setUser(me)
  }, [])

  const logout = useCallback(() => {
    storage.remove(TOKEN_KEY)
    setGh(null)
    setUser(null)
    setRepos([])
    setSelectedId(null)
    setChecked(new Set())
  }, [])

  // Reingreso automático si hay un token guardado.
  useEffect(() => {
    const saved = storage.get(TOKEN_KEY)
    if (!saved) {
      setBooting(false)
      return
    }
    login(saved, !!localStorageHas(TOKEN_KEY))
      .catch(() => storage.remove(TOKEN_KEY))
      .finally(() => setBooting(false))
  }, [login])

  const reload = useCallback(async () => {
    if (!gh) return
    setLoading(true)
    setError(null)
    try {
      setRepos(await gh.listRepos())
    } catch (err) {
      if (err instanceof GitHubError && err.status === 401) logout()
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [gh, logout])

  useEffect(() => {
    reload()
  }, [reload])

  const replaceRepo = useCallback((updated: Repo) => {
    setRepos((list) => list.map((r) => (r.id === updated.id ? updated : r)))
  }, [])

  const visible = useMemo(() => applyFilters(repos, filters), [repos, filters])
  const selected = repos.find((r) => r.id === selectedId) ?? null
  const checkedRepos = repos.filter((r) => checked.has(r.id))

  if (booting) return <main className="login muted">Cargando…</main>
  if (!gh || !user) return <Login onLogin={login} />

  return (
    <div className="app">
      <header className="topbar">
        <h1>Mis repos</h1>
        <div className="user">
          <img src={user.avatar_url} alt="" width={28} height={28} />
          <span>{user.login}</span>
          <button onClick={reload} disabled={loading}>
            {loading ? 'Actualizando…' : 'Actualizar'}
          </button>
          <button onClick={logout}>Salir</button>
        </div>
      </header>

      {error && <p className="error banner">{error}</p>}

      <div className={`layout ${selected ? 'with-detail' : ''}`}>
        <section className="list-pane">
          <RepoList
            repos={repos}
            visible={visible}
            loading={loading}
            filters={filters}
            onFilters={setFilters}
            selectedId={selectedId}
            onSelect={setSelectedId}
            checked={checked}
            onChecked={setChecked}
          />
        </section>

        {selected && (
          <section className="detail-pane">
            <RepoDetail
              key={selected.id}
              gh={gh}
              repo={selected}
              onUpdated={replaceRepo}
              onClose={() => setSelectedId(null)}
            />
          </section>
        )}
      </div>

      {checkedRepos.length > 0 && (
        <BatchBar gh={gh} repos={checkedRepos} onUpdated={replaceRepo} onClear={() => setChecked(new Set())} />
      )}
    </div>
  )
}

function localStorageHas(key: string): boolean {
  try {
    return localStorage.getItem(key) !== null
  } catch {
    return false
  }
}
