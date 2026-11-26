import { useMemo } from 'react'
import type { Repo } from '../github'
import { diasDesde, haceCuanto } from '../util'

export interface Filters {
  text: string
  language: string
  visibility: 'all' | 'public' | 'private'
  status: 'active' | 'archived' | 'all'
  forks: boolean
  inactive: 0 | 180 | 365 | 730
  sort: 'pushed' | 'name' | 'stars'
}

export const DEFAULT_FILTERS: Filters = {
  text: '',
  language: '',
  visibility: 'all',
  status: 'active',
  forks: true,
  inactive: 0,
  sort: 'pushed',
}

export function applyFilters(repos: Repo[], f: Filters): Repo[] {
  const q = f.text.trim().toLowerCase()
  const out = repos.filter((r) => {
    if (q && !r.name.toLowerCase().includes(q) && !(r.description ?? '').toLowerCase().includes(q)) return false
    if (f.language && (r.language ?? 'Sin lenguaje') !== f.language) return false
    if (f.visibility === 'public' && r.private) return false
    if (f.visibility === 'private' && !r.private) return false
    if (f.status === 'active' && r.archived) return false
    if (f.status === 'archived' && !r.archived) return false
    if (!f.forks && r.fork) return false
    if (f.inactive && diasDesde(r.pushed_at) < f.inactive) return false
    return true
  })
  out.sort((a, b) => {
    if (f.sort === 'name') return a.name.localeCompare(b.name)
    if (f.sort === 'stars') return b.stargazers_count - a.stargazers_count
    return (b.pushed_at ?? '').localeCompare(a.pushed_at ?? '')
  })
  return out
}

interface Props {
  repos: Repo[]
  visible: Repo[]
  loading: boolean
  filters: Filters
  onFilters: (f: Filters) => void
  selectedId: number | null
  onSelect: (id: number) => void
  checked: Set<number>
  onChecked: (s: Set<number>) => void
}

export default function RepoList({ repos, visible, loading, filters, onFilters, selectedId, onSelect, checked, onChecked }: Props) {
  const languages = useMemo(
    () => [...new Set(repos.map((r) => r.language ?? 'Sin lenguaje'))].sort((a, b) => a.localeCompare(b)),
    [repos],
  )
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
        <input
          type="search"
          placeholder="Buscar por nombre o descripción"
          value={filters.text}
          onChange={(e) => set('text', e.target.value)}
          aria-label="Buscar"
        />
        <div className="filter-row">
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
          <select value={filters.language} onChange={(e) => set('language', e.target.value)} aria-label="Lenguaje">
            <option value="">Todos los lenguajes</option>
            {languages.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
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
          <select value={filters.sort} onChange={(e) => set('sort', e.target.value as Filters['sort'])} aria-label="Orden">
            <option value="pushed">Último push</option>
            <option value="name">Nombre</option>
            <option value="stars">Estrellas</option>
          </select>
          <label className="check">
            <input type="checkbox" checked={filters.forks} onChange={(e) => set('forks', e.target.checked)} />
            Incluir forks
          </label>
        </div>
      </div>

      <div className="list-head">
        <label className="check">
          <input type="checkbox" checked={allVisibleChecked} onChange={toggleAll} disabled={!visible.length} />
          {loading && !repos.length ? 'Cargando repos…' : `${visible.length} de ${repos.length} repos`}
        </label>
      </div>

      <ul className="repo-list">
        {visible.map((r) => (
          <li key={r.id} className={r.id === selectedId ? 'selected' : ''}>
            <input
              type="checkbox"
              checked={checked.has(r.id)}
              onChange={() => toggle(r.id)}
              aria-label={`Seleccionar ${r.name}`}
            />
            <button className="repo-row" onClick={() => onSelect(r.id)}>
              <span className="repo-name">
                {r.name}
                {r.private && <span className="badge">Privado</span>}
                {r.archived && <span className="badge warn">Archivado</span>}
                {r.fork && <span className="badge">Fork</span>}
              </span>
              {r.description && <span className="repo-desc">{r.description}</span>}
              <span className="repo-meta">
                {r.language && <span>{r.language}</span>}
                <span>Push {haceCuanto(r.pushed_at)}</span>
                {r.stargazers_count > 0 && <span>★ {r.stargazers_count}</span>}
              </span>
            </button>
          </li>
        ))}
        {!loading && repos.length > 0 && visible.length === 0 && <li className="empty muted">Ningún repo coincide con los filtros.</li>}
      </ul>
    </>
  )
}
