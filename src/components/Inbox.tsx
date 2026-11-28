import { useCallback, useEffect, useMemo, useState } from 'react'
import { CircleDot, Download, ExternalLink, GitPullRequest, GitPullRequestDraft, Inbox as InboxIcon, MessageSquare, RefreshCw, Search } from 'lucide-react'
import type { GitHub, Repo, SearchItem } from '../github'
import { haceCuanto } from '../util'
import { download, fileName, pendientesCsv } from '../csv'

interface Props {
  gh: GitHub
  login: string
  /** Cuentas cuyos repos se miran (la tuya y/o organizaciones). */
  owners: string[]
  repos: Repo[]
  online: boolean
  onOpenRepo: (id: number) => void
}

type Kind = 'all' | 'pr' | 'issue'
type Author = 'all' | 'me' | 'others'
type Sort = 'updated' | 'oldest'
interface Item extends SearchItem {
  kind: 'pr' | 'issue'
  repoName: string
}

type Load = { state: 'loading' } | { state: 'ok'; items: Item[]; truncated: boolean } | { state: 'error'; message: string }

/** Todos los PRs e issues abiertos de tus repos en una sola lista. */
export default function Inbox({ gh, login, owners, repos, online, onOpenRepo }: Props) {
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [kind, setKind] = useState<Kind>('all')
  const [repo, setRepo] = useState('')
  const [author, setAuthor] = useState<Author>('all')
  const [sort, setSort] = useState<Sort>('updated')
  const [text, setText] = useState('')

  const fetchAll = useCallback(async () => {
    setRefreshing(true)
    setRefreshError(null)
    try {
      const [prs, issues] = await Promise.all([gh.searchAllOpen(owners, 'pr'), gh.searchAllOpen(owners, 'issue')])
      const tag = (kind: 'pr' | 'issue') => (i: SearchItem) => ({ ...i, kind, repoName: i.repository_url.split('/').pop() ?? '' })
      setLoad({
        state: 'ok',
        items: [...prs.items.map(tag('pr')), ...issues.items.map(tag('issue'))],
        truncated: prs.total_count > prs.items.length || issues.total_count > issues.items.length,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      // Si ya teníamos datos, los dejamos a la vista y solo avisamos.
      setLoad((prev) => (prev.state === 'ok' ? prev : { state: 'error', message }))
      setRefreshError(message)
    } finally {
      setRefreshing(false)
    }
  }, [gh, owners])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const items = load.state === 'ok' ? load.items : []
  const counts = useMemo(() => {
    const byRepo = new Map<string, number>()
    for (const i of items) byRepo.set(i.repoName, (byRepo.get(i.repoName) ?? 0) + 1)
    return {
      pr: items.filter((i) => i.kind === 'pr').length,
      issue: items.filter((i) => i.kind === 'issue').length,
      others: items.filter((i) => i.user && i.user.login !== login).length,
      repos: [...byRepo].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
    }
  }, [items, login])

  const visible = useMemo(() => {
    const q = text.trim().toLowerCase()
    const out = items.filter((i) => {
      if (kind !== 'all' && i.kind !== kind) return false
      if (repo && i.repoName !== repo) return false
      if (author === 'me' && i.user?.login !== login) return false
      if (author === 'others' && (!i.user || i.user.login === login)) return false
      if (q && !i.title.toLowerCase().includes(q) && !i.repoName.toLowerCase().includes(q) && !`#${i.number}`.includes(q)) return false
      return true
    })
    out.sort((a, b) =>
      sort === 'oldest' ? (a.created_at ?? a.updated_at).localeCompare(b.created_at ?? b.updated_at) : b.updated_at.localeCompare(a.updated_at),
    )
    return out
  }, [items, kind, repo, author, sort, text, login])

  const repoId = (name: string) => repos.find((r) => r.name === name)?.id

  return (
    <div className="inbox">
      <div className="inbox-head">
        <div className="seg" role="group" aria-label="Tipo">
          <button className={kind === 'all' ? 'on' : ''} aria-pressed={kind === 'all'} onClick={() => setKind('all')}>
            Todo <span className="seg-count">{items.length}</span>
          </button>
          <button className={kind === 'pr' ? 'on' : ''} aria-pressed={kind === 'pr'} onClick={() => setKind('pr')}>
            <GitPullRequest size={15} /> PRs <span className="seg-count">{counts.pr}</span>
          </button>
          <button className={kind === 'issue' ? 'on' : ''} aria-pressed={kind === 'issue'} onClick={() => setKind('issue')}>
            <CircleDot size={15} /> Issues <span className="seg-count">{counts.issue}</span>
          </button>
        </div>
        <div className="inbox-actions">
          {visible.length > 0 && (
            <button className="small-btn" onClick={() => download(fileName('pendientes', login), pendientesCsv(visible))} title="Descargar lo que se ve, con los filtros aplicados">
              <Download size={14} />
              <span>
                <span className="hide-sm">Exportar </span>CSV
              </span>
            </button>
          )}
          <button className="icon-btn" onClick={fetchAll} disabled={refreshing || !online} title="Actualizar" aria-label="Actualizar pendientes">
            <RefreshCw size={18} className={refreshing ? 'spin' : ''} />
          </button>
        </div>
      </div>

      <div className="filters inbox-filters">
        <div className="search">
          <Search size={18} aria-hidden="true" />
          <input type="search" placeholder="Buscar por título, repo o número" value={text} onChange={(e) => setText(e.target.value)} aria-label="Buscar pendientes" aria-keyshortcuts="/" />
          <kbd className="search-kbd" aria-hidden="true" title="Atajos: / para buscar, flechas para moverte por la lista">/</kbd>
        </div>
        <div className="filter-row">
          <select value={repo} onChange={(e) => setRepo(e.target.value)} aria-label="Repo">
            <option value="">Todos los repos</option>
            {counts.repos.map(([name, n]) => (
              <option key={name} value={name}>
                {name} ({n})
              </option>
            ))}
          </select>
          <select value={author} onChange={(e) => setAuthor(e.target.value as Author)} aria-label="Autor">
            <option value="all">Cualquier autor</option>
            <option value="me">Abiertos por mí</option>
            <option value="others">De otras personas ({counts.others})</option>
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Orden">
            <option value="updated">Actividad más reciente</option>
            <option value="oldest">Más viejos primero</option>
          </select>
        </div>
      </div>

      {load.state === 'loading' && (
        <ul className="inbox-list" aria-hidden="true">
          {Array.from({ length: 5 }, (_, i) => (
            <li key={i} className="inbox-item skeleton">
              <span className="sk sk-title" />
              <span className="sk sk-line short" />
            </li>
          ))}
        </ul>
      )}
      {load.state === 'error' && <p className="error banner" role="alert">{online ? load.message : 'Sin conexión: los PRs e issues se ven cuando vuelve internet.'}</p>}

      {load.state === 'ok' && (
        <>
          {refreshError && <p className="error small" role="alert">No se pudo actualizar: {refreshError} Se ve lo último que se cargó.</p>}
          {items.length === 0 ? (
            <div className="empty-state">
              <InboxIcon size={32} />
              <p>No tenés PRs ni issues abiertos. Todo al día.</p>
            </div>
          ) : visible.length === 0 ? (
            <div className="empty-state">
              <Search size={28} />
              <p>Nada coincide con los filtros.</p>
            </div>
          ) : (
            <ul className="inbox-list">
              {visible.map((i) => {
                const id = repoId(i.repoName)
                const mine = i.user?.login === login
                return (
                  <li key={i.id} className={`inbox-item ${i.kind}`}>
                    <span className={`inbox-icon ${i.kind}${i.draft ? ' draft' : ''}`} title={i.kind === 'pr' ? (i.draft ? 'PR borrador' : 'Pull request') : 'Issue'}>
                      {i.kind === 'pr' ? i.draft ? <GitPullRequestDraft size={18} /> : <GitPullRequest size={18} /> : <CircleDot size={18} />}
                    </span>
                    <div className="inbox-main">
                      <a className="inbox-title" href={i.html_url} target="_blank" rel="noreferrer">
                        {i.title} <ExternalLink size={13} aria-hidden="true" />
                      </a>
                      <div className="inbox-meta">
                        {id ? (
                          <button className="repo-link" onClick={() => onOpenRepo(id)} title={`Abrir ${i.repoName}`}>
                            {i.repoName}#{i.number}
                          </button>
                        ) : (
                          <span>
                            {i.repoName}#{i.number}
                          </span>
                        )}
                        {i.draft && <span className="badge">Borrador</span>}
                        {i.user && (
                          <span className="inbox-author">
                            <img src={i.user.avatar_url} alt="" width={16} height={16} loading="lazy" />
                            {mine ? 'vos' : i.user.login}
                          </span>
                        )}
                        <span title={`Creado ${haceCuanto(i.created_at ?? i.updated_at)}`}>actualizado {haceCuanto(i.updated_at)}</span>
                        {!!i.comments && (
                          <span className="inbox-comments" title={`${i.comments} comentario${i.comments === 1 ? '' : 's'}`}>
                            <MessageSquare size={13} /> {i.comments}
                          </span>
                        )}
                      </div>
                      {!!i.labels?.length && (
                        <div className="inbox-labels">
                          {i.labels.map((l) => (
                            <span key={l.name} className="label" style={{ '--label': `#${/^[0-9a-f]{6}$/i.test(l.color) ? l.color : '8b84b0'}` } as React.CSSProperties}>
                              {l.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          {load.truncated && <p className="muted small">Se muestran los 300 más recientes de cada tipo.</p>}
        </>
      )}
    </div>
  )
}
