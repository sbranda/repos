import { useState } from 'react'
import { Archive, Download, KeyRound, Layers, ShieldCheck, WifiOff, Zap } from 'lucide-react'
import Logo from './Logo'

const TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new'

interface Props {
  onLogin: (token: string, remember: boolean) => Promise<void>
  onInstall: (() => void) | null
  online: boolean
}

export default function Login({ onLogin, onInstall, online }: Props) {
  const [token, setToken] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await onLogin(token.trim(), remember)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-glow" aria-hidden="true" />
      <main className="login">
        <header className="login-hero">
          <Logo size={56} />
          <h1>
            Tus repos, <span className="gradient-text">bajo control</span>
          </h1>
          <p className="muted">Buscá, ordená, editá y archivá todos tus repositorios de GitHub desde un solo lugar.</p>
          <ul className="features">
            <li>
              <Layers size={16} /> Todo en una vista
            </li>
            <li>
              <Zap size={16} /> Acciones en lote
            </li>
            <li>
              <Archive size={16} /> Archivá lo viejo
            </li>
          </ul>
        </header>

        {onInstall && (
          <button className="install" onClick={onInstall}>
            <Download size={16} /> Instalar como app
          </button>
        )}
        {!online && (
          <p className="offline">
            <WifiOff size={16} /> Sin conexión. Conectate a internet para entrar.
          </p>
        )}

        <form onSubmit={submit} className="card login-card">
          <label htmlFor="token" className="field-label">
            <KeyRound size={16} /> Token personal de GitHub
          </label>
          <input
            id="token"
            type="password"
            autoComplete="off"
            placeholder="github_pat_…"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
          />
          <label className="check">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Recordarlo en este navegador
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="primary big" disabled={loading || !token.trim() || !online}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
          <p className="muted small secure">
            <ShieldCheck size={14} /> El token se guarda solo en tu navegador y se usa únicamente con api.github.com.
          </p>
        </form>

        <details className="card help">
          <summary>¿Cómo creo el token?</summary>
          <ol>
            <li>
              Abrí{' '}
              <a href={TOKEN_URL} target="_blank" rel="noreferrer">
                GitHub → Fine-grained token
              </a>
              .
            </li>
            <li>
              En <b>Repository access</b> elegí <b>All repositories</b>.
            </li>
            <li>
              En <b>Permissions → Repository</b> dale:
              <ul>
                <li>
                  <b>Administration</b>: Read and write (para renombrar, editar y archivar)
                </li>
                <li>
                  <b>Pages</b>: Read and write (para ver y activar sitios)
                </li>
                <li>
                  <b>Contents</b>, <b>Actions</b>, <b>Issues</b> y <b>Pull requests</b>: Read-only
                </li>
              </ul>
            </li>
            <li>Generalo y pegalo arriba.</li>
          </ol>
        </details>
      </main>
    </div>
  )
}
