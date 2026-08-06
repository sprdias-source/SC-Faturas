import { X } from 'lucide-react'
import { useActivityToasts } from '../hooks/useActivityToasts'
import { Avatar } from './ui'

export function ToastStack() {
  const { toasts, dismiss } = useActivityToasts()
  if (toasts.length === 0) return null

  return (
    <div className="fixed right-3 z-[60] flex flex-col gap-2 max-w-[320px]" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)' }}>
      {toasts.map((t) => (
        <div key={t.id} className="bg-surface border border-border-strong border-l-[3px] border-l-accent rounded-xl px-3 py-2.5 shadow-lg flex gap-2.5 items-start animate-in fade-in slide-in-from-bottom-2">
          <Avatar name={t.authorName} color={t.authorColor} />
          <div className="flex-1 text-[12px] leading-snug">
            <div>
              <b>{t.authorName}</b> {t.detail}
            </div>
            <div className="text-[10px] text-text-faint mt-0.5">agora</div>
          </div>
          <button onClick={() => dismiss(t.id)} className="text-text-faint flex-shrink-0" title="Dispensar">
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}
