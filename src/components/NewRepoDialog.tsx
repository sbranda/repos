import { useEffect, useMemo, useRef, useState } from 'react'
import { CircleCheck, CircleX, ExternalLink, LoaderCircle, Plus } from 'lucide-react'
import { GitHubError, type GitHub, type NewRepo, type Repo } from '../github'
import TopicsInput from './TopicsInput'

interface Props {
  gh: GitHub
  login: string
  repos: Repo[]
  knownTopics: string[]
  onCreated: (r: Repo) => void
  onClose: () => void
}

const LICENSES: [string, string][] = [
  ['', 'Sin licencia'],
  ['mit', 'MIT (la más simple y permisiva)'],
  ['apache-2.0', 'Apache 2.0'],
  ['gpl-3.0', 'GPL 3.0 (los cambios deben ser libres)'],
  ['bsd-3-clause', 'BSD 3'],
  ['unlicense', 'Dominio público (Unlicense)'],
]

const GITIGNORES = ['', 'Node', 'Python', 'Java', 'Go', 'Rust', 'Dart', 'Android', 'Unity', 'VisualStudio', 'Swift']

type Step = { label: string; state: 'pending' | 'running' | 'ok' | 'error'; detail?: string }

/** Lo que GitHub acepta como nombre: letras, números, punto, guion y guion bajo. */
export function normalizeRepoName(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9._-]/g, '-')
    .replace(/-{2,}/g, '-')
    .slice(0, 100)
}

