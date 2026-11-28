import { useEffect, useRef } from 'react'

interface Props {
  title: string
  children: React.ReactNode
  confirmLabel: string
  danger?: boolean
  busy?: boolean
  busyLabel?: string
  /** Deshabilita el botón de confirmar (por ejemplo, si falta elegir algo). */
  confirmDisabled?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Diálogo de confirmación que se muestra antes de cualquier cambio en GitHub. */
export default function ConfirmDialog({ title, children, confirmLabel, danger, busy, busyLabel, confirmDisabled, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      className="dialog"
      onCancel={(e) => {
        e.preventDefault()
        if (!busy) onCancel()
      }}
    >
      <h2>{title}</h2>
      <div className="dialog-body">{children}</div>
      <div className="dialog-actions">
        <button onClick={onCancel} disabled={busy}>
          Cancelar
        </button>
        <button className={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={busy || confirmDisabled}>
          {busy ? (busyLabel ?? 'Aplicando…') : confirmLabel}
        </button>
      </div>
    </dialog>
  )
}
