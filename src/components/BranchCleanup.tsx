import { useMemo, useState } from 'react'
import { CircleCheck, CircleX, GitMerge, LoaderCircle, Scissors, Trash2 } from 'lucide-react'
import type { GitHub, Repo } from '../github'
import { analyzeBranches, DELETABLE, type BranchInfo } from '../branches'
import { diasDesde, haceCuanto } from '../util'
import ConfirmDialog from './ConfirmDialog'

interface Props {
  gh: GitHub
  repo: Repo
  /** Para que la lista de ramas del detalle se vuelva a cargar. */
  onDeleted: () => void
}

type Result = Record<string, { state: 'running' | 'ok' | 'error'; message?: string }>

/** Busca ramas ya mergeadas y deja borrar varias de una vez, con confirmación. */
export default function BranchCleanup({ gh, repo, onDeleted }: Props) {
  const [phase, setPhase] = useState<'idle' | 'analyzing' | 'ready' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [infos, setInfos] = useState<BranchInfo[]>([])
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [results, setResults] = useState<Result>({})

  async function analyze() {
    setPhase('analyzing')
    setError(null)
    setResults({})
    try {
      const list = await analyzeBranches(gh, repo)
      setInfos(list)
      // Preseleccionamos las mergeadas por PR, y las "contenidas" solo si no son recientes:
      // una rama recién creada desde la principal tampoco tiene commits propios.
      setPicked(new Set(list.filter((b) => b.kind === 'merged-pr' || (b.kind === 'contained' && diasDesde(b.date ?? null) > 14)).map((b) => b.name)))
      setPhase('ready')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setPhase('error')
    }
  }

  const deletable = useMemo(() => infos.filter((b) => DELETABLE.includes(b.kind) && results[b.name]?.state !== 'ok'), [infos, results])
  const kept = useMemo(() => infos.filter((b) => !DELETABLE.includes(b.kind)), [infos])
  const deleted = infos.filter((b) => results[b.name]?.state === 'ok')
  const chosen = deletable.filter((b) => picked.has(b.name))

  function toggle(name: string) {
    setPicked((s) => {
      const n = new Set(s)
      n.has(name) ? n.delete(name) : n.add(name)
      return n
    })
  }

  async function remove() {
    setDeleting(true)
    const names = chosen.map((b) => b.name)
    setResults((r) => ({ ...r, ...Object.fromEntries(names.map((n) => [n, { state: 'running' as const }])) }))
    let any = false
    for (const name of names) {
      try {
        await gh.deleteBranch(repo, name)
        any = true
        setResults((r) => ({ ...r, [name]: { state: 'ok' } }))
      } catch (err) {
        setResults((r) => ({ ...r, [name]: { state: 'error', message: err instanceof Error ? err.message : String(err) } }))
      }
    }
    setDeleting(false)
    setConfirming(false)
    setPicked(new Set())
    if (any) onDeleted()
  }

  if (repo.archived) return null

  if (phase === 'idle' || phase === 'error') {
    return (
      <div className="cleanup">
        <button onClick={analyze}>
          <Scissors size={15} /> Buscar ramas ya mergeadas
        </button>
        {error && <p className="error small">{error}</p>}
      </div>
    )
  }
  if (phase === 'analyzing') {
    return (
      <p className="cleanup muted small">
        <LoaderCircle size={15} className="spin" /> Revisando qué ramas ya están en <code>{repo.default_branch}</code>…
      </p>
    )
  }

  const errors = infos.filter((b) => results[b.name]?.state === 'error')
  return (
    <div className="cleanup">
      {deleted.length > 0 && (
        <p className="success small">
          <CircleCheck size={15} /> {deleted.length === 1 ? 'Se borró 1 rama' : `Se borraron ${deleted.length} ramas`}: {deleted.map((b) => b.name).join(', ')}.
        </p>
      )}
      {errors.map((b) => (
        <p key={b.name} className="error small">
          <CircleX size={15} /> {b.name}: {results[b.name].message}
        </p>
      ))}

      {deletable.length === 0 ? (
        <p className="muted small">No quedan ramas mergeadas para borrar.</p>
      ) : (
        <>
          <div className="cleanup-head">
            <label className="check">
              <input
                type="checkbox"
                checked={chosen.length === deletable.length}
                onChange={(e) => setPicked(e.target.checked ? new Set(deletable.map((b) => b.name)) : new Set())}
              />
              <span>
                <b>{deletable.length}</b> {deletable.length === 1 ? 'rama mergeada' : 'ramas mergeadas'}
              </span>
            </label>
            <button className="danger" disabled={!chosen.length || deleting} onClick={() => setConfirming(true)}>
              <Trash2 size={15} /> Borrar {chosen.length || ''}
            </button>
          </div>
          <ul className="cleanup-list">
            {deletable.map((b) => (
              <li key={b.name}>
                <label className="check">
                  <input type="checkbox" checked={picked.has(b.name)} onChange={() => toggle(b.name)} disabled={deleting} />
                  <code>{b.name}</code>
                </label>
                <span className="muted small">
                  <GitMerge size={13} />{' '}
                  {b.kind === 'merged-pr' && b.pr ? (
                    <>
                      <a href={b.pr.html_url} target="_blank" rel="noreferrer">
                        PR #{b.pr.number}
                      </a>{' '}
                      mergeado {haceCuanto(b.date ?? null)}
                    </>
                  ) : (
                    <>
                      ya está en {repo.default_branch}
                      {b.date && <>, último commit {haceCuanto(b.date)}</>}
                    </>
                  )}
                  {results[b.name]?.state === 'running' && <LoaderCircle size={13} className="spin" />}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {kept.length > 0 && (
        <details className="cleanup-kept">
          <summary className="muted small">Se conservan {kept.length === 1 ? '1 rama' : `${kept.length} ramas`}</summary>
          <ul className="cleanup-list">
            {kept.map((b) => (
              <li key={b.name}>
                <code>{b.name}</code>
                <span className="muted small">{keptReason(b)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <button className="link small" onClick={analyze} disabled={deleting}>
        Volver a revisar
      </button>

      {confirming && (
        <ConfirmDialog
          title={chosen.length === 1 ? `Borrar 1 rama de ${repo.name}` : `Borrar ${chosen.length} ramas de ${repo.name}`}
          confirmLabel="Borrar"
          busyLabel="Borrando…"
          danger
          busy={deleting}
          onConfirm={remove}
          onCancel={() => setConfirming(false)}
        >
          <ul>
            {chosen.map((b) => (
              <li key={b.name}>
                <code>{b.name}</code>
              </li>
            ))}
          </ul>
          <p className="muted small">
            Sus cambios ya están en <code>{repo.default_branch}</code>, así que no se pierde código. Las que vienen de un PR se pueden
            restaurar desde la página del PR en GitHub.
          </p>
        </ConfirmDialog>
      )}
    </div>
  )
}

function keptReason(b: BranchInfo): string {
  switch (b.kind) {
    case 'default':
      return 'rama principal'
    case 'protected':
      return 'protegida'
    case 'open-pr':
      return 'tiene un PR abierto'
    case 'unmerged':
      return `${b.ahead} commit${b.ahead === 1 ? '' : 's'} sin mergear`
    default:
      return 'no se pudo revisar'
  }
}
