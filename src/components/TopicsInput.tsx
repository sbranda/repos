import { useId, useState } from 'react'
import { Tag, X } from 'lucide-react'
import { MAX_TOPICS, normalizeTopic } from '../topics'

interface Props {
  value: string[]
  onChange: (topics: string[]) => void
  /** Etiquetas que ya usás en otros repos, para sugerirlas. */
  known: string[]
}

/** Campo de etiquetas: escribís y con Enter o coma queda agregada. Los espacios pasan a ser guiones. */
export default function TopicsInput({ value, onChange, known }: Props) {
  const [text, setText] = useState('')
  const listId = useId()
  const full = value.length >= MAX_TOPICS
  const preview = normalizeTopic(text)

  function add(raw: string) {
    const parts = raw.split(',').map(normalizeTopic).filter(Boolean)
    const next = [...value]
    for (const t of parts) if (!next.includes(t) && next.length < MAX_TOPICS) next.push(t)
    if (next.length !== value.length) onChange(next)
    setText('')
  }

  return (
    <div className="topics-input">
      <ul className="topic-list">
        {value.map((t) => (
          <li key={t} className="topic">
            {t}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Quitar etiqueta ${t}`}>
              <X size={12} />
            </button>
          </li>
        ))}
        {!value.length && <li className="muted small">Sin etiquetas</li>}
      </ul>
      <div className="topic-entry">
        <Tag size={15} className="muted" aria-hidden="true" />
        <input
          value={text}
          list={listId}
          disabled={full}
          placeholder={full ? `Máximo ${MAX_TOPICS} etiquetas` : 'Agregar etiqueta y Enter'}
          aria-label="Agregar etiqueta"
          onChange={(e) => {
            const v = e.target.value
            // La coma cierra la etiqueta (sirve también para pegar varias juntas).
            if (v.includes(',')) add(v)
            else setText(v)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (text.trim()) add(text)
            } else if (e.key === 'Backspace' && !text && value.length) {
              onChange(value.slice(0, -1))
            }
          }}
          onBlur={() => text.trim() && add(text)}
        />
        <datalist id={listId}>
          {known
            .filter((t) => !value.includes(t))
            .map((t) => (
              <option key={t} value={t} />
            ))}
        </datalist>
      </div>
      {text.trim() && preview !== text.trim() && (
        <p className="muted small">{preview ? <>Se va a guardar como <code>{preview}</code></> : 'Usá letras, números o guiones.'}</p>
      )}
    </div>
  )
}
