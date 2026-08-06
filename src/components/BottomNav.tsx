import { NavLink } from 'react-router-dom'
import { Upload, PlusCircle, CheckSquare, Wallet, LayoutGrid } from 'lucide-react'
import clsx from 'clsx'

const ITEMS = [
  { to: '/importar', label: 'Importar', icon: Upload },
  { to: '/manuais', label: 'Manuais', icon: PlusCircle },
  { to: '/conciliar', label: 'Conciliar', icon: CheckSquare },
  { to: '/contas', label: 'Contas', icon: Wallet },
  { to: '/resumo', label: 'Resumo', icon: LayoutGrid },
]

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-surface border-t border-border safe-bottom">
      <div className="grid grid-cols-5 max-w-lg mx-auto">
        {ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx('flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-bold', isActive ? 'text-accent-strong' : 'text-text-faint')
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={19} strokeWidth={isActive ? 2.5 : 2} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
