import { useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type LabelHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import clsx from 'clsx'

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('bg-surface border border-border rounded-xl', className)}>{children}</div>
}

export function CardTitle({ children, tag }: { children: ReactNode; tag?: string }) {
  return (
    <h3 className="font-display text-[15px] font-bold mb-3 flex items-center gap-2">
      {children}
      {tag && (
        <span className="font-sans text-[9.5px] font-bold uppercase tracking-wider text-text-faint border border-dashed border-border-strong rounded px-1.5 py-px">
          {tag}
        </span>
      )}
    </h3>
  )
}

export function Button({
  className,
  variant = 'ghost',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  return (
    <button
      className={clsx(
        'font-bold text-[12.5px] rounded-lg px-4 py-2.5 inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition disabled:opacity-40',
        variant === 'primary' && 'bg-accent text-surface hover:bg-accent-strong',
        variant === 'ghost' && 'border border-border-strong text-text-muted hover:border-accent hover:text-text',
        variant === 'danger' && 'border border-negative/40 text-negative hover:bg-negative-soft',
        className
      )}
      {...props}
    />
  )
}

export function IconButton({ className, active, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      className={clsx(
        'w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 transition',
        active ? 'bg-accent-soft border border-accent text-accent-strong' : 'border border-dashed border-border-strong text-text-faint hover:border-accent hover:text-accent-strong',
        className
      )}
      {...props}
    />
  )
}

export function Pill({ tone = 'neutral', children }: { tone?: 'positive' | 'warning' | 'accent' | 'neutral'; children: ReactNode }) {
  const tones = {
    positive: 'bg-positive-soft text-positive border-positive/40',
    warning: 'bg-warning-soft text-warning border-warning/40',
    accent: 'bg-accent-soft text-accent-strong border-border-strong',
    neutral: 'bg-surface-2 text-text-muted border-border',
  }
  return (
    <span className={clsx('inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-md border whitespace-nowrap', tones[tone])}>
      {children}
    </span>
  )
}

export function Stamp({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold px-2.5 py-1 rounded-full bg-surface-2 border-[1.5px] border-dashed border-border-strong">
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
      {children}
    </span>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10.5px] font-bold text-text-faint uppercase tracking-wide">{label}</label>
      {children}
    </div>
  )
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        'text-[13px] font-semibold bg-surface-2 text-text border border-border-strong rounded-lg px-3 py-2 w-full outline-none focus:ring-2 focus:ring-accent',
        className
      )}
      {...props}
    />
  )
}

export function PasswordInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        className={clsx(
          'text-[13px] font-semibold bg-surface-2 text-text border border-border-strong rounded-lg pl-3 pr-10 py-2 w-full outline-none focus:ring-2 focus:ring-accent',
          className
        )}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-faint hover:text-text-muted"
        aria-label={visible ? 'Esconder senha' : 'Mostrar senha'}
        tabIndex={-1}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={clsx(
        'text-[13px] font-semibold bg-surface-2 text-text border border-border-strong rounded-lg px-3 py-2 w-full outline-none focus:ring-2 focus:ring-accent',
        className
      )}
      {...props}
    />
  )
}

export function Switch({ checked, onChange, ...props }: { checked: boolean; onChange: (v: boolean) => void } & Omit<LabelHTMLAttributes<HTMLLabelElement>, 'onChange'>) {
  return (
    <label className="relative inline-flex w-[38px] h-[22px] flex-shrink-0 cursor-pointer" {...props}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="absolute opacity-0 w-full h-full cursor-pointer peer" />
      <span className="absolute inset-0 rounded-full bg-border-strong transition peer-checked:bg-accent" />
      <span className="absolute w-4 h-4 left-[3px] top-[3px] bg-surface rounded-full shadow transition peer-checked:translate-x-4" />
    </label>
  )
}

export function SettingRow({ label, sub, children }: { label: string; sub?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3.5 py-3 border-b border-dashed border-border last:border-none">
      <div>
        <div className="text-[12.5px] font-bold">{label}</div>
        {sub && <div className="text-[11px] text-text-faint mt-0.5">{sub}</div>}
      </div>
      {children}
    </div>
  )
}

export function Avatar({ name, color, online }: { name: string; color: string; online?: boolean }) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <div className="relative w-7 h-7 rounded-full flex items-center justify-center text-[10.5px] font-extrabold text-white border-2 border-surface flex-shrink-0" style={{ background: color }} title={name}>
      {initials}
      {online && <span className="absolute -bottom-px -right-px w-2 h-2 rounded-full bg-positive border-2 border-surface" />}
    </div>
  )
}

export function KpiCard({ label, value, sub, tone = 'neutral' }: { label: string; value: string; sub?: string; tone?: 'positive' | 'warning' | 'accent' | 'negative' | 'neutral' }) {
  const tones = {
    positive: 'text-positive',
    warning: 'text-warning',
    accent: 'text-accent-strong',
    negative: 'text-negative',
    neutral: 'text-text',
  }
  return (
    <div className="rounded-xl p-3.5 bg-surface border border-border flex flex-col gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-text-faint">{label}</span>
      <span className={clsx('font-mono tabular-nums font-bold text-xl', tones[tone])}>{value}</span>
      {sub && <span className="text-[11px] text-text-faint">{sub}</span>}
    </div>
  )
}
