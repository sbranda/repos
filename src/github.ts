// Cliente mínimo para la API REST de GitHub. Todo corre en el navegador:
// el token nunca sale de tu computadora salvo hacia api.github.com.

const API = 'https://api.github.com'

export interface Repo {
  id: number
  name: string
  full_name: string
  owner: { login: string }
  html_url: string
  description: string | null
  private: boolean
  archived: boolean
  fork: boolean
  language: string | null
  default_branch: string
  pushed_at: string | null
  updated_at: string
  stargazers_count: number
  open_issues_count: number
  homepage: string | null
  has_pages: boolean
}

export interface User {
  login: string
  name: string | null
  avatar_url: string
}

export interface Branch {
  name: string
  protected: boolean
}

export interface PullRequest {
  number: number
  title: string
  html_url: string
  draft: boolean
  user: { login: string } | null
  head: { ref: string }
}

export interface Issue {
  number: number
  title: string
  html_url: string
  pull_request?: unknown
}

export interface WorkflowRun {
  id: number
  name: string | null
  html_url: string
  status: string | null
  conclusion: string | null
  head_branch: string | null
  created_at: string
}

export interface PagesSite {
  html_url: string | null
  status: 'built' | 'building' | 'errored' | null
  build_type: 'legacy' | 'workflow' | null
  source?: { branch: string; path: '/' | '/docs' } | null
  https_enforced?: boolean
}

/** Desde dónde publica GitHub Pages: una rama (y carpeta) o un workflow de GitHub Actions. */
export type PagesSource = { type: 'workflow' } | { type: 'branch'; branch: string; path: '/' | '/docs' }

export interface Commit {
  sha: string
  html_url: string
  commit: { message: string; author: { name: string; date: string } | null }
  author: { login: string; avatar_url: string } | null
}

export interface SearchItem {
  id: number
  number: number
  title: string
  html_url: string
  repository_url: string
  updated_at: string
  draft?: boolean
}

export interface SearchResult {
  total_count: number
  items: SearchItem[]
}

export interface RepoChanges {
  name?: string
  description?: string
  homepage?: string
  private?: boolean
  archived?: boolean
}

export class GitHubError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export class GitHub {
  private token: string

