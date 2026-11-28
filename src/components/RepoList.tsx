import { useMemo } from 'react'
import type { Repo } from '../github'
import { Archive, CircleCheck, CircleX, Clock, Download, GitFork, Globe, LoaderCircle, Lock, Pin, RefreshCw, Search, SlidersHorizontal, Star } from 'lucide-react'
import { CI_LABEL, type CiMap } from '../ci'
import { diasDesde, haceCuanto } from '../util'
import { languageColor } from '../languages'
import { download, fileName, reposCsv } from '../csv'

export interface Filters {
  text: string
  language: string
  topic: string
  visibility: 'all' | 'public' | 'private'
  status: 'active' | 'archived' | 'all'
  forks: boolean
  pages: 'all' | 'with' | 'without'
  inactive: 0 | 180 | 365 | 730
  /** Estado de la última ejecución de GitHub Actions. */
  ci: 'all' | 'fail' | 'ok' | 'running' | 'none'
  sort: 'pushed' | 'name' | 'stars'
  /** Mostrar solo los favoritos. */
  onlyFavs: boolean
}

export const DEFAULT_FILTERS: Filters = {
  text: '',
  language: '',
  topic: '',
  visibility: 'all',
  status: 'active',
  forks: true,
  pages: 'all',
  inactive: 0,
  ci: 'all',
  sort: 'pushed',
  onlyFavs: false,
}

/** Filtra y ordena. Los favoritos siempre van primero, cada grupo con el orden elegido. */
export function applyFilters(repos: Repo[], f: Filters, ci: CiMap = {}, favs: Set<number> = new Set()): Repo[] {
  const q = f.text.trim().toLowerCase()
  const out = repos.filter((r) => {
    if (
      q &&
      !r.name.toLowerCase().includes(q) &&
      !(r.description ?? '').toLowerCase().includes(q) &&
      !(r.topics ?? []).some((t) => t.includes(q))
    )
      return false
    if (f.onlyFavs && !favs.has(r.id)) return false
    if (f.topic && !(r.topics ?? []).includes(f.topic)) return false
    if (f.language && (r.language ?? 'Sin lenguaje') !== f.language) return false
    if (f.visibility === 'public' && r.private) return false
    if (f.visibility === 'private' && !r.private) return false
    if (f.status === 'active' && r.archived) return false
    if (f.status === 'archived' && !r.archived) return false
    if (!f.forks && r.fork) return false
    if (f.pages === 'with' && !r.has_pages) return false
    if (f.pages === 'without' && r.has_pages) return false
    if (f.inactive && diasDesde(r.pushed_at) < f.inactive) return false
    if (f.ci !== 'all') {
      const kind = r.archived ? 'none' : ci[r.id]?.kind
      if (kind !== f.ci) return false
    }
    return true
  })
  out.sort((a, b) => {
    const fa = favs.has(a.id) ? 0 : 1
    const fb = favs.has(b.id) ? 0 : 1
    if (fa !== fb) return fa - fb
    if (f.sort === 'name') return a.name.localeCompare(b.name)
    if (f.sort === 'stars') return b.stargazers_count - a.stargazers_count
    return (b.pushed_at ?? '').localeCompare(a.pushed_at ?? '')
  })
  return out
}

interface Props {
  compact: boolean
  repos: Repo[]
  visible: Repo[]
  loading: boolean
  /** Cuándo se trajo la lista de GitHub por última vez (ms), o null si nunca. */
  savedAt: number | null
  filters: Filters
  onFilters: (f: Filters) => void
  selectedId: number | null
  onSelect: (id: number) => void
  checked: Set<number>
  onChecked: (s: Set<number>) => void
  /** Estado de GitHub Actions por repo. */
  ci: CiMap
  /** Cuántos repos faltan consultar. */
  ciPending: number
  /** Repos marcados como favoritos. */
  favs: Set<number>
  onToggleFav: (id: number) => void
}

