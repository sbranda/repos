import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Download, ExternalLink, Package, RefreshCw, Search, ShieldAlert, ShieldCheck, ShieldOff } from 'lucide-react'
import { GitHubError, type DependabotAlert, type GitHub, type Repo, type Severity } from '../github'
import { haceCuanto } from '../util'
import { alertasCsv, download, fileName } from '../csv'

interface Props {
  gh: GitHub
  login: string
  repos: Repo[]
  online: boolean
  onOpenRepo: (id: number) => void
}

export interface Alert extends DependabotAlert {
  repo: Repo
}

/** Qué pasó al pedir las alertas de cada repo. */
type RepoResult = { kind: 'ok'; alerts: DependabotAlert[] } | { kind: 'disabled' } | { kind: 'forbidden' } | { kind: 'error'; message: string }

const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low']
export const SEVERITY_LABEL: Record<Severity, string> = { critical: 'Crítica', high: 'Alta', medium: 'Media', low: 'Baja' }
const PARALLEL = 4
const TOKENS_URL = 'https://github.com/settings/personal-access-tokens'

/** Alertas de Dependabot abiertas de todos tus repos, en una sola lista. */
export default function Security({ gh, login, repos, online, onOpenRepo }: Props) {
  const targets = useMemo(() => repos.filter((r) => !r.archived), [repos])
  const [results, setResults] = useState<Map<number, RepoResult>>(new Map())
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(0)
  const [severity, setSeverity] = useState<Severity | ''>('')
  const [repoFilter, setRepoFilter] = useState('')
  const [text, setText] = useState('')
  const runId = useRef(0)

  const fetchAll = useCallback(async () => {
    const id = ++runId.current
    setRunning(true)
    setDone(0)
    const out = new Map<number, RepoResult>()
    let i = 0
    async function worker() {
      while (i < targets.length && id === runId.current) {
        const repo = targets[i++]
        try {
          out.set(repo.id, { kind: 'ok', alerts: await gh.dependabotAlerts(repo) })
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          if (err instanceof GitHubError && (err.status === 403 || err.status === 404)) {
            // GitHub responde 403 tanto si Dependabot está apagado como si el token no tiene permiso.
            out.set(repo.id, /disabled|not enabled|no está/i.test(msg) ? { kind: 'disabled' } : { kind: 'forbidden' })
          } else out.set(repo.id, { kind: 'error', message: msg })
        }
        if (id === runId.current) {
          setDone((n) => n + 1)
          setResults(new Map(out))
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(PARALLEL, targets.length) }, worker))
    if (id === runId.current) setRunning(false)
  }, [gh, targets])

  useEffect(() => {
    if (online) fetchAll()
    // Solo al abrir la pestaña; después, con el botón de actualizar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const alerts: Alert[] = useMemo(() => {
    const list: Alert[] = []
    for (const r of targets) {
      const res = results.get(r.id)
      if (res?.kind === 'ok') for (const a of res.alerts) list.push({ ...a, repo: r })
    }
    return list
  }, [results, targets])

  const by = (k: RepoResult['kind']) => targets.filter((r) => results.get(r.id)?.kind === k)
  const disabled = by('disabled')
  const forbidden = by('forbidden')
  const failed = by('error')
  const checked = results.size
  const noPermission = checked > 0 && forbidden.length === checked && !running

  const counts = useMemo(() => {
    const c: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 }
    const byRepo = new Map<string, number>()
    for (const a of alerts) {
      c[sev(a)]++
      byRepo.set(a.repo.name, (byRepo.get(a.repo.name) ?? 0) + 1)
    }
    return { c, repos: [...byRepo].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])) }
  }, [alerts])

  const visible = useMemo(() => {
    const q = text.trim().toLowerCase()
    return alerts
      .filter((a) => {
        if (severity && sev(a) !== severity) return false
        if (repoFilter && a.repo.name !== repoFilter) return false
        if (
          q &&
          !a.dependency.package.name.toLowerCase().includes(q) &&
          !a.security_advisory.summary.toLowerCase().includes(q) &&
          !(a.security_advisory.cve_id ?? '').toLowerCase().includes(q) &&
          !a.security_advisory.ghsa_id.toLowerCase().includes(q)
        )
          return false
        return true
      })
      .sort((a, b) => SEVERITIES.indexOf(sev(a)) - SEVERITIES.indexOf(sev(b)) || b.created_at.localeCompare(a.created_at))
  }, [alerts, severity, repoFilter, text])

  return (
    <div className="inbox security">
      <div className="inbox-head">
        <div className="seg" role="group" aria-label="Gravedad">
          <button className={severity === '' ? 'on' : ''} aria-pressed={severity === ''} onClick={() => setSeverity('')}>
            Todas <span className="seg-count">{alerts.length}</span>
          </button>
          {SEVERITIES.map((s) => (
            <button key={s} className={severity === s ? 'on' : ''} aria-pressed={severity === s} onClick={() => setSeverity(s)}>
              <span className={`sev-dot ${s}`} aria-hidden="true" /> {SEVERITY_LABEL[s]} <span className="seg-count">{counts.c[s]}</span>
            </button>
          ))}
        </div>
        <div className="inbox-actions">
          {visible.length > 0 && (
            <button className="small-btn" onClick={() => download(fileName('seguridad', login), alertasCsv(visible))} title="Descargar lo que se ve, con los filtros aplicados">
              <Download size={14} />
              <span>
                <span className="hide-sm">Exportar </span>CSV
              </span>
            </button>
          )}
          <button className="icon-btn" onClick={fetchAll} disabled={running || !online} title="Actualizar" aria-label="Actualizar alertas">
            <RefreshCw size={18} className={running ? 'spin' : ''} />
          </button>
        </div>
      </div>

      <div className="filters inbox-filters">
        <div className="search">
          <Search size={18} aria-hidden="true" />
          <input type="search" placeholder="Buscar por paquete, descripción o CVE" value={text} onChange={(e) => setText(e.target.value)} aria-label="Buscar alertas" />
        </div>
        <div className="filter-row">
          <select value={repoFilter} onChange={(e) => setRepoFilter(e.target.value)} aria-label="Repo">
            <option value="">Todos los repos</option>
            {counts.repos.map(([name, n]) => (
              <option key={name} value={name}>
                {name} ({n})
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="muted small security-progress" role="status">
        {!online && !checked
          ? 'Sin conexión: las alertas se ven cuando vuelve internet.'
          : running
            ? `Revisando ${done} de ${targets.length} repos…`
            : checked
              ? `Se revisaron ${checked} repos activos. Los archivados no se revisan.`
              : ''}
      </p>

      {noPermission && (
        <div className="notice warn" role="alert">
          <ShieldOff size={18} aria-hidden="true" />
          <div>
            <b>El token no tiene permiso para leer las alertas de Dependabot.</b> Editá el token en{' '}
            <a href={TOKENS_URL} target="_blank" rel="noreferrer">
              GitHub → Settings → Fine-grained tokens
            </a>{' '}
            y en <b>Permissions → Repository</b> sumá <b>Dependabot alerts: Read-only</b>. No hace falta crear otro: al guardar, el mismo token ya sirve.
          </div>
        </div>
      )}
      {!noPermission && forbidden.length > 0 && !running && (
        <p className="muted small">
          En {forbidden.length} repo{forbidden.length === 1 ? '' : 's'} GitHub no dejó leer las alertas ({forbidden.map((r) => r.name).join(', ')}). Revisá que el token tenga{' '}
          <b>Dependabot alerts: Read-only</b> y acceso a esos repos.
        </p>
      )}
      {failed.length > 0 && !running && (
        <p className="error small" role="alert">
          No se pudieron revisar {failed.map((r) => r.name).join(', ')}. Probá actualizar en un rato.
        </p>
      )}

      {running && !alerts.length ? (
        <ul className="inbox-list" aria-hidden="true">
          {Array.from({ length: 4 }, (_, i) => (
            <li key={i} className="inbox-item skeleton">
              <span className="sk sk-title" />
              <span className="sk sk-line short" />
            </li>
          ))}
        </ul>
      ) : noPermission ? null : alerts.length === 0 && checked > 0 && !running ? (
        <div className="empty-state">
          <ShieldCheck size={32} />
          <p>No hay alertas de seguridad abiertas en los repos revisados.</p>
        </div>
      ) : visible.length === 0 && alerts.length > 0 ? (
        <div className="empty-state">
          <Search size={28} />
          <p>Nada coincide con los filtros.</p>
        </div>
      ) : (
        <ul className="inbox-list">
          {visible.map((a) => {
            const s = sev(a)
            const fix = a.security_vulnerability.first_patched_version?.identifier
            return (
              <li key={`${a.repo.id}-${a.number}`} className="inbox-item alert-item">
                <span className={`sev-badge ${s}`}>
                  <ShieldAlert size={14} aria-hidden="true" /> {SEVERITY_LABEL[s]}
                </span>
                <div className="inbox-main">
                  <a className="inbox-title" href={a.html_url} target="_blank" rel="noreferrer">
                    {a.security_advisory.summary} <ExternalLink size={13} aria-hidden="true" />
                  </a>
                  <div className="inbox-meta">
                    <button className="repo-link" onClick={() => onOpenRepo(a.repo.id)} title={`Abrir ${a.repo.name}`}>
                      {a.repo.name}
                    </button>
                    <span className="pkg">
                      <Package size={13} aria-hidden="true" /> <code>{a.dependency.package.name}</code> ({a.dependency.package.ecosystem})
                    </span>
                    <span>afectadas: {a.security_vulnerability.vulnerable_version_range}</span>
                    {fix ? <span className="fix">arreglado en {fix}</span> : <span className="no-fix">todavía sin versión con arreglo</span>}
                    <span>{haceCuanto(a.created_at)}</span>
                  </div>
                  <div className="inbox-meta faint">
                    <span>{a.dependency.manifest_path}</span>
                    <span>{a.security_advisory.cve_id ?? a.security_advisory.ghsa_id}</span>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {disabled.length > 0 && !running && (
        <details className="security-off">
          <summary>
            Dependabot está apagado en {disabled.length} repo{disabled.length === 1 ? '' : 's'}
          </summary>
          <p className="muted small">Así GitHub no avisa si alguna dependencia tiene un problema de seguridad. Se prende en cada repo, en Settings → Code security.</p>
          <ul className="plain">
            {disabled.map((r) => (
              <li key={r.id}>
                <a href={`${r.html_url}/settings/security_analysis`} target="_blank" rel="noreferrer">
                  {r.name} <ExternalLink size={12} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

function sev(a: DependabotAlert): Severity {
  return a.security_vulnerability?.severity ?? a.security_advisory.severity
}
