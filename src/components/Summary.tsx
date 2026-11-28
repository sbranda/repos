import { useEffect, useMemo, useState } from 'react'
import {
  Archive,
  CircleDot,
  Clock,
  FolderGit2,
  GitFork,
  GitPullRequest,
  Globe,
  Lock,
  Star,
  Unlock,
} from 'lucide-react'
import type { GitHub, Repo, SearchResult } from '../github'
import { languageColor } from '../languages'
import { diasDesde, haceCuanto } from '../util'

interface Props {
  gh: GitHub
  /** Cuentas cuyos repos se miran (la tuya y/o organizaciones). */
  owners: string[]
  repos: Repo[]
  loading: boolean
  onOpenRepo: (id: number) => void
}

type Search = { state: 'loading' } | { state: 'ok'; data: SearchResult } | { state: 'error'; message: string }

/** Antigüedad del último push, de más reciente a más vieja (escala de un solo color). */
const AGE_BUCKETS = [
  { key: 'm1', label: 'Último mes', max: 30 },
  { key: 'm6', label: '1 a 6 meses', max: 182 },
  { key: 'y1', label: '6 a 12 meses', max: 365 },
  { key: 'old', label: 'Más de 1 año', max: Infinity },
] as const

const TOP_LANGUAGES = 8