export default function RepoList({ compact, repos, visible, loading, savedAt, filters, onFilters, selectedId, onSelect, checked, onChecked, ci, ciPending, favs, onToggleFav }: Props) {
  const languages = useMemo(
    () => [...new Set(repos.map((r) => r.language ?? 'Sin lenguaje'))].sort((a, b) => a.localeCompare(b)),
    [repos],
  )
  const topics = useMemo(() => allTopics(repos), [repos])
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onFilters({ ...filters, [k]: v })

  const allVisibleChecked = visible.length > 0 && visible.every((r) => checked.has(r.id))
  function toggleAll() {
    const next = new Set(checked)
    for (const r of visible) allVisibleChecked ? next.delete(r.id) : next.add(r.id)
    onChecked(next)
  }
  function toggle(id: number) {
    const next = new Set(checked)
    next.has(id) ? next.delete(id) : next.add(id)
    onChecked(next)
  }

  return (
    <>
      <div className="filters">
        <div className="search">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            placeholder="Buscar por nombre o etiqueta"
            value={filters.text}
            onChange={(e) => set('text', e.target.value)}
            aria-label="Buscar"
            aria-keyshortcuts="/"
          />
          <kbd className="search-kbd" aria-hidden="true" title="Atajos: / para buscar, flechas para moverte por la lista">/</kbd>
        </div>
        <div className="filter-row">
          <SlidersHorizontal size={16} className="muted" aria-hidden="true" />
          <select value={filters.status} onChange={(e) => set('status', e.target.value as Filters['status'])} aria-label="Estado">
            <option value="active">Activos</option>
            <option value="archived">Archivados</option>
            <option value="all">Activos y archivados</option>
          </select>
          <select value={filters.visibility} onChange={(e) => set('visibility', e.target.value as Filters['visibility'])} aria-label="Visibilidad">
            <option value="all">Públicos y privados</option>
            <option value="public">Solo públicos</option>
            <option value="private">Solo privados</option>
          </select>
          <select value={filters.pages} onChange={(e) => set('pages', e.target.value as Filters['pages'])} aria-label="Sitio web">
            <option value="all">Con y sin sitio</option>
            <option value="with">Con sitio (Pages)</option>
            <option value="without">Sin sitio</option>
          </select>
          <select value={filters.language} onChange={(e) => set('language', e.target.value)} aria-label="Lenguaje">
            <option value="">Todos los lenguajes</option>
            {languages.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
          {(topics.length > 0 || filters.topic) && (
            <select value={filters.topic} onChange={(e) => set('topic', e.target.value)} aria-label="Etiqueta">
              <option value="">Todas las etiquetas</option>
              {filters.topic && !topics.some(([t]) => t === filters.topic) && <option value={filters.topic}>{filters.topic}</option>}
              {topics.map(([t, n]) => (
                <option key={t} value={t}>
                  {t} ({n})
                </option>
              ))}
            </select>
          )}
          <select
            value={filters.inactive}
            onChange={(e) => set('inactive', Number(e.target.value) as Filters['inactive'])}
            aria-label="Último push"
          >
            <option value={0}>Cualquier fecha</option>
            <option value={180}>Sin cambios hace 6+ meses</option>
            <option value={365}>Sin cambios hace 1+ año</option>
            <option value={730}>Sin cambios hace 2+ años</option>
          </select>
          {(Object.keys(ci).length > 0 || filters.ci !== 'all') && (
            <select value={filters.ci} onChange={(e) => set('ci', e.target.value as Filters['ci'])} aria-label="GitHub Actions">
              <option value="all">Cualquier estado de Actions</option>
              <option value="fail">Actions: falló</option>
              <option value="ok">Actions: pasó</option>
              <option value="running">Actions: en curso</option>
              <option value="none">Sin Actions</option>
            </select>
          )}
          <select value={filters.sort} onChange={(e) => set('sort', e.target.value as Filters['sort'])} aria-label="Orden">
            <option value="pushed">Último push</option>
            <option value="name">Nombre</option>
            <option value="stars">Estrellas</option>
          </select>
          <label className="check chip">
            <input type="checkbox" checked={filters.forks} onChange={(e) => set('forks', e.target.checked)} />
            Incluir forks
          </label>
          {(favs.size > 0 || filters.onlyFavs) && (
            <label className="check chip">
              <input type="checkbox" checked={filters.onlyFavs} onChange={(e) => set('onlyFavs', e.target.checked)} />
              Solo favoritos
            </label>
          )}
        </div>
      </div>

      <div className="list-head">
        <label className="check">
          <input type="checkbox" checked={allVisibleChecked} onChange={toggleAll} disabled={!visible.length} />
          {loading && !repos.length ? (
            'Cargando repos…'
          ) : (
            <span>
              <b className="count">{visible.length}</b> de {repos.length} repos
            </span>
          )}
        </label>
        {/* El lector de pantalla anuncia cuántos repos quedan al filtrar o buscar. */}
        <span className="sr-only" aria-live="polite">
          {loading && !repos.length ? '' : `${visible.length} de ${repos.length} repos`}
        </span>
        {repos.length > 0 && (
          <span className={`freshness ${loading ? 'busy' : ''}`} role="status">
            {loading ? (
              <>
                <RefreshCw size={13} className="spin" /> Actualizando…
              </>
            ) : savedAt ? (
              <>
                <Clock size={13} /> Actualizada {haceCuanto(new Date(savedAt).toISOString())}
              </>
            ) : null}
          </span>
        )}
        {ciPending > 0 && !loading && (
          <span className="muted small ci-pending">
            <LoaderCircle size={13} className="spin" aria-hidden="true" /> Revisando Actions ({ciPending})
          </span>
        )}
        {visible.length > 0 && (
          <button
            className="small-btn"
            onClick={() => download(fileName('repos', repos[0]?.owner.login ?? 'github'), reposCsv(visible, ci))}
            title="Descargar los repos que se ven, con los filtros aplicados"
          >
            <Download size={14} /> Exportar CSV
          </button>
        )}
      </div>

      <ul className={`repo-grid ${compact ? 'compact' : ''}`}>
        {loading &&
          !repos.length &&
          Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="repo-card skeleton" aria-hidden="true">
              <span className="sk sk-title" />
              <span className="sk sk-line" />
              <span className="sk sk-line short" />
            </li>
          ))}
        {visible.map((r, i) => (
          <li
            key={r.id}
            className={`repo-card ${favs.has(r.id) ? 'fav' : ''} ${r.id === selectedId ? 'selected' : ''} ${checked.has(r.id) ? 'checked' : ''} ${r.archived ? 'is-archived' : ''}`}
            style={{ '--lang': languageColor(r.language), '--i': Math.min(i, 12) } as React.CSSProperties}
          >
            <input
              type="checkbox"
              className="card-check"
              checked={checked.has(r.id)}
              onChange={() => toggle(r.id)}
              aria-label={`Seleccionar ${r.name}`}
            />
            <button
              className={`fav-btn ${favs.has(r.id) ? 'on' : ''}`}
              onClick={() => onToggleFav(r.id)}
              aria-pressed={favs.has(r.id)}
              aria-label={`Favorito: ${r.name}`}
              title={favs.has(r.id) ? 'Quitar de favoritos' : 'Fijar arriba como favorito'}
            >
              <Pin size={16} aria-hidden="true" />
            </button>
            <button
              className="repo-row"
              data-repo-id={r.id}
              aria-current={r.id === selectedId ? 'true' : undefined}
              onClick={() => onSelect(r.id)}
            >
              <span className="repo-name">{r.name}</span>
              <span className="badges">
                {r.private && (
                  <span className="badge private">
                    <Lock size={12} /> Privado
                  </span>
                )}
                {r.has_pages && (
                  <span className="badge site">
                    <Globe size={12} /> Sitio
                  </span>
                )}
                {r.archived && (
                  <span className="badge warn">
                    <Archive size={12} /> Archivado
                  </span>
                )}
                {r.fork && (
                  <span className="badge">
                    <GitFork size={12} /> Fork
                  </span>
                )}
                {!r.archived && <CiBadge info={ci[r.id]} />}
              </span>
              <span className="repo-desc">{r.description || <i className="muted">Sin descripción</i>}</span>
              {!!r.topics?.length && (
                <span className="card-topics">
                  {r.topics.slice(0, 4).map((t) => (
                    <span key={t} className={`topic ${t === filters.topic ? 'active' : ''}`}>
                      {t}
                    </span>
                  ))}
                  {r.topics.length > 4 && <span className="topic more">+{r.topics.length - 4}</span>}
                </span>
              )}
              <span className="repo-meta">
                <span className="lang">
                  <span className="dot" />
                  {r.language ?? 'Sin lenguaje'}
                </span>
                <span>
                  <Clock size={13} /> {haceCuanto(r.pushed_at)}
                </span>
                {r.stargazers_count > 0 && (
                  <span className="stars">
                    <Star size={13} /> {r.stargazers_count}
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
        {!loading && repos.length > 0 && visible.length === 0 && (
          <li className="empty">
            <Search size={28} />
            <span>Ningún repo coincide con los filtros.</span>
          </li>
        )}
      </ul>
    </>
  )
}

/** Etiquetas usadas en tus repos con cuántos repos usan cada una, de más a menos usada. */
export function allTopics(repos: Repo[]): [string, number][] {
  const count = new Map<string, number>()
  for (const r of repos) for (const t of r.topics ?? []) count.set(t, (count.get(t) ?? 0) + 1)
  return [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

/** Insignia con la última ejecución de GitHub Actions. No muestra nada si el repo no usa Actions. */
function CiBadge({ info }: { info: CiMap[number] | undefined }) {
  if (!info || info.kind === 'none' || info.kind === 'other') return null
  const Icon = info.kind === 'ok' ? CircleCheck : info.kind === 'fail' ? CircleX : LoaderCircle
  const text = info.kind === 'ok' ? 'CI' : `CI ${CI_LABEL[info.kind].toLowerCase()}`
  return (
    <span className={`badge ci-badge ${info.kind}`} title={`GitHub Actions: ${CI_LABEL[info.kind].toLowerCase()}${info.name ? ` (${info.name})` : ''}`}>
      <Icon size={12} className={info.kind === 'running' ? 'spin' : ''} aria-hidden="true" />
      <span aria-hidden="true">{text}</span>
      <span className="sr-only">GitHub Actions: {CI_LABEL[info.kind].toLowerCase()}</span>
    </span>
  )
}
