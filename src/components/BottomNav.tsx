import { NavLink } from 'react-router-dom'
import { Upload, PlusCircle, CheckSquare, Wallet, LayoutGrid } from 'lucide-react'
import clsx from 'clsx'
import { useImportQueue } from '../hooks/useImportQueue'

const ITEMS = [
  { to: '/importar', label: 'Importar', icon: Upload },
  { to: '/manuais', label: 'Manuais', icon: PlusCircle },
  { to: '/conciliar', label: 'Conciliar', icon: CheckSquare },
  { to: '/contas', label: 'Contas', icon: Wallet },
  { to: '/resumo', label: 'Resumo', icon: LayoutGrid },
]

export function BottomNav() {
  const { confirming } = useImportQueue()

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-surface border-t border-border safe-bottom">
      <div className="grid grid-cols-5 max-w-lg mx-auto">
        {ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx('relative flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-bold', isActive ? 'text-accent-strong' : 'text-text-faint')
            }
          >
            {({ isActive }) => (
              <>
                <span className="relative">
                  <Icon size={19} strokeWidth={isActive ? 2.5 : 2} />
                  {confirming && to === '/importar' && (
                    <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-accent-strong animate-pulse" title="Importando em segundo plano" />
                  )}
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
