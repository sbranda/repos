import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GitHub, GitHubError, type Repo, type User } from './github'
import { storage } from './util'
import { clearCache, loadCache, saveCache } from './cache'
import Login from './components/Login'
import RepoList, { allTopics, applyFilters, DEFAULT_FILTERS, type Filters } from './components/RepoList'
import RepoDetail from './components/RepoDetail'
import BatchBar from './components/BatchBar'
import Summary from './components/Summary'
import Inbox from './components/Inbox'
import Security from './components/Security'
import { useInstallPrompt, useOnline } from './pwa'
import Logo from './components/Logo'
import NewRepoDialog from './components/NewRepoDialog'
import ThemeToggle from './components/ThemeToggle'
import { useTheme } from './theme'
import { clearCi, useCiStatuses } from './ci'
import { useFavorites } from './favorites'
import { Download, Inbox as InboxIcon, ShieldAlert, LayoutDashboard, LayoutGrid, LogOut, Plus, RefreshCw, WifiOff } from 'lucide-react'

const TOKEN_KEY = 'repos:token'
const VIEW_KEY = 'repos:view'

type View = 'repos' | 'resumen' | 'pendientes' | 'seguridad'
const VIEWS: View[] = ['repos', 'resumen', 'pendientes', 'seguridad']

export default function App() {
  const [gh, setGh] = useState<GitHub | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [repos, setRepos] = useState<Repo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [theme, setTheme] = useTheme()
  const [view, setViewState] = useState<View>(() => {
    const saved = storage.get(VIEW_KEY) as View | null
    return saved && VIEWS.includes(saved) ? saved : 'repos'
  })
  const setView = useCallback((v: View) => {
    setViewState(v)
    storage.set(VIEW_KEY, v, true)
  }, [])
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [booting, setBooting] = useState(true)
  const [creating, setCreating] = useState(false)
  // Cuándo se trajo la lista de GitHub por última vez (para "Actualizada hace…").
  const [savedAt, setSavedAt] = useState<number | null>(null)
  // La lista guardada vive donde vive el token: localStorage si eligió "Recordarlo".
  const rememberRef = useRef(false)
  const install = useInstallPrompt()
  const online = useOnline()

  const login = useCallback(async (token: string, remember: boolean) => {
    const client = new GitHub(token)
    const me = await client.me()
    storage.set(TOKEN_KEY, token, remember)
    rememberRef.current = remember
    setGh(client)
    setUser(me)
  }, [])

  const logout = useCallback(() => {
    storage.remove(TOKEN_KEY)
    clearCache()
    clearCi()
    setSavedAt(null)
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
    const persist = localStorageHas(TOKEN_KEY)
    const cached = loadCache()
    if (cached) {
      // Abrimos al instante con la última lista guardada; GitHub se consulta de fondo
      // (reload corre solo apenas hay cliente) y si el token ya no sirve, salimos.
      rememberRef.current = persist
      const client = new GitHub(saved)
      setGh(client)
      setUser(cached.user)
      setRepos(cached.repos)
      setSavedAt(cached.savedAt || null)
      setBooting(false)
      client.me().then(setUser, (err) => {
        if (err instanceof GitHubError && err.status === 401) logout()
      })
      return
    }
    login(saved, persist)
      // Solo olvidamos el token si GitHub lo rechaza, no si falta conexión.
      .catch((err) => {
        if (err instanceof GitHubError && err.status === 401) storage.remove(TOKEN_KEY)
      })
      .finally(() => setBooting(false))
  }, [login, logout])

  const reload = useCallback(async () => {
    if (!gh) return
    setLoading(true)
    setError(null)
    try {
      setRepos(await gh.listRepos())
      setSavedAt(Date.now())
    } catch (err) {
      if (err instanceof GitHubError && err.status === 401) logout()
      // Sin conexión ya lo avisa el cartel de arriba; seguimos con la lista guardada.
      else if (err instanceof GitHubError && err.status === 0 && !navigator.onLine) return
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [gh, logout])

  useEffect(() => {
    reload()
  }, [reload])

  // Guardamos la lista cada vez que cambia (también después de editar o archivar).
  useEffect(() => {
    if (user && savedAt) saveCache(user, repos, savedAt, rememberRef.current)
  }, [user, repos, savedAt])

  const replaceRepo = useCallback((updated: Repo) => {
    setRepos((list) => list.map((r) => (r.id === updated.id ? updated : r)))
  }, [])

  const knownTopics = useMemo(() => allTopics(repos).map(([t]) => t), [repos])
  const { ci, pending: ciPending } = useCiStatuses(gh, repos, savedAt, online, loading)
  const { favs, toggleFav } = useFavorites()
  const visible = useMemo(() => applyFilters(repos, filters, ci, favs), [repos, filters, ci, favs])
  const selected = repos.find((r) => r.id === selectedId) ?? null

  // Al cerrar el detalle, el foco vuelve al repo que estaba abierto (si no, queda perdido).
  function closeDetail(id: number) {
    setSelectedId(null)
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`.repo-row[data-repo-id="${id}"]`)?.focus())
  }
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
            <button onClick={install}>
              <Download size={16} /> <span className="hide-sm">Instalar app</span>
            </button>
          )}
          <button className="primary" onClick={() => setCreating(true)} disabled={!online} title="Crear un repo nuevo">
            <Plus size={16} /> <span className="hide-sm">Nuevo repo</span>
          </button>
          <ThemeToggle theme={theme} onChange={setTheme} />
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
          <WifiOff size={16} /> Sin conexión. Estás viendo la última lista guardada; para cambiar algo hace falta internet.
        </p>
      )}
      {error && <p className="error banner" role="alert">{error}</p>}

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
        <button
          className={view === 'pendientes' ? 'tab active' : 'tab'}
          aria-current={view === 'pendientes' ? 'page' : undefined}
          onClick={() => setView('pendientes')}
        >
          <InboxIcon size={16} /> Pendientes
        </button>
        <button
          className={view === 'seguridad' ? 'tab active' : 'tab'}
          aria-current={view === 'seguridad' ? 'page' : undefined}
          onClick={() => setView('seguridad')}
        >
          <ShieldAlert size={16} /> Seguridad
        </button>
      </nav>

      {view === 'seguridad' ? (
        <div className="layout">
          <Security
            gh={gh}
            login={user.login}
            repos={repos}
            online={online}
            onOpenRepo={(id) => {
              setSelectedId(id)
              setView('repos')
            }}
          />
        </div>
      ) : view === 'pendientes' ? (
        <div className="layout">
          <Inbox
            gh={gh}
            login={user.login}
            repos={repos}
            online={online}
            onOpenRepo={(id) => {
              setSelectedId(id)
              setView('repos')
            }}
          />
        </div>
      ) : view === 'resumen' ? (
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
            savedAt={savedAt}
            filters={filters}
            onFilters={setFilters}
            selectedId={selectedId}
            onSelect={setSelectedId}
            checked={checked}
            onChecked={setChecked}
            ci={ci}
            ciPending={ciPending}
            favs={favs}
            onToggleFav={toggleFav}
          />
        </section>

        {selected && (
          <section className="detail-pane" aria-label={`Detalle de ${selected.name}`}>
            <RepoDetail
              key={selected.id}
              gh={gh}
              repo={selected}
              onUpdated={replaceRepo}
              onClose={() => closeDetail(selected.id)}
              knownTopics={knownTopics}
              onTopic={(topic) => setFilters({ ...DEFAULT_FILTERS, status: filters.status, topic })}
            />
          </section>
        )}
      </div>
      )}

      {creating && (
        <NewRepoDialog
          gh={gh}
          login={user.login}
          repos={repos}
          knownTopics={knownTopics}
          onCreated={(r) => {
            // Lo sumamos arriba de todo y lo dejamos abierto, sin filtros que lo escondan.
            setRepos((list) => [r, ...list.filter((x) => x.id !== r.id)])
            setFilters(DEFAULT_FILTERS)
            setView('repos')
            setSelectedId(r.id)
          }}
          onClose={() => setCreating(false)}
        />
      )}

      {view === 'repos' && checkedRepos.length > 0 && (
        <BatchBar gh={gh} repos={checkedRepos} knownTopics={knownTopics} onUpdated={replaceRepo} onClear={() => setChecked(new Set())} />
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