export default function Summary({ gh, owners, repos, loading, onOpenRepo }: Props) {
  const [prs, setPrs] = useState<Search>({ state: 'loading' })
  const [issues, setIssues] = useState<Search>({ state: 'loading' })

  useEffect(() => {
    let alive = true
    const run = (kind: 'pr' | 'issue', set: (s: Search) => void) =>
      gh.searchOpen(owners, kind).then(
        (data) => alive && set({ state: 'ok', data }),
        (err) => alive && set({ state: 'error', message: err instanceof Error ? err.message : String(err) }),
      )
    run('pr', setPrs)
    run('issue', setIssues)
    return () => {
      alive = false
    }
  }, [gh, owners])

  const active = useMemo(() => repos.filter((r) => !r.archived), [repos])

  const totals = useMemo(
    () => ({
      total: repos.length,
      active: active.length,
      archived: repos.length - active.length,
      public: repos.filter((r) => !r.private).length,
      private: repos.filter((r) => r.private).length,
      forks: repos.filter((r) => r.fork).length,
      sites: repos.filter((r) => r.has_pages).length,
      stars: repos.reduce((n, r) => n + r.stargazers_count, 0),
    }),
    [repos, active],
  )

  const languages = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of active) {
      const l = r.language ?? 'Sin lenguaje'
      counts.set(l, (counts.get(l) ?? 0) + 1)
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    const top = sorted.slice(0, TOP_LANGUAGES)
    const rest = sorted.slice(TOP_LANGUAGES).reduce((n, [, c]) => n + c, 0)
    if (rest) top.push(['Otros', rest])
    return top
  }, [active])
  const maxLang = Math.max(1, ...languages.map(([, c]) => c))

  const ages = useMemo(() => {
    const counts: Record<string, number> = { m1: 0, m6: 0, y1: 0, old: 0 }
    for (const r of active) {
      const d = diasDesde(r.pushed_at)
      const b = AGE_BUCKETS.find((x) => d < x.max) ?? AGE_BUCKETS[3]
      counts[b.key]++
    }
    return AGE_BUCKETS.map((b) => ({ ...b, count: counts[b.key] }))
  }, [active])

  const inactive = useMemo(
    () =>
      active
        .filter((r) => diasDesde(r.pushed_at) >= 365)
        .sort((a, b) => (a.pushed_at ?? '').localeCompare(b.pushed_at ?? '')),
    [active],
  )

  const repoByUrl = useMemo(() => {
    const m = new Map<string, Repo>()
    for (const r of repos) m.set(`https://api.github.com/repos/${r.full_name}`.toLowerCase(), r)
    return m
  }, [repos])

  if (loading && !repos.length) {
    return (
      <div className="summary">
        <div className="tiles">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="tile skeleton-tile" aria-hidden="true">
              <span className="sk sk-title" />
              <span className="sk sk-line short" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="summary">
      <div className="tiles">
        <Tile tone="violet" icon={<FolderGit2 size={18} />} label="Repos activos" value={totals.active} sub={`${totals.total} en total`} />
        <Tile tone="blue" icon={<GitPullRequest size={18} />} label="PRs abiertos" value={count(prs)} sub="en todos tus repos" />
        <Tile tone="pink" icon={<CircleDot size={18} />} label="Issues abiertos" value={count(issues)} sub="en todos tus repos" />
        <Tile
          tone="amber"
          icon={<Clock size={18} />}
          label="Inactivos"
          value={inactive.length}
          sub="sin cambios hace más de 1 año"
        />
      </div>

      <ul className="mini-stats" aria-label="Otros totales">
        <li>
          <Unlock size={14} /> <b>{totals.public}</b> {totals.public === 1 ? 'público' : 'públicos'}
        </li>
        <li>
          <Lock size={14} /> <b>{totals.private}</b> {totals.private === 1 ? 'privado' : 'privados'}
        </li>
        <li>
          <Archive size={14} /> <b>{totals.archived}</b> {totals.archived === 1 ? 'archivado' : 'archivados'}
        </li>
        <li>
          <GitFork size={14} /> <b>{totals.forks}</b> {totals.forks === 1 ? 'fork' : 'forks'}
        </li>
        <li>
          <Globe size={14} /> <b>{totals.sites}</b> con sitio
        </li>
        <li>
          <Star size={14} /> <b>{totals.stars}</b> {totals.stars === 1 ? 'estrella' : 'estrellas'}
        </li>
      </ul>

      <div className="panels">
        <section className="panel">
          <h3>Lenguajes</h3>
          <p className="muted small panel-sub">Repos activos según su lenguaje principal</p>
          {languages.length === 0 ? (
            <p className="muted small">Sin repos activos.</p>
          ) : (
            <ul className="bars" role="list">
              {languages.map(([lang, c]) => (
                <li key={lang} className="bar-row" title={`${lang}: ${c} repo${c === 1 ? '' : 's'}`}>
                  <span className="bar-label">
                    <span
                      className="dot"
                      style={{ '--lang': lang === 'Otros' ? 'var(--muted)' : languageColor(lang === 'Sin lenguaje' ? null : lang) } as React.CSSProperties}
                    />
                    {lang}
                  </span>
                  <span className="bar-track">
                    <span className="bar-fill" style={{ width: `${(c / maxLang) * 100}%` }} />
                  </span>
                  <span className="bar-value">{c}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <h3>Último cambio</h3>
          <p className="muted small panel-sub">Cuánto hace que recibió un push cada repo activo</p>
          <AgeBar ages={ages} total={active.length} />
          <h4 className="panel-h4">Inactivos hace más de un año</h4>
          {inactive.length === 0 ? (
            <p className="muted small">Ninguno. Todos tus repos activos tuvieron cambios este año.</p>
          ) : (
            <ul className="link-list">
              {inactive.slice(0, 6).map((r) => (
                <li key={r.id}>
                  <button className="link-row" onClick={() => onOpenRepo(r.id)}>
                    <span className="link-title">{r.name}</span>
                    <span className="muted small">{haceCuanto(r.pushed_at)}</span>
                  </button>
                </li>
              ))}
              {inactive.length > 6 && <li className="muted small more">y {inactive.length - 6} más</li>}
            </ul>
          )}
        </section>

        <section className="panel">
          <h3>
            <GitPullRequest size={16} /> PRs abiertos
          </h3>
          <OpenList s={prs} repoByUrl={repoByUrl} onOpenRepo={onOpenRepo} empty="No tenés PRs abiertos." />
        </section>

        <section className="panel">
          <h3>
            <CircleDot size={16} /> Issues abiertos
          </h3>
          <OpenList s={issues} repoByUrl={repoByUrl} onOpenRepo={onOpenRepo} empty="No tenés issues abiertos." />
        </section>
      </div>
    </div>
  )
}

function count(s: Search): string | number {
  return s.state === 'ok' ? s.data.total_count : s.state === 'loading' ? '…' : '—'
}

function Tile({ tone, icon, label, value, sub }: { tone: string; icon: React.ReactNode; label: string; value: string | number; sub: string }) {
  return (
    <div className={`tile stat tone-${tone}`}>
      <span className="stat-icon">{icon}</span>
      <span className="stat-label">{label}</span>
      <span className="tile-value">{value}</span>
      <span className="muted small">{sub}</span>
    </div>
  )
}

function AgeBar({ ages, total }: { ages: { key: string; label: string; count: number }[]; total: number }) {
  if (!total) return <p className="muted small">Sin repos activos.</p>
  return (
    <>
      <div className="age-bar" role="img" aria-label={ages.map((a) => `${a.label}: ${a.count}`).join(', ')}>
        {ages
          .filter((a) => a.count > 0)
          .map((a) => (
            <span
              key={a.key}
              className={`age-seg age-${a.key}`}
              style={{ flexGrow: a.count }}
              title={`${a.label}: ${a.count} repo${a.count === 1 ? '' : 's'}`}
            />
          ))}
      </div>
      <ul className="age-legend">
        {ages.map((a) => (
          <li key={a.key}>
            <span className={`age-swatch age-${a.key}`} aria-hidden="true" />
            {a.label} <b>{a.count}</b>
          </li>
        ))}
      </ul>
    </>
  )
}

function OpenList({
  s,
  repoByUrl,
  onOpenRepo,
  empty,
}: {
  s: Search
  repoByUrl: Map<string, Repo>
  onOpenRepo: (id: number) => void
  empty: string
}) {
  if (s.state === 'loading') return <p className="muted small">Buscando…</p>
  if (s.state === 'error') return <p className="error small">No se pudo buscar: {s.message}</p>
  if (!s.data.items.length) return <p className="muted small">{empty}</p>
  return (
    <ul className="link-list">
      {s.data.items.map((it) => {
        const repo = repoByUrl.get(it.repository_url.toLowerCase())
        const repoName = it.repository_url.split('/').pop()
        return (
          <li key={it.id} className="open-item">
            <a href={it.html_url} target="_blank" rel="noreferrer" className="link-title">
              #{it.number} {it.title}
            </a>
            <span className="muted small">
              {repo ? (
                <button className="link" onClick={() => onOpenRepo(repo.id)}>
                  {repoName}
                </button>
              ) : (
                repoName
              )}{' '}
              · {it.draft ? 'borrador · ' : ''}actualizado {haceCuanto(it.updated_at)}
            </span>
          </li>
        )
      })}
      {s.data.total_count > s.data.items.length && (
        <li className="muted small more">y {s.data.total_count - s.data.items.length} más</li>
      )}
    </ul>
  )
}
