// Decide qué ramas de un repo ya están mergeadas y se pueden borrar sin perder nada.

import type { Branch, GitHub, PullRequest, Repo } from './github'

export type BranchKind =
  /** Su PR se mergeó y la rama no tuvo commits después. */
  | 'merged-pr'
  /** Todos sus commits ya están en la rama principal. */
  | 'contained'
  /** Tiene commits que no están en la principal. */
  | 'unmerged'
  | 'open-pr'
  | 'protected'
  | 'default'
  /** No se llegó a revisar (demasiadas ramas o falló la comparación). */
  | 'unknown'

export interface BranchInfo {
  name: string
  kind: BranchKind
  /** Cuándo se mergeó (PR) o fecha del último commit de la rama. */
  date?: string
  pr?: { number: number; html_url: string }
  ahead?: number
}

export const DELETABLE: BranchKind[] = ['merged-pr', 'contained']
const MAX_COMPARES = 60

export async function analyzeBranches(gh: GitHub, repo: Repo): Promise<BranchInfo[]> {
  const [branches, open, closed] = await Promise.all([gh.listBranches(repo), gh.listPulls(repo), gh.listClosedPulls(repo)])
  const own = (p: PullRequest) => !p.head.repo || p.head.repo.full_name === repo.full_name
  const openRefs = new Set(open.filter(own).map((p) => p.head.ref))
  const mergedByRef = new Map<string, PullRequest>()
  for (const p of closed) if (p.merged_at && own(p) && !mergedByRef.has(p.head.ref)) mergedByRef.set(p.head.ref, p)

  let compares = 0
  const one = async (b: Branch): Promise<BranchInfo> => {
    if (b.name === repo.default_branch) return { name: b.name, kind: 'default' }
    if (b.protected) return { name: b.name, kind: 'protected' }
    if (openRefs.has(b.name)) return { name: b.name, kind: 'open-pr' }
    const pr = mergedByRef.get(b.name)
    const prInfo = pr && { number: pr.number, html_url: pr.html_url }
    // Mergeado por PR y sin commits nuevos desde entonces (cubre los "squash merge").
    if (pr && b.commit?.sha && pr.head.sha === b.commit.sha) return { name: b.name, kind: 'merged-pr', date: pr.merged_at ?? undefined, pr: prInfo }
    if (compares >= MAX_COMPARES) return { name: b.name, kind: 'unknown' }
    compares++
    try {
      const c = await gh.compare(repo, repo.default_branch, b.name)
      const date = c.merge_base_commit.commit.committer?.date
      if (c.ahead_by === 0) return { name: b.name, kind: 'contained', date, pr: prInfo }
      return { name: b.name, kind: 'unmerged', ahead: c.ahead_by, pr: prInfo }
    } catch {
      return { name: b.name, kind: 'unknown' }
    }
  }

  // De a 6 comparaciones a la vez, para no saturar la API.
  const out: BranchInfo[] = []
  for (let i = 0; i < branches.length; i += 6) out.push(...(await Promise.all(branches.slice(i, i + 6).map(one))))
  // Las más viejas primero: son las primeras candidatas a borrar.
  return out.sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999') || a.name.localeCompare(b.name))
}
