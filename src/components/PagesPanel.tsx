import { useCallback, useEffect, useState } from 'react'
import { CircleCheck, CircleX, ExternalLink, Globe, LoaderCircle, Power, RefreshCw, Settings2 } from 'lucide-react'
import type { GitHub, PagesSite, PagesSource, Repo } from '../github'
import ConfirmDialog from './ConfirmDialog'

interface Props {
  gh: GitHub
  repo: Repo
  /** Ramas del repo, para elegir desde dónde publicar. null mientras cargan. */
  branches: string[] | null
  /** Avisa si el repo quedó con o sin Pages, para actualizar la tarjeta de la lista. */
  onChanged: (hasPages: boolean) => void
}

type State = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ok'; site: PagesSite | null }

type Pending = { action: 'enable' | 'update'; source: PagesSource } | { action: 'disable' }

export default function PagesPanel({ gh, repo, branches, onChanged }: Props) {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [editing, setEditing] = useState(false)
  const [source, setSource] = useState<PagesSource>({ type: 'branch', branch: repo.default_branch, path: '/' })
  const [pending, setPending] = useState<Pending | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const load = useCallback(async () => {
    setState({ kind: 'loading' })
    try {
      const site = await gh.getPages(repo)
      setState({ kind: 'ok', site })
      if (site?.build_type === 'workflow') setSource({ type: 'workflow' })
      else if (site?.source) setSource({ type: 'branch', branch: site.source.branch, path: site.source.path })
    } catch (err) {
      setState({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gh, repo.full_name])

  useEffect(() => {
    load()
  }, [load])

  async function apply() {
    if (!pending) return
    setBusy(true)
    setMessage(null)
    try {
      if (pending.action === 'enable') {
        await gh.enablePages(repo, pending.source)
        onChanged(true)
        setMessage({ kind: 'ok', text: 'Pages activado. GitHub tarda uno o dos minutos en publicar el sitio.' })
      } else if (pending.action === 'update') {
        await gh.updatePagesSource(repo, pending.source)
        setMessage({ kind: 'ok', text: 'Origen actualizado. El sitio se vuelve a publicar en uno o dos minutos.' })
      } else {
        await gh.disablePages(repo)
        onChanged(false)
        setMessage({ kind: 'ok', text: 'Pages desactivado. El sitio deja de estar en línea.' })
      }
      setEditing(false)
      await load()
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(false)
      setPending(null)
    }
  }

  const site = state.kind === 'ok' ? state.site : null
  const url = site?.html_url ?? expectedUrl(repo)

  return (
    <section className="pages-panel" aria-labelledby="pages-title">
      <div className="pages-head">
        <h3 id="pages-title">
          <Globe size={16} /> Sitio web (GitHub Pages)
        </h3>
        <button className="icon-btn" onClick={load} disabled={state.kind === 'loading'} aria-label="Actualizar estado de Pages" title="Actualizar estado">
          <RefreshCw size={16} className={state.kind === 'loading' ? 'spin' : ''} />
        </button>
      </div>

      {message && <p className={message.kind === 'ok' ? 'success small' : 'error small'}>{message.text}</p>}

      {state.kind === 'loading' && <p className="muted small">Consultando Pages…</p>}
      {state.kind === 'error' && <p className="error small">{state.message}</p>}

      {state.kind === 'ok' && site && (
        <div className="pages-card on">
          <div className="pages-status">
            <StatusPill status={site.status} />
            <span className="muted small">{describeSource(site)}</span>
          </div>
          {site.html_url && (
            <a className="site-link" href={site.html_url} target="_blank" rel="noreferrer">
              <span className="site-url">{site.html_url.replace(/^https?:\/\//, '')}</span>
              <span className="site-open">
                Abrir sitio <ExternalLink size={14} />
              </span>
            </a>
          )}
          {!repo.archived && !editing && (
            <div className="row">
              <button onClick={() => setEditing(true)}>
                <Settings2 size={16} /> Cambiar origen
              </button>
              <button className="danger-outline" onClick={() => setPending({ action: 'disable' })}>
                <Power size={16} /> Desactivar
              </button>
            </div>
          )}
        </div>
      )}

      {state.kind === 'ok' && !site && (
        <div className="pages-card off">
          <p className="muted small">Este repo no tiene un sitio publicado.</p>
        </div>
      )}

      {state.kind === 'ok' && repo.archived && (
        <p className="muted small">El repo está archivado: desarchivalo para poder cambiar Pages.</p>
      )}

      {state.kind === 'ok' && !repo.archived && (editing || !site) && (
        <form
          className="pages-form"
          onSubmit={(e) => {
            e.preventDefault()
            setPending({ action: site ? 'update' : 'enable', source })
          }}
        >
          <label>
            Publicar desde
            <select
              value={source.type}
              onChange={(e) =>
                setSource(
                  e.target.value === 'workflow'
                    ? { type: 'workflow' }
                    : { type: 'branch', branch: repo.default_branch, path: '/' },
                )
              }
            >
              <option value="branch">Una rama del repo</option>
              <option value="workflow">GitHub Actions (el repo tiene su propio workflow)</option>
            </select>
          </label>
          {source.type === 'branch' && (
            <div className="pages-form-row">
              <label>
                Rama
                <select value={source.branch} onChange={(e) => setSource({ ...source, branch: e.target.value })}>
                  {(branches ?? [repo.default_branch]).map((b) => (
                    <option key={b}>{b}</option>
                  ))}
                </select>
              </label>
              <label>
                Carpeta
                <select
                  value={source.path}
                  onChange={(e) => setSource({ ...source, path: e.target.value as '/' | '/docs' })}
                >
                  <option value="/">/ (raíz)</option>
                  <option value="/docs">/docs</option>
                </select>
              </label>
            </div>
          )}
          <div className="row">
            <button type="submit" className="primary">
              <Globe size={16} /> {site ? 'Guardar origen' : 'Activar Pages'}
            </button>
            {site && (
              <button type="button" onClick={() => setEditing(false)}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      )}

      {pending && (
        <ConfirmDialog
          title={
            pending.action === 'enable'
              ? `Activar Pages en ${repo.name}`
              : pending.action === 'update'
                ? `Cambiar el origen de Pages en ${repo.name}`
                : `Desactivar Pages en ${repo.name}`
          }
          confirmLabel={pending.action === 'disable' ? 'Desactivar' : 'Confirmar'}
          danger={pending.action === 'disable'}
          busy={busy}
          onConfirm={apply}
          onCancel={() => setPending(null)}
        >
          {pending.action === 'disable' ? (
            <p>
              El sitio <b>{url}</b> deja de estar en línea. El código no se toca y podés volver a activarlo cuando quieras.
            </p>
          ) : (
            <ul>
              <li>Publicar desde: {describePending(pending.source)}</li>
              <li>
                Dirección: <b>{url}</b>
              </li>
              {repo.private && <li>El repo es privado: GitHub solo permite Pages en repos privados con un plan pago.</li>}
              {pending.source.type === 'workflow' && (
                <li>El repo tiene que tener un workflow que publique en Pages; si no, el sitio no se va a actualizar.</li>
              )}
            </ul>
          )}
        </ConfirmDialog>
      )}
    </section>
  )
}

function StatusPill({ status }: { status: PagesSite['status'] }) {
  if (status === 'built')
    return (
      <span className="pill ok">
        <CircleCheck size={14} /> Publicado
      </span>
    )
  if (status === 'building')
    return (
      <span className="pill running">
        <LoaderCircle size={14} className="spin" /> Publicando…
      </span>
    )
  if (status === 'errored')
    return (
      <span className="pill fail">
        <CircleX size={14} /> Falló la publicación
      </span>
    )
  return (
    <span className="pill">
      <LoaderCircle size={14} /> Pendiente
    </span>
  )
}

function describeSource(site: PagesSite): string {
  if (site.build_type === 'workflow') return 'Desde GitHub Actions'
  if (site.source) return `Desde la rama ${site.source.branch}, carpeta ${site.source.path}`
  return ''
}

function describePending(s: PagesSource): string {
  return s.type === 'workflow' ? 'GitHub Actions' : `rama ${s.branch}, carpeta ${s.path}`
}

/** Dirección que GitHub le asigna al sitio de un repo. */
function expectedUrl(repo: Repo): string {
  const owner = repo.owner.login.toLowerCase()
  return repo.name.toLowerCase() === `${owner}.github.io` ? `https://${owner}.github.io/` : `https://${owner}.github.io/${repo.name}/`
}
