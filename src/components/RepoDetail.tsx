import { useEffect, useState } from 'react'
import type { Commit, Branch, GitHub, Issue, PullRequest, Repo, RepoChanges, WorkflowRun } from '../github'
import {
  Archive,
  ArchiveRestore,
  CircleCheck,
  CircleDot,
  CircleX,
  BookOpen,
  ExternalLink,
  GitCommitHorizontal,
  GitBranch,
  GitPullRequest,
  LoaderCircle,
  Lock,
  Pencil,
  Zap,
  X,
} from 'lucide-react'
import { haceCuanto } from '../util'
import { languageColor } from '../languages'
import ConfirmDialog from './ConfirmDialog'
import PagesPanel from './PagesPanel'
import Readme from './Readme'

interface Props {
  gh: GitHub
  repo: Repo
  onUpdated: (r: Repo) => void
  onClose: () => void
}

type Section<T> = { state: 'loading' } | { state: 'ok'; data: T } | { state: 'error'; message: string }

function useSection<T>(load: () => Promise<T>, deps: unknown[]): Section<T> {
  const [s, setS] = useState<Section<T>>({ state: 'loading' })
  useEffect(() => {
    let alive = true
    setS({ state: 'loading' })
    load().then(
      (data) => alive && setS({ state: 'ok', data }),
      (err) => alive && setS({ state: 'error', message: err instanceof Error ? err.message : String(err) }),
    )
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return s
}

export default function RepoDetail({ gh, repo, onUpdated, onClose }: Props) {
  const key = repo.full_name
  const branches = useSection<Branch[]>(() => gh.listBranches(repo), [key])
  const pulls = useSection<PullRequest[]>(() => gh.listPulls(repo), [key])
  const issues = useSection<Issue[]>(() => gh.listIssues(repo), [key])
  const run = useSection<WorkflowRun | null>(() => gh.latestRun(repo), [key])
  const commits = useSection<Commit[]>(() => gh.listCommits(repo), [key])
  const readme = useSection<string | null>(() => gh.getReadmeHtml(repo), [key])

  const [form, setForm] = useState(() => formFrom(repo))
  const [pending, setPending] = useState<{ title: string; changes: RepoChanges; danger?: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => setForm(formFrom(repo)), [repo])

  const changes = diff(repo, form)
  const dirty = Object.keys(changes).length > 0

  async function apply() {
    if (!pending) return
    setBusy(true)
    setMessage(null)
    try {
      const updated = await gh.updateRepo(repo, pending.changes)
      onUpdated(updated)
      setMessage({ kind: 'ok', text: 'Cambios guardados.' })
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(false)
      setPending(null)
    }
  }

  return (
    <div className="detail" style={{ '--lang': languageColor(repo.language) } as React.CSSProperties}>
      <div className="detail-hero">
        <div>
          <p className="eyebrow">
            <span className="dot" /> {repo.language ?? 'Sin lenguaje'}
            {repo.private && (
              <span className="badge private">
                <Lock size={12} /> Privado
              </span>
            )}
            {repo.archived && (
              <span className="badge warn">
                <Archive size={12} /> Archivado
              </span>
            )}
          </p>
          <h2>
            <a href={repo.html_url} target="_blank" rel="noreferrer">
              {repo.name} <ExternalLink size={16} />
            </a>
          </h2>
          {repo.description && <p className="detail-desc">{repo.description}</p>}
          <p className="muted small">
            Rama principal <code>{repo.default_branch}</code> · último push {haceCuanto(repo.pushed_at)}
          </p>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Cerrar detalle">
          <X size={18} />
        </button>
      </div>

      {message && <p className={message.kind === 'ok' ? 'success' : 'error'}>{message.text}</p>}

      <div className="stats">
        <Stat label="Ramas" tone="violet" icon={<GitBranch size={18} />} s={branches} count={(d) => d.length} />
        <Stat label="PRs abiertos" tone="blue" icon={<GitPullRequest size={18} />} s={pulls} count={(d) => d.length} />
        <Stat label="Issues abiertos" tone="pink" icon={<CircleDot size={18} />} s={issues} count={(d) => d.length} />
        <div className="stat tone-green">
          <span className="stat-icon">
            <Zap size={18} />
          </span>
          <span className="stat-label">Último CI</span>
          <CiStatus s={run} />
        </div>
      </div>

      <PagesPanel
        gh={gh}
        repo={repo}
        branches={branches.state === 'ok' ? branches.data.map((b) => b.name) : null}
        onChanged={(has_pages) => onUpdated({ ...repo, has_pages })}
      />

      <details open>
        <summary>
          <GitCommitHorizontal size={16} /> Últimos commits
        </summary>
        <SectionList
          s={commits}
          empty="Este repo todavía no tiene commits."
          render={(c) => (
            <li key={c.sha} className="commit">
              {c.author ? (
                <img className="commit-avatar" src={c.author.avatar_url} alt="" width={24} height={24} loading="lazy" />
              ) : (
                <span className="commit-avatar placeholder" aria-hidden="true" />
              )}
              <span className="commit-body">
                <a href={c.html_url} target="_blank" rel="noreferrer" className="commit-msg">
                  {c.commit.message.split('\n')[0]}
                </a>
                <span className="muted small">
                  {c.author?.login ?? c.commit.author?.name ?? 'Desconocido'} · {haceCuanto(c.commit.author?.date ?? null)} ·{' '}
                  <code>{c.sha.slice(0, 7)}</code>
                </span>
              </span>
            </li>
          )}
        />
      </details>

      <details open>
        <summary>
          <BookOpen size={16} /> README
        </summary>
        {readme.state === 'loading' && <p className="muted small">Cargando…</p>}
        {readme.state === 'error' && <p className="error small">{readme.message}</p>}
        {readme.state === 'ok' &&
          (readme.data ? <Readme html={readme.data} repo={repo} /> : <p className="muted small">Este repo no tiene README.</p>)}
      </details>

      <details>
        <summary>
          <GitPullRequest size={16} /> Pull requests abiertos
        </summary>
        <SectionList
          s={pulls}
          empty="No hay PRs abiertos."
          render={(p) => (
            <li key={p.number}>
              <a href={p.html_url} target="_blank" rel="noreferrer">
                #{p.number} {p.title}
              </a>
              <span className="muted small">
                {' '}
                {p.draft ? 'borrador · ' : ''}
                {p.head.ref} · {p.user?.login}
              </span>
            </li>
          )}
        />
      </details>

      <details>
        <summary>
          <CircleDot size={16} /> Issues abiertos
        </summary>
        <SectionList
          s={issues}
          empty="No hay issues abiertos."
          render={(i) => (
            <li key={i.number}>
              <a href={i.html_url} target="_blank" rel="noreferrer">
                #{i.number} {i.title}
              </a>
            </li>
          )}
        />
      </details>

      <details>
        <summary>
          <GitBranch size={16} /> Ramas
        </summary>
        <SectionList
          s={branches}
          empty="Sin ramas."
          render={(b) => (
            <li key={b.name}>
              <code>{b.name}</code>
              {b.name === repo.default_branch && <span className="badge">principal</span>}
              {b.protected && <span className="badge">protegida</span>}
            </li>
          )}
        />
      </details>

      <h3>
        <Pencil size={16} /> Editar
      </h3>
      {repo.archived ? (
        <p className="muted">Este repo está archivado y es de solo lectura. Desarchivalo para poder editarlo.</p>
      ) : (
        <form
          className="edit-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (dirty) setPending({ title: `Guardar cambios en ${repo.name}`, changes })
          }}
        >
          <label>
            Nombre
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label>
            Descripción
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
          <label>
            Sitio web
            <input
              type="url"
              placeholder="https://…"
              value={form.homepage}
              onChange={(e) => setForm({ ...form, homepage: e.target.value })}
            />
          </label>
          <label>
            Visibilidad
            <select
              value={form.private ? 'private' : 'public'}
              onChange={(e) => setForm({ ...form, private: e.target.value === 'private' })}
            >
              <option value="public">Público</option>
              <option value="private">Privado</option>
            </select>
          </label>
          <div className="row">
            <button type="submit" className="primary" disabled={!dirty}>
              Guardar
            </button>
            <button type="button" disabled={!dirty} onClick={() => setForm(formFrom(repo))}>
              Descartar
            </button>
          </div>
        </form>
      )}

      <div className="row archive-row">
        {repo.archived ? (
          <button onClick={() => setPending({ title: `Desarchivar ${repo.name}`, changes: { archived: false } })}>
            <ArchiveRestore size={16} /> Desarchivar
          </button>
        ) : (
          <button
            className="danger-outline"
            onClick={() => setPending({ title: `Archivar ${repo.name}`, changes: { archived: true }, danger: true })}
          >
            <Archive size={16} /> Archivar
          </button>
        )}
      </div>

      {pending && (
        <ConfirmDialog
          title={pending.title}
          confirmLabel="Confirmar"
          danger={pending.danger}
          busy={busy}
          onConfirm={apply}
          onCancel={() => setPending(null)}
        >
          <ChangeSummary repo={repo} changes={pending.changes} />
        </ConfirmDialog>
      )}
    </div>
  )
}

