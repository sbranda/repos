// Armado y descarga de CSV. Usamos ";" como separador y BOM UTF-8: así Excel en español
// lo abre en columnas y con tildes bien, y Google Sheets / Numbers lo detectan solos.

import type { Repo, SearchItem } from './github'
import { CI_LABEL, type CiMap } from './ci'
import type { Alert } from './components/Security'

const SEP = ';'

/** Otras conclusiones de GitHub Actions, en castellano. */
const OTHER: Record<string, string> = { cancelled: 'Cancelado', skipped: 'Omitido', neutral: 'Neutral', action_required: 'Requiere acción', stale: 'Vencido' }

type Cell = string | number | boolean | null | undefined

function cell(v: Cell): string {
  if (v === null || v === undefined) return ''
  let s = typeof v === 'boolean' ? (v ? 'sí' : 'no') : String(v)
  // Evita que una planilla tome como fórmula un texto que empieza con = + - @ (inyección CSV).
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(headers: string[], rows: Cell[][]): string {
  return [headers, ...rows].map((r) => r.map(cell).join(SEP)).join('\r\n') + '\r\n'
}

/** Fecha local legible por planillas: "2026-11-28 14:05". */
export function fecha(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function download(filename: string, csv: string) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function fileName(kind: string, login: string): string {
  return `${kind}-${login}-${fecha(new Date().toISOString()).slice(0, 10)}.csv`
}

export function reposCsv(repos: Repo[], ci: CiMap = {}): string {
  return toCsv(
    [
      'Nombre',
      'Descripción',
      'Visibilidad',
      'Archivado',
      'Fork',
      'Lenguaje',
      'Etiquetas',
      'Estrellas',
      'Issues y PRs abiertos',
      'Sitio (Pages)',
      'Sitio web',
      'Rama principal',
      'GitHub Actions',
      'Último push',
      'Última actualización',
      'URL',
    ],
    repos.map((r) => [
      r.name,
      r.description,
      r.private ? 'privado' : 'público',
      r.archived,
      r.fork,
      r.language,
      (r.topics ?? []).join(', '),
      r.stargazers_count,
      r.open_issues_count,
      r.has_pages,
      r.homepage,
      r.default_branch,
      r.archived || !ci[r.id] ? '' : ci[r.id].kind === 'other' ? (OTHER[ci[r.id].conclusion ?? ''] ?? ci[r.id].conclusion ?? '') : CI_LABEL[ci[r.id].kind],
      fecha(r.pushed_at),
      fecha(r.updated_at),
      r.html_url,
    ]),
  )
}

export function pendientesCsv(items: (SearchItem & { kind: 'pr' | 'issue'; repoName: string })[]): string {
  return toCsv(
    ['Tipo', 'Repo', 'Número', 'Título', 'Borrador', 'Autor', 'Etiquetas', 'Comentarios', 'Creado', 'Última actividad', 'URL'],
    items.map((i) => [
      i.kind === 'pr' ? 'PR' : 'Issue',
      i.repoName,
      i.number,
      i.title,
      i.kind === 'pr' ? !!i.draft : '',
      i.user?.login,
      (i.labels ?? []).map((l) => l.name).join(', '),
      i.comments ?? 0,
      fecha(i.created_at),
      fecha(i.updated_at),
      i.html_url,
    ]),
  )
}

const GRAVEDAD = { critical: 'Crítica', high: 'Alta', medium: 'Media', low: 'Baja' } as const

export function alertasCsv(alerts: Alert[]): string {
  return toCsv(
    ['Gravedad', 'Repo', 'Paquete', 'Ecosistema', 'Resumen', 'Versiones afectadas', 'Arreglado en', 'Archivo', 'CVE', 'GHSA', 'Creada', 'URL'],
    alerts.map((a) => [
      GRAVEDAD[a.security_vulnerability?.severity ?? a.security_advisory.severity],
      a.repo.name,
      a.dependency.package.name,
      a.dependency.package.ecosystem,
      a.security_advisory.summary,
      a.security_vulnerability.vulnerable_version_range,
      a.security_vulnerability.first_patched_version?.identifier,
      a.dependency.manifest_path,
      a.security_advisory.cve_id,
      a.security_advisory.ghsa_id,
      fecha(a.created_at),
      a.html_url,
    ]),
  )
}
