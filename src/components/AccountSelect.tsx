import { Building2, User } from 'lucide-react'
import type { Account, Owner } from '../accounts'

interface Props {
  owners: Owner[]
  value: Account
  onChange: (a: Account) => void
}

/** Elegir qué cuenta mirar: la personal, una organización o todas. */
export default function AccountSelect({ owners, value, onChange }: Props) {
  const total = owners.reduce((n, o) => n + o.count, 0)
  const current = owners.find((o) => o.login === value)
  const Icon = current && !current.personal ? Building2 : User
  return (
    <label className="account-select">
      <Icon size={16} aria-hidden="true" />
      <span className="sr-only">Cuenta</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {owners.map((o) => (
          <option key={o.login} value={o.login}>
            {o.login} {o.personal ? '(personal)' : ''} · {o.count}
          </option>
        ))}
        <option value="">Todas las cuentas · {total}</option>
      </select>
    </label>
  )
}