function formFrom(r: Repo) {
  return { name: r.name, description: r.description ?? '', homepage: r.homepage ?? '', private: r.private }
}

function diff(r: Repo, f: ReturnType<typeof formFrom>): RepoChanges {
  const c: RepoChanges = {}
  if (f.name.trim() !== r.name) c.name = f.name.trim()
  if (f.description !== (r.description ?? '')) c.description = f.description
  if (f.homepage !== (r.homepage ?? '')) c.homepage = f.homepage
  if (f.private !== r.private) c.private = f.private
  return c
}

function ChangeSummary({ repo, changes }: { repo: Repo; changes: RepoChanges }) {
  return (
    <ul>
      {changes.name !== undefined && (
        <li>
          Nombre: <code>{repo.name}</code> → <code>{changes.name}</code>. La dirección del repo cambia; GitHub redirige la
          vieja, pero conviene actualizar tus clones con <code>git remote set-url</code>.
        </li>
      )}
      {changes.description !== undefined && <li>Descripción: “{changes.description || '(vacía)'}”</li>}
      {changes.homepage !== undefined && <li>Sitio web: {changes.homepage || '(vacío)'}</li>}
      {changes.private !== undefined && (
        <li>
          Visibilidad: {changes.private ? 'privado' : 'público'}.
          {changes.private
            ? ' Se pierden las estrellas y watchers de otras personas, y GitHub Pages puede dejar de publicarse según tu plan.'
            : ' Cualquiera va a poder ver el código y todo su historial.'}
        </li>
      )}
      {changes.archived === true && <li>El repo queda de solo lectura. Se puede desarchivar cuando quieras.</li>}
      {changes.archived === false && <li>El repo vuelve a aceptar cambios.</li>}
    </ul>
  )
}

