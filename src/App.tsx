import { useCallback, useEffect, useMemo, useState } from 'react'
import { GitHub, GitHubError, type Repo, type User } from './github'
import { storage } from './util'
import Login from './components/Login'
import RepoList, { applyFilters, DEFAULT_FILTERS, type Filters } from './components/RepoList'
import RepoDetail from './components/RepoDetail'
import BatchBar from './components/BatchBar'
import Summary from './components/Summary'
import { useInstallPrompt, useOnline } from './pwa'
import Logo from './components/Logo'
import { Download, LayoutDashboard, LayoutGrid, LogOut, RefreshCw, WifiOff } from 'lucide-react'

const TOKEN_KEY = 'repos:token'
const VIEW_KEY = 'repos:view'

type View = 'repos' | 'resumen'

export default function App() {
  const [gh, setGh] = useState<GitHub | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [repos, setRepos] = useState<Repo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [view, setViewState] = useState<View>(() => (storage.get(VIEW_KEY) === 'resumen' ? 'resumen' : 'repos'))
  const setView = useCallback((v: View) => {
    setViewState(v)
    storage.set(VIEW_KEY, v, true)
  }, [])
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [booting, setBooting] = useState(true)
  const install = useInstallPrompt()
  const online = useOnline()

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
      // Solo olvidamos el token si GitHub lo rechaza, no si falta conexión.
      .catch((err) => {
        if (err instanceof GitHubError && err.status === 401) storage.remove(TOKEN_KEY)
      })
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

  if (booting) return <div className="login-page"><main className="login muted">Cargando…</main></div>
  if (!gh || !user) return <Login onLogin={login} onInstall={install} online={online} />

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <Logo size={34} />
          <h1>
            Mis <span className="gradient-text">repos</span>
          </h1>
        </div>
        <div className="user">
          {install && (
            <button className="primary" onClick={install}>
              <Download size={16} /> <span className="hide-sm">Instalar app</span>
            </button>
          )}
          <button className="icon-btn" onClick={reload} disabled={loading || !online} title="Actualizar" aria-label="Actualizar">
            <RefreshCw size={18} className={loading ? 'spin' : ''} />
          </button>
          <span className="user-chip">
            <img src={user.avatar_url} alt="" width={28} height={28} />
            <span className="hide-sm">{user.login}</span>
          </span>
          <button className="icon-btn" onClick={logout} title="Salir" aria-label="Salir">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {!online && (
        <p className="offline banner">
          <WifiOff size={16} /> Sin conexión. Vas a poder ver y cambiar tus repos cuando vuelva internet.
        </p>
      )}
      {error && <p className="error banner">{error}</p>}

      <nav className="tabs" aria-label="Vistas">
        <button className={view === 'repos' ? 'tab active' : 'tab'} aria-current={view === 'repos' ? 'page' : undefined} onClick={() => setView('repos')}>
          <LayoutGrid size={16} /> Repos
        </button>
        <button
          className={view === 'resumen' ? 'tab active' : 'tab'}
          aria-current={view === 'resumen' ? 'page' : undefined}
          onClick={() => setView('resumen')}
        >
          <LayoutDashboard size={16} /> Resumen
        </button>
      </nav>

      {view === 'resumen' ? (
        <div className="layout">
          <Summary
            gh={gh}
            login={user.login}
            repos={repos}
            loading={loading}
            onOpenRepo={(id) => {
              setSelectedId(id)
              setView('repos')
            }}
          />
        </div>
      ) : (
      <div className={`layout ${selected ? 'with-detail' : ''}`}>
        <section className="list-pane">
          <RepoList
            compact={!!selected}
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
      )}

      {view === 'repos' && checkedRepos.length > 0 && (
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
