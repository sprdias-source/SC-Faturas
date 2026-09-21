import { useRef, useState } from 'react'
import { Upload, FileText, AlertTriangle, Eye, Trash2, X, Check, Loader2 } from 'lucide-react'
import { TopBar } from '../components/TopBar'
import { Button, Card, CardTitle, Pill } from '../components/ui'
import { useEntries } from '../hooks/useEntries'
import { useImports } from '../hooks/useImports'
import { parseOFX, type OfxParsed } from '../lib/ofx'
import { formatBRL, formatDateFull } from '../lib/format'
import { getErrorMessage } from '../lib/errors'
import type { Import } from '../lib/types'

interface BatchItem {
  id: string
  file: File
  filename: string
  fileType: 'pdf' | 'ofx'
  status: 'reading' | 'ready' | 'parse-error' | 'importing' | 'done' | 'import-error'
  parsed?: OfxParsed
  error?: string
  result?: { importedCount: number; matchedCount: number }
}

let nextId = 0

export function ImportPage() {
  const { importFile } = useEntries()
  const { imports, viewImport, deleteImport } = useImports()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<BatchItem[]>([])
  const [confirming, setConfirming] = useState(false)
  const [rowBusyId, setRowBusyId] = useState<string | null>(null)
  const [listError, setListError] = useState<string | null>(null)

  function updateItem(id: string, patch: Partial<BatchItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }

  async function parseOne(item: BatchItem) {
    try {
      if (item.fileType === 'ofx') {
        const text = await item.file.text()
        const parsed = parseOFX(text)
        if (parsed.entries.length === 0) throw new Error('Não achei lançamentos nesse OFX.')
        updateItem(item.id, { status: 'ready', parsed })
      } else {
        const { parsePdfEntries } = await import('../lib/pdf')
        const parsed = await parsePdfEntries(item.file)
        if (parsed.entries.length === 0) throw new Error('Não reconheci linhas de lançamento nesse PDF.')
        updateItem(item.id, { status: 'ready', parsed })
      }
    } catch (err) {
      updateItem(item.id, { status: 'parse-error', error: getErrorMessage(err, 'Não consegui ler esse arquivo.') })
    }
  }

  function handleFiles(files: FileList) {
    setListError(null)
    const accepted: BatchItem[] = []
    for (const file of Array.from(files)) {
      const isOfx = /\.ofx$/i.test(file.name)
      const isPdf = /\.pdf$/i.test(file.name)
      if (!isOfx && !isPdf) continue
      accepted.push({ id: String(nextId++), file, filename: file.name, fileType: isOfx ? 'ofx' : 'pdf', status: 'reading' })
    }
    if (accepted.length === 0) {
      setListError('Nenhum arquivo .OFX ou .PDF selecionado.')
      return
    }
    setItems((prev) => [...prev, ...accepted])
    accepted.forEach(parseOne)
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id))
  }

  async function confirmAll() {
    setConfirming(true)
    // Um de cada vez — mantém a barra de progresso legível e evita que a
    // checagem de "fatura já importada" de dois arquivos corra em paralelo.
    for (const item of items) {
      if (item.status !== 'ready') continue
      updateItem(item.id, { status: 'importing' })
      try {
        const parsed = item.parsed!
        const result = await importFile(
          { filename: item.filename, fileType: item.fileType, cardOrBankLabel: parsed.bankLabel, dueDate: parsed.dueDate },
          parsed,
          item.file
        )
        updateItem(item.id, { status: 'done', result })
      } catch (err) {
        updateItem(item.id, { status: 'import-error', error: getErrorMessage(err, 'Não consegui salvar esse arquivo.') })
      }
    }
    setConfirming(false)
  }

  async function handleView(imp: Import) {
    setRowBusyId(imp.id)
    try {
      await viewImport(imp)
    } catch (err) {
      setListError(getErrorMessage(err, 'Não consegui abrir esse arquivo.'))
    } finally {
      setRowBusyId(null)
    }
  }

  async function handleDelete(imp: Import) {
    if (!confirm(`Excluir "${imp.filename}"? Isso apaga também os ${imp.entries_count} lançamentos que vieram dela (mesmo os já classificados/confirmados). Não dá pra desfazer.`)) return
    setRowBusyId(imp.id)
    try {
      await deleteImport(imp)
    } catch (err) {
      setListError(getErrorMessage(err, 'Não consegui excluir essa importação.'))
    } finally {
      setRowBusyId(null)
    }
  }

  const readyCount = items.filter((i) => i.status === 'ready').length
  const doneCount = items.filter((i) => i.status === 'done').length
  const anyPending = items.some((i) => i.status === 'reading')
  const finishedBatch = items.length > 0 && items.every((i) => i.status === 'done' || i.status === 'import-error')

  return (
    <div className="pb-24">
      <TopBar title="Importar fatura ou extrato" subtitle="PDF do banco/cartão, ou o arquivo OFX — pode selecionar vários de uma vez" />

      <div className="px-4 flex flex-col gap-4">
        <Card className="p-5">
          <div
            className="border-[1.5px] border-dashed border-border-strong rounded-xl py-9 px-4 text-center flex flex-col items-center gap-2.5 bg-surface-2"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="w-11 h-11 rounded-xl bg-accent-soft flex items-center justify-center">
              <Upload size={20} className="text-accent-strong" />
            </div>
            <strong className="font-display text-[14.5px]">Toque pra escolher os arquivos</strong>
            <span className="text-[12px] text-text-faint max-w-[260px]">PDF baixado do app do banco/cartão, ou o OFX exportado do internet banking. Pode marcar vários arquivos de uma vez.</span>
            <div className="flex gap-1.5 mt-1">
              <Pill tone="neutral">.PDF</Pill>
              <Pill tone="neutral">.OFX</Pill>
            </div>
            <Button variant="primary" className="mt-2">
              Selecionar arquivos
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".ofx,.pdf"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files)
              e.target.value = ''
            }}
          />

          {listError && (
            <div className="mt-3 flex items-start gap-2 text-[12px] text-negative bg-negative-soft border border-negative/30 rounded-lg p-3">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              {listError}
            </div>
          )}

          <p className="text-[11.5px] text-text-faint leading-relaxed mt-3">
            No OFX, data/valor/identificador já vêm estruturados — a leitura é confiável. No PDF a extração é por
            reconhecimento de texto (data + valor na mesma linha) e pode errar dependendo do layout do banco — sempre
            revise na tela de conciliação. Uma fatura com o mesmo vencimento (ou arquivo com o mesmo nome) já
            importada antes é recusada automaticamente, pra nunca duplicar.
          </p>
        </Card>

        {items.length > 0 && (
          <Card className="p-4 border-accent border-[1.5px]">
            <CardTitle tag={`${items.length} arquivo${items.length === 1 ? '' : 's'}`}>Fila de importação</CardTitle>

            <div className="flex flex-col gap-2 mb-3">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-surface-2 border border-border">
                  <div className="w-7 h-7 rounded-md bg-surface border border-border-strong flex items-center justify-center flex-shrink-0">
                    {item.status === 'reading' || item.status === 'importing' ? (
                      <Loader2 size={13} className="text-text-faint animate-spin" />
                    ) : item.status === 'done' ? (
                      <Check size={13} className="text-positive" />
                    ) : item.status === 'ready' ? (
                      <FileText size={13} className="text-text-faint" />
                    ) : (
                      <AlertTriangle size={13} className="text-negative" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-bold truncate">{item.filename}</div>
                    {item.status === 'reading' && <div className="text-[10.5px] text-text-faint">Lendo...</div>}
                    {item.status === 'ready' && item.parsed && (
                      <div className="text-[10.5px] text-text-faint">
                        {item.parsed.entries.length} lançamentos{item.parsed.totalAmount ? ` · ${formatBRL(item.parsed.totalAmount)}` : ''}
                        {item.parsed.dueDate && ` · venc. ${item.parsed.dueDate.split('-').reverse().join('/')}`}
                      </div>
                    )}
                    {item.status === 'importing' && <div className="text-[10.5px] text-text-faint">Salvando...</div>}
                    {item.status === 'done' && item.result && (
                      <div className="text-[10.5px] text-positive">
                        {item.result.importedCount} lançamentos importados{item.result.matchedCount > 0 && `, ${item.result.matchedCount} casaram com previsto`}
                        {item.parsed?.dueDate && ` · venc. ${item.parsed.dueDate.split('-').reverse().join('/')}`}
                      </div>
                    )}
                    {(item.status === 'parse-error' || item.status === 'import-error') && <div className="text-[10.5px] text-negative">{item.error}</div>}
                  </div>
                  {(item.status === 'ready' || item.status === 'parse-error' || item.status === 'import-error') && (
                    <button onClick={() => removeItem(item.id)} className="w-6 h-6 rounded-md text-text-faint hover:text-negative flex items-center justify-center flex-shrink-0" title="Remover da fila">
                      <X size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {finishedBatch ? (
              <Button variant="ghost" className="w-full justify-center" onClick={() => setItems([])}>
                Limpar fila ({doneCount} importado{doneCount === 1 ? '' : 's'})
              </Button>
            ) : (
              <Button variant="primary" className="w-full justify-center" onClick={confirmAll} disabled={confirming || anyPending || readyCount === 0}>
                {confirming ? 'Importando...' : anyPending ? 'Lendo arquivos...' : `Confirmar ${readyCount} importaç${readyCount === 1 ? 'ão' : 'ões'}`}
              </Button>
            )}
          </Card>
        )}

        <Card className="p-4">
          <CardTitle>Importações</CardTitle>
          {imports.length === 0 ? (
            <p className="text-[12.5px] text-text-faint py-3 text-center">Nenhuma fatura ou extrato importado ainda.</p>
          ) : (
            <div className="flex flex-col">
              {imports.map((imp) => (
                <div key={imp.id} className="flex items-center gap-2.5 py-2.5 border-b border-dashed border-border last:border-none">
                  <div className="w-8 h-8 rounded-lg bg-surface-2 border border-border-strong flex items-center justify-center flex-shrink-0">
                    <FileText size={14} className="text-text-faint" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-bold truncate">{imp.card_or_bank_label ?? imp.filename}</div>
                    <div className="text-[11px] text-text-faint">
                      {imp.due_date && <span className="font-bold text-text-muted">Venc. {formatDateFull(imp.due_date)}</span>}
                      {imp.due_date && ' · '}
                      {imp.entries_count} lançamentos{imp.total_amount ? ` · ${formatBRL(imp.total_amount)}` : ''}
                    </div>
                  </div>
                  <button
                    onClick={() => handleView(imp)}
                    disabled={rowBusyId === imp.id || !imp.storage_path}
                    className="w-7 h-7 rounded-md border border-border-strong text-text-faint flex items-center justify-center flex-shrink-0 disabled:opacity-30"
                    title={imp.storage_path ? 'Ver arquivo original' : 'Arquivo original não disponível'}
                  >
                    <Eye size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(imp)}
                    disabled={rowBusyId === imp.id}
                    className="w-7 h-7 rounded-md border border-negative/40 text-negative flex items-center justify-center flex-shrink-0 disabled:opacity-30"
                    title="Excluir importação"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="flex items-center gap-2 text-text-faint justify-center py-2">
          <FileText size={13} />
          <span className="text-[11.5px]">Depois de importar, os lançamentos aparecem em "Conciliar" pra você e a Ana classificarem.</span>
        </div>
      </div>
    </div>
  )
}
