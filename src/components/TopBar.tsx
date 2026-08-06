import type { ReactNode } from 'react'
import { useHousehold } from '../hooks/useHousehold'
import { useAuth } from '../hooks/useAuth'
import { Avatar } from './ui'

export function TopBar({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  const { members } = useHousehold()
  const { user } = useAuth()

  return (
    <header className="safe-top px-4 pt-4 pb-3 flex items-start justify-between gap-3 sticky top-0 bg-bg/95 backdrop-blur z-40">
      <div>
        <h1 className="font-display font-bold text-[19px] leading-tight tracking-tight">{title}</h1>
        {subtitle && <p className="text-text-muted text-[12.5px] mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {action}
        <div className="flex items-center -space-x-2">
          {members.map((m) => (
            <Avatar key={m.user_id} name={m.display_name} color={m.avatar_color} online={m.user_id === user?.id} />
          ))}
        </div>
      </div>
    </header>
  )
}
