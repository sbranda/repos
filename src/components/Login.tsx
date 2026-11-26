import { useState } from 'react'

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
    <main className="login">
      <h1>Mis repos</h1>
      <p className="muted">Administrá tus repositorios de GitHub desde un solo lugar.</p>
      {onInstall && (
        <button className="install" onClick={onInstall}>
          Instalar como app
        </button>
      )}
      {!online && <p className="offline">Sin conexión. Conectate a internet para entrar.</p>}

      <form onSubmit={submit} className="card">
        <label htmlFor="token">Token personal de GitHub</label>
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
        <button type="submit" className="primary" disabled={loading || !token.trim() || !online}>
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>

      <details className="card help" open>
        <summary>¿Cómo creo el token?</summary>
        <ol>
          <li>
            Abrí <a href={TOKEN_URL} target="_blank" rel="noreferrer">GitHub → Fine-grained token</a>.
          </li>
          <li>En <b>Repository access</b> elegí <b>All repositories</b>.</li>
          <li>
            En <b>Permissions → Repository</b> dale:
            <ul>
              <li><b>Administration</b>: Read and write (para renombrar, editar y archivar)</li>
              <li><b>Actions</b>, <b>Issues</b> y <b>Pull requests</b>: Read-only</li>
            </ul>
          </li>
          <li>Generalo y pegalo arriba.</li>
        </ol>
        <p className="muted small">
          El token se guarda solo en tu navegador y se usa únicamente para hablar con api.github.com.
        </p>
      </details>
    </main>
  )
}
