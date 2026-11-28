import { useMemo, useState } from 'react'
import type { GitHub, Repo, RepoChanges } from '../github'
import { Archive, ArchiveRestore, Eye, EyeOff, Tag, Tags, X } from 'lucide-react'
import ConfirmDialog from './ConfirmDialog'
import TopicsInput from './TopicsInput'
import { MAX_TOPICS } from '../topics'

type Action = 'archive' | 'unarchive' | 'private' | 'public' | 'addTopics' | 'removeTopics'

const ICONS: Record<Action, React.ReactNode> = {
  archive: <Archive size={16} />,
  unarchive: <ArchiveRestore size={16} />,
  private: <EyeOff size={16} />,
  public: <Eye size={16} />,
  addTopics: <Tag size={16} />,
  removeTopics: <Tags size={16} />,
}

interface ActionDef {
  label: string
  verb: string
  /** Lo que cambia en cada repo, o null si a ese repo no le aplica. */
  changes: (r: Repo, topics: string[]) => RepoChanges | null
  /** Si el botón tiene sentido con la selección actual. */
  available: (r: Repo) => boolean
  danger?: boolean
}

const has = (r: Repo) => r.topics ?? []

const ACTIONS: Record<Action, ActionDef> = {
  archive: { label: 'Archivar', verb: 'archivar', changes: (r) => (r.archived ? null : { archived: true }), available: (r) => !r.archived, danger: true },
  unarchive: { label: 'Desarchivar', verb: 'desarchivar', changes: (r) => (r.archived ? { archived: false } : null), available: (r) => r.archived },
  private: {
    label: 'Hacer privados',
    verb: 'hacer privados',
    changes: (r) => (!r.archived && !r.private ? { private: true } : null),
    available: (r) => !r.archived && !r.private,
    danger: true,
  },
  public: {
    label: 'Hacer públicos',
    verb: 'hacer públicos',
    changes: (r) => (!r.archived && r.private ? { private: false } : null),
    available: (r) => !r.archived && r.private,
    danger: true,
  },
  addTopics: {
    label: 'Sumar etiquetas',
    verb: 'sumar etiquetas a',
    changes: (r, topics) => {
      if (r.archived || !topics.length) return null
      const next = [...has(r), ...topics.filter((t) => !has(r).includes(t))]
      if (next.length === has(r).length || next.length > MAX_TOPICS) return null
      return { topics: next }
    },
    available: (r) => !r.archived,
  },
  removeTopics: {
    label: 'Quitar etiquetas',
    verb: 'quitar etiquetas a',
    changes: (r, topics) => {
      if (r.archived || !topics.length) return null
      const next = has(r).filter((t) => !topics.includes(t))
      return next.length === has(r).length ? null : { topics: next }
    },
    available: (r) => !r.archived && has(r).length > 0,
  },
}

const isTopicAction = (a: Action | null) => a === 'addTopics' || a === 'removeTopics'

interface Props {
  gh: GitHub
  repos: Repo[]
  /** Etiquetas que ya usás, para sugerirlas al sumar. */
  knownTopics: string[]
  onUpdated: (r: Repo) => void
  onClear: () => void
}

interface Result {
  name: string
  ok: boolean
  message?: string
}

