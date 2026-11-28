// Atajos de teclado: "/" para buscar y flechas para moverse por la lista de repos.

import { useEffect } from 'react'

/** ¿El foco está en un lugar donde se escribe? Ahí los atajos no hacen nada. */
function typing(el: Element | null): boolean {
  if (!el) return false
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true
  if (el instanceof HTMLInputElement) return !['checkbox', 'radio', 'button', 'submit', 'reset'].includes(el.type)
  return (el as HTMLElement).isContentEditable
}

function visible(el: HTMLElement): boolean {
  return el.offsetParent !== null || el.getClientRects().length > 0
}

/** El buscador de la vista actual (repos, pendientes o seguridad). */
function searchBox(): HTMLInputElement | null {
  return [...document.querySelectorAll<HTMLInputElement>('input[type="search"]')].find(visible) ?? null
}

function rows(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('.repo-grid .repo-row')]
}

/** Cuántas tarjetas hay por fila en la grilla (1 en celular o con el detalle abierto). */
function columns(list: HTMLElement[]): number {
  if (!list.length) return 1
  const top = list[0].getBoundingClientRect().top
  const n = list.findIndex((r) => Math.abs(r.getBoundingClientRect().top - top) > 4)
  return n === -1 ? list.length : n
}

function focusRow(el: HTMLElement | undefined) {
  if (!el) return
  el.focus({ preventScroll: true })
  el.scrollIntoView({ block: 'nearest' })
}

export function useKeyboardShortcuts(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return
      if (document.querySelector('dialog[open]')) return
      const active = document.activeElement

      // "/" lleva al buscador desde cualquier lado, salvo mientras escribís.
      if (e.key === '/' && !typing(active)) {
        const box = searchBox()
        if (!box) return
        e.preventDefault()
        box.focus()
        box.select()
        return
      }

      // En el buscador de repos, flecha abajo baja a la lista.
      if (active instanceof HTMLInputElement && active.type === 'search' && active.closest('.filters:not(.inbox-filters)')) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          focusRow(rows()[0])
        } else if (e.key === 'Escape' && !active.value) {
          active.blur()
        }
        return
      }

      // Flechas sobre una tarjeta: moverse por la grilla. Inicio y Fin van a la primera y la última.
      if (!(active instanceof HTMLElement) || !active.classList.contains('repo-row')) return
      const list = rows()
      const i = list.indexOf(active)
      if (i === -1) return
      const cols = columns(list)
      const target: Record<string, number> = {
        ArrowDown: i + cols,
        ArrowUp: i - cols,
        ArrowRight: i + 1,
        ArrowLeft: i - 1,
        Home: 0,
        End: list.length - 1,
      }
      if (!(e.key in target)) return
      e.preventDefault()
      let next = target[e.key]
      // Arriba desde la primera fila vuelve al buscador.
      if (next < 0) {
        if (e.key === 'ArrowUp') searchBox()?.focus()
        return
      }
      if (next >= list.length) next = e.key === 'ArrowDown' ? list.length - 1 : i
      focusRow(list[next])
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [enabled])
}
