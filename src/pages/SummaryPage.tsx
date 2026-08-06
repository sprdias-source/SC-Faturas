import { useState } from 'react'
import { Volume2 } from 'lucide-react'
import { TopBar } from '../components/TopBar'
import { Avatar, Button, Card, CardTitle, KpiCard, SettingRow, Switch } from '../components/ui'
import { useAccounts } from '../hooks/useAccounts'
import { useAccountTotals } from '../hooks/useAccountTotals'
import { useActivityFeed } from '../hooks/useActivityFeed'
import { useHousehold } from '../hooks/useHousehold'
import { useAuth } from '../hooks/useAuth'
import { useNotificationSettings } from '../hooks/useNotificationSettings'
import { useActivityToasts } from '../hooks/useActivityToasts'
import { formatBRL, timeAgo, todayLocalISO } from '../lib/format'

export function SummaryPage() {
  const { accounts } = useAccounts()
  const monthPrefix = todayLocalISO().slice(0, 7)
  const { totals } = useAccountTotals(monthPrefix)
  const feed = useActivityFeed()
  const { members, household } = useHousehold()
  const { user } = useAuth()
  const { settings, update } = useNotificationSettings()
  const { testSound } = useActivityToasts()
  const [copied, setCopied] = useState(false)

  const total = Object.values(totals).reduce((s, v) => s + v, 0)
  const topAccounts = accounts
    .filter((a) => !a.parent_id)
    .map((a) => ({ ...a, total: totals[a.id] ?? 0 }))
    .sort((a, b) => b.total - a.total)
  const maxTotal = Math.max(1, ...topAccounts.map((a) => a.total))

  function actorName(userId: string) {
    if (userId === user?.id) return 'Você'
    return members.find((m) => m.user_id === userId)?.display_name ?? 'Alguém'
  }
  function actorColor(userId: string) {
    return members.find((m) => m.user_id === userId)?.avatar_color ?? '#2d3f6b'
  }

  async function copyInviteCode() {
    if (!household) return
    await navigator.clipboard.writeText(household.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="pb-24">
      <TopBar title="Resumo" subtitle={`Totais de ${monthPrefix}`} />

      <div className="px-4 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2.5">
          <KpiCard label="Total do mês" value={formatBRL(total)} sub="todas as contas" />
          <KpiCard label="Contas ativas" value={String(accounts.length)} />
        </div>

        <Card className="p-4">
          <CardTitle>Total por conta — {monthPrefix}</CardTitle>
          {topAccounts.length === 0 ? (
            <p className="text-[12.5px] text-text-faint py-3 text-center">Sem lançamentos classificados ainda este mês.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {topAccounts.map((a) => (
                <div key={a.id} className="flex items-center gap-2.5">
                  <span className="w-[92px] text-[12px] font-semibold truncate">{a.name}</span>
                  <div className="flex-1 h-2 rounded-full bg-surface-2 border border-border overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(a.total / maxTotal) * 100}%`, background: a.color }} />
                  </div>
                  <span className="w-[76px] text-right font-mono text-[11.5px]">{formatBRL(a.total)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <CardTitle>Atividade recente</CardTitle>
          {feed.length === 0 ? (
            <p className="text-[12.5px] text-text-faint py-3 text-center">Nada por aqui ainda.</p>
          ) : (
            <div className="flex flex-col">
              {feed.map((item) => (
                <div key={item.id} className="flex items-center gap-2.5 py-2.5 border-b border-dashed border-border last:border-none">
                  <Avatar name={actorName(item.user_id)} color={actorColor(item.user_id)} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-semibold truncate">
                      <b>{actorName(item.user_id)}</b> {item.detail}
                    </div>
                  </div>
                  <span className="text-[10.5px] text-text-faint flex-shrink-0">{timeAgo(item.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <CardTitle>Colaboração &amp; avisos</CardTitle>
          <div className="flex items-center gap-2.5 pb-3 border-b border-dashed border-border mb-1">
            <div className="flex -space-x-2">
              {members.map((m) => (
                <Avatar key={m.user_id} name={m.display_name} color={m.avatar_color} online />
              ))}
            </div>
            <p className="text-[11.5px] text-text-faint">
              Fatura compartilhada — contas e lançamentos aparecem atualizados pros dois em tempo real.
            </p>
          </div>

          {household && (
            <div className="flex items-center justify-between gap-2 py-2.5 border-b border-dashed border-border">
              <div>
                <div className="text-[12.5px] font-bold">Código de convite</div>
                <div className="text-[11px] text-text-faint">Compartilhe pra outra pessoa entrar nessa fatura</div>
              </div>
              <Button variant="ghost" onClick={copyInviteCode} className="font-mono">
                {copied ? 'Copiado!' : household.invite_code}
              </Button>
            </div>
          )}

          {settings && (
            <>
              <SettingRow label="Avisar quando o outro usuário lançar algo" sub="Mostra uma notificação no canto da tela">
                <Switch checked={settings.notify_visual} onChange={(v) => update({ notify_visual: v })} />
              </SettingRow>
              <SettingRow label="Tocar som ao receber o aviso" sub="Alerta curto, só com o app aberto">
                <Switch checked={settings.notify_sound} onChange={(v) => update({ notify_sound: v })} />
              </SettingRow>
              <SettingRow label="Avisar só sobre lançamentos novos" sub="Desmarcado, também avisa em edições/reclassificações">
                <Switch checked={settings.notify_only_new} onChange={(v) => update({ notify_only_new: v })} />
              </SettingRow>
            </>
          )}

          <Button variant="ghost" className="mt-3" onClick={testSound}>
            <Volume2 size={14} /> Testar som do aviso
          </Button>
        </Card>
      </div>
    </div>
  )
}