export default function BatchBar({ gh, repos, knownTopics, onUpdated, onClear }: Props) {
  const [action, setAction] = useState<Action | null>(null)
  const [topics, setTopics] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<Result[] | null>(null)

  const def = action ? ACTIONS[action] : null
  const plan = useMemo(
    () => (def ? repos.map((r) => ({ repo: r, changes: def.changes(r, topics) })).filter((p) => p.changes) : []),
    [def, repos, topics],
  ) as { repo: Repo; changes: RepoChanges }[]
  const skipped = repos.length - plan.length
  // Al quitar, se ofrecen las etiquetas que tienen los repos elegidos (sin contar los archivados).
  const selectedTopics = useMemo(
    () => [...new Set(repos.filter((r) => !r.archived).flatMap(has))].sort((a, b) => a.localeCompare(b, 'es')),
    [repos],
  )
  const tooMany = action === 'addTopics' ? repos.filter((r) => !r.archived && new Set([...has(r), ...topics]).size > MAX_TOPICS) : []

  function open(a: Action) {
    setResults(null)
    setTopics([])
    setAction(a)
  }

  async function run() {
    if (!def || !plan.length) return
    setBusy(true)
    setProgress(0)
    const out: Result[] = []
    // De a uno, para no chocar con los límites de GitHub y poder informar cada resultado.
    for (const { repo, changes } of plan) {
      try {
        onUpdated(await gh.updateRepo(repo, changes))
        out.push({ name: repo.name, ok: true })
      } catch (err) {
        out.push({ name: repo.name, ok: false, message: err instanceof Error ? err.message : String(err) })
      }
      setProgress((p) => p + 1)
    }
    setBusy(false)
    setAction(null)
    setResults(out)
  }

  const failed = results?.filter((r) => !r.ok) ?? []
  const n = plan.length
  const title = isTopicAction(action)
    ? `${def!.label} ${n ? `en ${n} repo${n === 1 ? '' : 's'}` : ''}`.trim()
    : def
      ? `¿${capitalize(def.verb)} ${n} repo${n === 1 ? '' : 's'}?`
      : ''

  return (
    <div className="batch-bar">
      <span>
        <b className="count-pill">{repos.length}</b> seleccionado{repos.length === 1 ? '' : 's'}
      </span>
      <div className="row">
        {(Object.keys(ACTIONS) as Action[]).map((a) => (
          <button key={a} aria-label={ACTIONS[a].label} title={ACTIONS[a].label} onClick={() => open(a)} disabled={!repos.some(ACTIONS[a].available)}>
            {ICONS[a]} <span className="hide-sm">{ACTIONS[a].label}</span>
          </button>
        ))}
        <button onClick={onClear} className="icon-btn" aria-label="Quitar selección" title="Quitar selección">
          <X size={16} />
        </button>
      </div>

      {results && (
        <p className={failed.length ? 'error small' : 'success small'} role={failed.length ? 'alert' : 'status'}>
          {results.length - failed.length} de {results.length} aplicados.
          {failed.map((f) => (
            <span key={f.name} className="block">
              {f.name}: {f.message}
            </span>
          ))}
          <button className="link" onClick={() => setResults(null)}>
            Cerrar
          </button>
        </p>
      )}

      {def && (
        <ConfirmDialog
          title={title}
          confirmLabel={isTopicAction(action) ? (n ? `${def.label} en ${n}` : def.label) : def.label}
          busyLabel={`Aplicando ${progress}/${n}…`}
          danger={def.danger}
          busy={busy}
          confirmDisabled={!n}
          onConfirm={run}
          onCancel={() => setAction(null)}
        >
          {action === 'addTopics' && (
            <div className="batch-topics">
              <p className="small">Escribí las etiquetas y apretá Enter o coma. Se suman a las que cada repo ya tiene.</p>
              <TopicsInput value={topics} onChange={setTopics} known={knownTopics} />
            </div>
          )}
          {action === 'removeTopics' && (
            <fieldset className="batch-topics">
              <legend className="small">Elegí qué etiquetas sacar de los repos seleccionados:</legend>
              <div className="topic-picks">
                {selectedTopics.map((t) => {
                  const on = topics.includes(t)
                  return (
                    <button
                      key={t}
                      type="button"
                      className={`topic pick ${on ? 'on' : ''}`}
                      aria-pressed={on}
                      onClick={() => setTopics(on ? topics.filter((x) => x !== t) : [...topics, t])}
                    >
                      {t}
                    </button>
                  )
                })}
              </div>
            </fieldset>
          )}

          {n > 0 && (
            <>
              {isTopicAction(action) && <p className="small">Así quedan:</p>}
              <ul className="plain scroll">
                {plan.map(({ repo, changes }) => (
                  <li key={repo.id}>
                    <code>{repo.name}</code>
                    {changes.topics && (
                      <span className="muted small">
                        {' '}
                        → {changes.topics.length ? changes.topics.join(', ') : 'sin etiquetas'}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
          {isTopicAction(action) && !topics.length && <p className="muted small">Todavía no elegiste ninguna etiqueta.</p>}
          {isTopicAction(action) && topics.length > 0 && !n && (
            <p className="muted small">Ningún repo seleccionado cambia con estas etiquetas.</p>
          )}
          {skipped - tooMany.length > 0 && (topics.length > 0 || !isTopicAction(action)) && (
            <p className="muted small">
              {isTopicAction(action)
                ? `${skipped - tooMany.length === 1 ? 'Se saltea 1' : `Se saltean ${skipped - tooMany.length}`}: ya ${action === 'addTopics' ? 'tienen esas etiquetas' : 'no tienen esas etiquetas'} o están archivados.`
                : 'Se saltean ' +
                  skipped +
                  ' que no aplican (ya están en ese estado, o están archivados y no se les puede cambiar la visibilidad).'}
            </p>
          )}
          {tooMany.length > 0 && (
            <p className="error small" role="alert">
              {tooMany.map((r) => r.name).join(', ')}: pasaría{tooMany.length === 1 ? '' : 'n'} de {MAX_TOPICS} etiquetas, el máximo de
              GitHub. No se toca{tooMany.length === 1 ? '' : 'n'}.
            </p>
          )}
          {action === 'archive' && <p className="small">Quedan de solo lectura. Se pueden desarchivar cuando quieras.</p>}
          {action === 'public' && <p className="small">Cualquiera va a poder ver el código y todo su historial.</p>}
        </ConfirmDialog>
      )}
    </div>
  )
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
