import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import DOMPurify from 'dompurify'
import type { Repo } from '../github'

interface Props {
  html: string
  repo: Repo
}

/**
 * Muestra el README que GitHub ya convirtió a HTML. Antes de insertarlo lo pasamos por
 * DOMPurify (saca scripts, estilos y atributos peligrosos), y arreglamos los links e
 * imágenes relativos para que apunten al repo.
 */
export default function Readme({ html, repo }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [long, setLong] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const safe = useMemo(() => sanitize(html, repo), [html, repo])

  // Si el README es más alto que el recuadro, lo mostramos recortado con "Ver todo".
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const check = () => setLong(el.scrollHeight > COLLAPSED_HEIGHT + 40)
    check()
    const imgs = [...el.querySelectorAll('img')]
    imgs.forEach((i) => i.addEventListener('load', check))
    return () => imgs.forEach((i) => i.removeEventListener('load', check))
  }, [safe])

  return (
    <div className={`readme-wrap ${long && !expanded ? 'collapsed' : ''}`}>
      <div ref={ref} className="markdown" dangerouslySetInnerHTML={{ __html: safe }} />
      {long && (
        <button className="readme-toggle" onClick={() => setExpanded((e) => !e)}>
          {expanded ? 'Ver menos' : 'Ver todo el README'}
        </button>
      )}
    </div>
  )
}

const COLLAPSED_HEIGHT = 340

function sanitize(html: string, repo: Repo): string {
  const ref = encodeURIComponent(repo.default_branch)
  const rawBase = `https://raw.githubusercontent.com/${repo.full_name}/${ref}/`
  const blobBase = `https://github.com/${repo.full_name}/blob/${ref}/`

  const clean = DOMPurify.sanitize(html, {
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'iframe'],
    FORBID_ATTR: ['style'],
    RETURN_DOM: true,
  }) as HTMLElement

  for (const img of clean.querySelectorAll('img')) {
    const src = img.getAttribute('data-canonical-src') ?? img.getAttribute('src') ?? ''
    if (src && !isAbsolute(src)) img.setAttribute('src', new URL(src.replace(/^\.?\//, ''), rawBase).href)
    img.setAttribute('loading', 'lazy')
    img.removeAttribute('width')
    img.removeAttribute('height')
  }
  for (const a of clean.querySelectorAll('a')) {
    const href = a.getAttribute('href') ?? ''
    if (href.startsWith('#')) {
      // Las anclas internas del README no sirven dentro de la app.
      a.removeAttribute('href')
      continue
    }
    if (href && !isAbsolute(href)) a.setAttribute('href', new URL(href.replace(/^\.?\//, ''), blobBase).href)
    a.setAttribute('target', '_blank')
    a.setAttribute('rel', 'noreferrer noopener')
  }
  return clean.innerHTML
}

function isAbsolute(url: string) {
  return /^(https?:|mailto:|data:|\/\/)/i.test(url)
}