/** Formulario para crear un repo, con un paso de revisión antes de tocar GitHub. */
export default function NewRepoDialog({ gh, login, repos, knownTopics, onCreated, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const [form, setForm] = useState({
    name: '',
    description: '',
    private: false,
    readme: true,
    license: '',
    gitignore: '',
    topics: [] as string[],
    pages: false,
  })
  const [phase, setPhase] = useState<'form' | 'review' | 'working' | 'done'>('form')
  const [steps, setSteps] = useState<Step[]>([])
  const [created, setCreated] = useState<Repo | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])

  const name = normalizeRepoName(form.name)
  const taken = useMemo(() => repos.some((r) => r.name.toLowerCase() === name.toLowerCase()), [repos, name])
  const reserved = name === '.' || name === '..'
  // Pages necesita una rama con algo adentro: si no hay README, licencia ni .gitignore, no hay primer commit.
  const hasFirstCommit = form.readme || !!form.license || !!form.gitignore
  const valid = !!name && !taken && !reserved
  const wantPages = form.pages && hasFirstCommit
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  function close() {
    if (phase !== 'working') onClose()
  }

  async function create() {
    setPhase('working')
    setError(null)
    const plan: Step[] = [{ label: 'Crear el repo', state: 'running' }]
    if (form.topics.length) plan.push({ label: 'Agregar etiquetas', state: 'pending' })
    if (wantPages) plan.push({ label: 'Activar GitHub Pages', state: 'pending' })
    setSteps(plan)
    const mark = (i: number, state: Step['state'], detail?: string) =>
      setSteps((list) => list.map((s, j) => (j === i ? { ...s, state, detail } : j === i + 1 && state === 'ok' ? { ...s, state: 'running' } : s)))

    const data: NewRepo = {
      name,
      description: form.description.trim(),
      private: form.private,
      auto_init: form.readme,
      license_template: form.license,
      gitignore_template: form.gitignore,
    }
    let repo: Repo
    try {
      repo = await gh.createRepo(data)
    } catch (err) {
      mark(0, 'error')
      setError(err instanceof Error ? err.message : String(err))
      setPhase('review')
      return
    }
    mark(0, 'ok')
    let i = 1
    // Desde acá el repo ya existe: si algo falla, lo avisamos pero seguimos.
    if (form.topics.length) {
      try {
        repo = await gh.updateRepo(repo, { topics: form.topics })
        mark(i, 'ok')
      } catch (err) {
        mark(i, 'error', err instanceof Error ? err.message : String(err))
      }
      i++
    }
    if (wantPages) {
      try {
        await enablePagesWithRetry(gh, repo)
        repo = { ...repo, has_pages: true }
        mark(i, 'ok', `Se publica en unos minutos en https://${login.toLowerCase()}.github.io/${repo.name}/`)
      } catch (err) {
        mark(i, 'error', (err instanceof Error ? err.message : String(err)) + ' Podés activarlo después desde el detalle del repo.')
      }
    }
    setCreated(repo)
    onCreated(repo)
    setPhase('done')
  }

  return (
    <dialog
      ref={ref}
      className="dialog new-repo"
      aria-labelledby="new-repo-title"
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
    >
      <h2 id="new-repo-title">
        <Plus size={20} /> {phase === 'form' ? 'Nuevo repo' : phase === 'done' ? 'Repo creado' : `Crear ${name}`}
      </h2>

      {phase === 'form' && (
        <form
          className="edit-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (!valid) return
            setSteps([])
            setError(null)
            setPhase('review')
          }}
        >
          <label>
            Nombre
            <input
              autoFocus
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="mi-proyecto"
              required
              aria-invalid={!!form.name && !valid}
            />
            {form.name && name && name !== form.name.trim() && !taken && (
              <span className="hint">
                Se va a llamar <code>{name}</code>
              </span>
            )}
            {taken && <span className="hint error-text">Ya tenés un repo llamado {name}.</span>}
            {reserved && <span className="hint error-text">Ese nombre no se puede usar.</span>}
          </label>
          <label>
            <span>
              Descripción <span className="optional">(opcional)</span>
            </span>
            <input value={form.description} onChange={(e) => set('description', e.target.value)} />
          </label>
          <label>
            Visibilidad
            <select value={form.private ? 'private' : 'public'} onChange={(e) => set('private', e.target.value === 'private')}>
              <option value="public">Público: cualquiera puede verlo</option>
              <option value="private">Privado: solo vos</option>
            </select>
          </label>
          <div className="field">
            <span>
              Etiquetas <span className="optional">(opcional)</span>
            </span>
            <TopicsInput value={form.topics} onChange={(t) => set('topics', t)} known={knownTopics} />
          </div>

          <fieldset className="options">
            <legend>Contenido inicial</legend>
            <label className="check">
              <input type="checkbox" checked={form.readme} onChange={(e) => set('readme', e.target.checked)} />
              Agregar un README
            </label>
            <label>
              Licencia
              <select value={form.license} onChange={(e) => set('license', e.target.value)}>
                {LICENSES.map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label>
              .gitignore
              <select value={form.gitignore} onChange={(e) => set('gitignore', e.target.value)}>
                {GITIGNORES.map((g) => (
                  <option key={g} value={g}>
                    {g || 'Ninguno'}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>

          <fieldset className="options">
            <legend>Sitio web</legend>
            <label className="check">
              <input
                type="checkbox"
                checked={wantPages}
                disabled={!hasFirstCommit}
                onChange={(e) => set('pages', e.target.checked)}
              />
              Publicar con GitHub Pages
            </label>
            {!hasFirstCommit ? (
              <span className="hint">Para publicar hace falta contenido inicial (por ejemplo, el README).</span>
            ) : wantPages ? (
              <span className="hint">
                Se publica desde la rama principal en <code>{login.toLowerCase()}.github.io/{name || 'nombre'}</code>.
                {form.private && ' Ojo: en cuentas gratis Pages solo funciona con repos públicos.'}
              </span>
            ) : null}
          </fieldset>

          <div className="dialog-actions">
            <button type="button" onClick={close}>
              Cancelar
            </button>
            <button type="submit" className="primary" disabled={!valid}>
              Revisar
            </button>
          </div>
        </form>
      )}

      {(phase === 'review' || phase === 'working') && (
        <>
          <div className="dialog-body">
            <p>Se va a crear este repo en tu cuenta de GitHub:</p>
            <ul>
              <li>
                <code>
                  {login}/{name}
                </code>
                , {form.private ? 'privado' : 'público'}
                {form.description.trim() && <> — “{form.description.trim()}”</>}
              </li>
              <li>
                Contenido:{' '}
                {[
                  form.readme && 'README',
                  form.license && `licencia ${LICENSES.find(([k]) => k === form.license)?.[0].toUpperCase()}`,
                  form.gitignore && `.gitignore de ${form.gitignore}`,
                ]
                  .filter(Boolean)
                  .join(', ') || 'vacío'}
              </li>
              {form.topics.length > 0 && <li>Etiquetas: {form.topics.join(', ')}</li>}
              {wantPages && <li>Activar GitHub Pages desde la rama principal</li>}
            </ul>
            <p className="muted small">Borrar repos no se puede desde esta app: si te equivocás, se borra desde GitHub.</p>
            {steps.length > 0 && <StepList steps={steps} />}
            {error && <p className="error">{error}</p>}
          </div>
          <div className="dialog-actions">
            <button onClick={() => setPhase('form')} disabled={phase === 'working'}>
              Volver
            </button>
            <button className="primary" onClick={create} disabled={phase === 'working'}>
              {phase === 'working' ? 'Creando…' : 'Crear repo'}
            </button>
          </div>
        </>
      )}

      {phase === 'done' && created && (
        <>
          <div className="dialog-body">
            <StepList steps={steps} />
          </div>
          <div className="dialog-actions">
            <a className="button" href={created.html_url} target="_blank" rel="noreferrer">
              Ver en GitHub <ExternalLink size={15} />
            </a>
            <button className="primary" onClick={onClose}>
              Listo
            </button>
          </div>
        </>
      )}
    </dialog>
  )
}

function StepList({ steps }: { steps: Step[] }) {
  return (
    <ul className="steps" aria-live="polite">
      {steps.map((s) => (
        <li key={s.label} className={`step ${s.state}`}>
          {s.state === 'ok' ? (
            <CircleCheck size={17} />
          ) : s.state === 'error' ? (
            <CircleX size={17} />
          ) : s.state === 'running' ? (
            <LoaderCircle size={17} className="spin" />
          ) : (
            <span className="step-dot" />
          )}
          <span>
            {s.label}
            {s.detail && <span className="step-detail">{s.detail}</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Recién creado, a veces GitHub todavía no tiene lista la rama: reintentamos un par de veces. */
async function enablePagesWithRetry(gh: GitHub, repo: Repo) {
  const source = { type: 'branch' as const, branch: repo.default_branch || 'main', path: '/' as const }
  for (let attempt = 0; ; attempt++) {
    try {
      return await gh.enablePages(repo, source)
    } catch (err) {
      const retriable = err instanceof GitHubError && (err.status === 422 || err.status === 404 || err.status === 409)
      if (!retriable || attempt >= 2) throw err
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)))
    }
  }
}