function Stat<T>({
  label,
  s,
  count,
  icon,
  tone,
}: {
  label: string
  s: Section<T>
  count: (d: T) => number
  icon: React.ReactNode
  tone: string
}) {
  return (
    <div className={`stat tone-${tone}`}>
      <span className="stat-icon">{icon}</span>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{s.state === 'ok' ? count(s.data) : s.state === 'loading' ? '…' : '—'}</span>
    </div>
  )
}

function CiStatus({ s }: { s: Section<WorkflowRun | null> }) {
  if (s.state === 'loading') return <span className="stat-value">…</span>
  if (s.state === 'error') return <span className="stat-value" title={s.message}>—</span>
  const r = s.data
  if (!r) return <span className="stat-value muted small">Sin CI</span>
  const running = r.status !== 'completed'
  const label = running ? 'En curso' : r.conclusion === 'success' ? 'Pasó' : r.conclusion === 'failure' ? 'Falló' : (r.conclusion ?? '—')
  const cls = running ? 'running' : r.conclusion === 'success' ? 'ok' : r.conclusion === 'failure' ? 'fail' : ''
  const Icon = running ? LoaderCircle : r.conclusion === 'success' ? CircleCheck : r.conclusion === 'failure' ? CircleX : null
  return (
    <a className={`stat-value ci ${cls}`} href={r.html_url} target="_blank" rel="noreferrer" title={r.name ?? ''}>
      {Icon && <Icon size={18} className={running ? 'spin' : ''} />} {label}
    </a>
  )
}

function SectionList<T>({ s, empty, render }: { s: Section<T[]>; empty: string; render: (item: T) => React.ReactNode }) {
  if (s.state === 'loading') return <p className="muted small">Cargando…</p>
  if (s.state === 'error') return <p className="error small">{s.message}</p>
  if (!s.data.length) return <p className="muted small">{empty}</p>
  return <ul className="plain">{s.data.map(render)}</ul>
}
