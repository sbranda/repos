import { useState } from 'react'
import type { GitHub, Repo, RepoChanges } from '../github'
import ConfirmDialog from './ConfirmDialog'

type Action = 'archive' | 'unarchive' | 'private' | 'public'

const ACTIONS: Record<Action, { label: string; verb: string; changes: RepoChanges; applies: (r: Repo) => boolean; danger?: boolean }> = {
  archive: { label: 'Archivar', verb: 'archivar', changes: { archived: true }, applies: (r) => !r.archived, danger: true },
  unarchive: { label: 'Desarchivar', verb: 'desarchivar', changes: { archived: false }, applies: (r) => r.archived },
  private: { label: 'Hacer privados', verb: 'hacer privados', changes: { private: true }, applies: (r) => !r.archived && !r.private, danger: true },
  public: { label: 'Hacer públicos', verb: 'hacer públicos', changes: { private: false }, applies: (r) => !r.archived && r.private, danger: true },
}

interface Props {
  gh: GitHub
  repos: Repo[]
  onUpdated: (r: Repo) => void
  onClear: () => void
}

interface Result {
  name: string
  ok: boolean
  message?: string
}

export default function BatchBar({ gh, repos, onUpdated, onClear }: Props) {
  const [action, setAction] = useState<Action | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<Result[] | null>(null)

  const def = action ? ACTIONS[action] : null
  const targets = def ? repos.filter(def.applies) : []
  const skipped = def ? repos.length - targets.length : 0

  async function run() {
    if (!def) return
    setBusy(true)
    setProgress(0)
    const out: Result[] = []
    // De a uno, para no chocar con los límites de GitHub y poder informar cada resultado.
    for (const r of targets) {
      try {
        onUpdated(await gh.updateRepo(r, def.changes))
        out.push({ name: r.name, ok: true })
      } catch (err) {
        out.push({ name: r.name, ok: false, message: err instanceof Error ? err.message : String(err) })
      }
      setProgress((p) => p + 1)
    }
    setBusy(false)
    setAction(null)
    setResults(out)
  }

  const failed = results?.filter((r) => !r.ok) ?? []

  return (
    <div className="batch-bar">
      <span>
        <b>{repos.length}</b> seleccionado{repos.length === 1 ? '' : 's'}
      </span>
      <div className="row">
        {(Object.keys(ACTIONS) as Action[]).map((a) => (
          <button key={a} onClick={() => { setResults(null); setAction(a) }} disabled={!repos.some(ACTIONS[a].applies)}>
            {ACTIONS[a].label}
          </button>
        ))}
        <button onClick={onClear}>Quitar selección</button>
      </div>

      {results && (
        <p className={failed.length ? 'error small' : 'success small'}>
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
          title={`¿${capitalize(def.verb)} ${targets.length} repo${targets.length === 1 ? '' : 's'}?`}
          confirmLabel={def.label}
          busyLabel={`Aplicando ${progress}/${targets.length}…`}
          danger={def.danger}
          busy={busy}
          onConfirm={run}
          onCancel={() => setAction(null)}
        >
          <ul className="plain scroll">
            {targets.map((r) => (
              <li key={r.id}>
                <code>{r.name}</code>
              </li>
            ))}
          </ul>
          {skipped > 0 && (
            <p className="muted small">
              Se saltean {skipped} que no aplican (ya están en ese estado, o están archivados y no se les puede cambiar la
              visibilidad).
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