  constructor(token: string) {
    this.token = token
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<{ data: T; res: Response }> {
    const res = await fetch(path.startsWith('http') ? path : API + path, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${this.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    })
    if (!res.ok) {
      let message = res.statusText
      try {
        const body = await res.json()
        message = body.message ?? message
        if (Array.isArray(body.errors) && body.errors.length) {
          message += ': ' + body.errors.map((e: { message?: string; code?: string }) => e.message ?? e.code).join(', ')
        }
      } catch {
        /* sin cuerpo JSON */
      }
      throw new GitHubError(res.status, traducirError(res.status, message))
    }
    const isJson = (res.headers.get('content-type') ?? '').includes('json')
    const data = res.status === 204 ? (undefined as T) : ((isJson ? await res.json() : await res.text()) as T)
    return { data, res }
  }

  /** Recorre todas las páginas siguiendo el encabezado Link. */
  private async paginate<T>(path: string): Promise<T[]> {
    const out: T[] = []
    let next: string | null = path
    while (next) {
      const { data, res }: { data: T[]; res: Response } = await this.request<T[]>(next)
      out.push(...data)
      next = parseNext(res.headers.get('link'))
    }
    return out
  }

  me() {
    return this.request<User>('/user').then((r) => r.data)
  }

  listRepos() {
    return this.paginate<Repo>('/user/repos?per_page=100&affiliation=owner&sort=pushed')
  }

  listBranches(repo: Repo) {
    return this.paginate<Branch>(`/repos/${repo.full_name}/branches?per_page=100`)
  }

  listPulls(repo: Repo) {
    return this.paginate<PullRequest>(`/repos/${repo.full_name}/pulls?state=open&per_page=100`)
  }

  async listIssues(repo: Repo) {
    // La API de issues también devuelve PRs; los filtramos.
    const all = await this.paginate<Issue>(`/repos/${repo.full_name}/issues?state=open&per_page=100`)
    return all.filter((i) => !i.pull_request)
  }

  async latestRun(repo: Repo): Promise<WorkflowRun | null> {
    const branch = encodeURIComponent(repo.default_branch)
    const { data } = await this.request<{ workflow_runs: WorkflowRun[] }>(
      `/repos/${repo.full_name}/actions/runs?per_page=1&branch=${branch}`,
    )
    return data.workflow_runs[0] ?? null
  }

  /** Sitio de GitHub Pages del repo, o null si no tiene Pages activado. */
  async getPages(repo: Repo): Promise<PagesSite | null> {
    try {
      return (await this.request<PagesSite>(`/repos/${repo.full_name}/pages`)).data
    } catch (err) {
      if (err instanceof GitHubError && err.status === 404) return null
      throw pagesHint(err)
    }
  }

  async enablePages(repo: Repo, source: PagesSource): Promise<PagesSite> {
    try {
      const { data } = await this.request<PagesSite>(`/repos/${repo.full_name}/pages`, {
        method: 'POST',
        body: JSON.stringify(pagesBody(source)),
      })
      return data
    } catch (err) {
      throw pagesHint(err)
    }
  }

  async updatePagesSource(repo: Repo, source: PagesSource): Promise<void> {
    try {
      await this.request<void>(`/repos/${repo.full_name}/pages`, {
        method: 'PUT',
        body: JSON.stringify(pagesBody(source)),
      })
    } catch (err) {
      throw pagesHint(err)
    }
  }

  async disablePages(repo: Repo): Promise<void> {
    try {
      await this.request<void>(`/repos/${repo.full_name}/pages`, { method: 'DELETE' })
    } catch (err) {
      throw pagesHint(err)
    }
  }

  /** README del repo ya convertido a HTML por GitHub, o null si no tiene. */
  async getReadmeHtml(repo: Repo): Promise<string | null> {
    try {
      const { data } = await this.request<string>(`/repos/${repo.full_name}/readme`, {
        headers: { Accept: 'application/vnd.github.html+json' },
      })
      return data
    } catch (err) {
      if (err instanceof GitHubError && err.status === 404) return null
      throw contentsHint(err)
    }
  }

  async listCommits(repo: Repo, perPage = 8): Promise<Commit[]> {
    try {
      const branch = encodeURIComponent(repo.default_branch)
      const { data } = await this.request<Commit[]>(`/repos/${repo.full_name}/commits?sha=${branch}&per_page=${perPage}`)
      return data
    } catch (err) {
      // Un repo vacío responde 409: lo tratamos como "sin commits".
      if (err instanceof GitHubError && err.status === 409) return []
      throw contentsHint(err)
    }
  }

  /** PRs o issues abiertos en todos los repos del usuario (búsqueda de GitHub). */
  async searchOpen(login: string, kind: 'pr' | 'issue', perPage = 8): Promise<SearchResult> {
    const q = encodeURIComponent(`is:open is:${kind} user:${login} archived:false`)
    const { data } = await this.request<SearchResult>(`/search/issues?q=${q}&sort=updated&order=desc&per_page=${perPage}`)
    return data
  }

  updateRepo(repo: Repo, changes: RepoChanges) {
    return this.request<Repo>(`/repos/${repo.full_name}`, {
      method: 'PATCH',
      body: JSON.stringify(changes),
    }).then((r) => r.data)
  }
}

function pagesBody(source: PagesSource) {
  return source.type === 'workflow'
    ? { build_type: 'workflow' }
    : { build_type: 'legacy', source: { branch: source.branch, path: source.path } }
}

/** Los errores de permisos en Pages suelen ser por el token: lo aclaramos. */
function contentsHint(err: unknown): unknown {
  if (err instanceof GitHubError && err.status === 403) {
    return new GitHubError(403, 'GitHub no dejó leer el contenido. Revisá que el token tenga el permiso "Contents: Read-only".')
  }
  return err
}

function pagesHint(err: unknown): unknown {
  if (err instanceof GitHubError && (err.status === 403 || err.status === 404)) {
    return new GitHubError(
      err.status,
      'GitHub no dejó manejar Pages en este repo. Revisá que el token tenga el permiso "Pages: Read and write".',
    )
  }
  return err
}

function parseNext(link: string | null): string | null {
  if (!link) return null
  for (const part of link.split(',')) {
    const m = part.match(/<([^>]+)>;\s*rel="next"/)
    if (m) return m[1]
  }
  return null
}

function traducirError(status: number, message: string): string {
  if (status === 401) return 'El token no es válido o venció.'
  if (status === 403 && /rate limit/i.test(message)) return 'Llegaste al límite de pedidos de GitHub. Probá en unos minutos.'
  if (status === 403 || status === 404)
    return `GitHub rechazó el pedido (${message}). Revisá que el token tenga permiso de "Administration" y acceso a este repo.`
  if (status === 422) return `GitHub no aceptó el cambio: ${message}`
  return `Error ${status}: ${message}`
}
