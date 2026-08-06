import { Select } from './ui'
import type { Account } from '../lib/types'
import { buildAccountTree } from '../hooks/useAccounts'

export function AccountSelect({
  accounts,
  value,
  onChange,
  className,
}: {
  accounts: Account[]
  value: string
  onChange: (accountId: string) => void
  className?: string
}) {
  const tree = buildAccountTree(accounts)

  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} className={className}>
      <option value="" disabled>
        Escolher conta...
      </option>
      {tree.map((node) =>
        node.children.length > 0 ? (
          <optgroup key={node.id} label={node.name}>
            <option value={node.id}>{node.name} (geral)</option>
            {node.children.map((child) => (
              <option key={child.id} value={child.id}>
                {child.name}
              </option>
            ))}
          </optgroup>
        ) : (
          <option key={node.id} value={node.id}>
            {node.name}
          </option>
        )
      )}
    </Select>
  )
}
