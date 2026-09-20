import { useEffect, useRef, useState } from 'react'
import { Upload, FileText, AlertTriangle, Eye, Trash2 } from 'lucide-react'
import { TopBar } from '../components/TopBar'
import { Button, Card, CardTitle, Pill } from '../components/ui'
import { useEntries } from '../hooks/useEntries'
import { useImports } from '../hooks/useImports'
import { parseOFX, type OfxParsed } from '../lib/ofx'
import { formatBRL, formatDateFull } from '../lib/format'
import { getErrorMessage } from '../lib/errors'
import type { Import } from '../lib/types'

type Preview = { filename: string; fileType: 'pdf' | 'ofx'; parsed: OfxParsed }

const PREVIEW_STORAGE_KEY = 'confere:import-preview'

function loadStoredPreview(): Preview | null {
  try {
    const raw = localStorage.getItem(PREVIEW_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Preview) : null
  } catch {
    return null
  }
}

export function ImportPage() {
  const { importFile } = useEntries()
  const { imports, viewImport, deleteImport } = useImports()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<Preview | null>(() => loadStoredPreview())
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [result, setResult] = useState<{ importedCount: number; matchedCount: number } | null>(null)
  const [rowBusyId, setRowBusyId] = useState<string | null>(null)

  // Guarda a prévia lida enquanto ela não é confirmada — trocar de aba,
  // a PWA atualizar sozinha em segundo plano, ou o navegador descartar a
  // aba não pode fazer você reimportar o arquivo do zero. O File original
  // não persiste aqui (não dá pra guardar em localStorage) — some se a
  // página recarregar antes de confirmar, mas os dados lidos continuam.
  useEffect(() => {
    if (preview) localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(preview))
    else localStorage.removeItem(PREVIEW_STORAGE_KEY)
  }, [preview])

  async function handleFile(file: File) {
    setError(null)
    setResult(null)
    setBusy(true)
    try {
      const isOfx = /\.ofx$/i.test(file.name)
      const isPdf = /\.pdf$/i.test(file.name)
      if (!isOfx && !isPdf) throw new Error('Envie um arquivo .OFX ou .PDF.')

      if (isOfx) {
        const text = await file.text()
        const parsed = parseOFX(text)
        if (parsed.entries.length === 0) throw new Error('Não consegui achar lançamentos nesse OFX.')
        setPreview({ filename: file.name, fileType: 'ofx', parsed })
      } else {
        const { parsePdfEntries } = await import('../lib/pdf')
        const parsed = await parsePdfEntries(file)
        if (parsed.entries.length === 0) throw new Error('Não consegui reconhecer linhas de lançamento nesse PDF — o layout pode ser diferente do esperado.')
        setPreview({ filename: file.name, fileType: 'pdf', parsed })
      }
      setPendingFile(file)
    } catch (err) {
      setError(getErrorMessage(err, 'Não consegui ler esse arquivo.'))
    } finally {
      setBusy(false)
    }
  }

  async function confirmImport() {
    if (!preview) return
    setBusy(true)
    try {
      const summary = await importFile(
        { filename: preview.filename, fileType: preview.fileType, cardOrBankLabel: preview.parsed.bankLabel, dueDate: preview.parsed.dueDate },
        preview.parsed,
        pendingFile
      )
      setResult(summary)
      setPreview(null)
      setPendingFile(null)
    } catch (err) {
      setError(getErrorMessage(err, 'Não consegui salvar os lançamentos.'))
    } finally {
      setBusy(false)
    }
  }

  async function handleView(imp: Import) {
    setRowBusyId(imp.id)
    try {
      await viewImport(imp)
    } catch (err) {
      setError(getErrorMessage(err, 'Não consegui abrir esse arquivo.'))
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
      setError(getErrorMessage(err, 'Não consegui excluir essa importação.'))
    } finally {
      setRowBusyId(null)
    }
  }

  return (
    <div className="pb-24">
      <TopBar title="Importar fatura ou extrato" subtitle="PDF do banco/cartão, ou o arquivo OFX" />

      <div className="px-4 flex flex-col gap-4">
        <Card className="p-5">
          <div
            className="border-[1.5px] border-dashed border-border-strong rounded-xl py-9 px-4 text-center flex flex-col items-center gap-2.5 bg-surface-2"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="w-11 h-11 rounded-xl bg-accent-soft flex items-center justify-center">
              <Upload size={20} className="text-accent-strong" />
            </div>
            <strong className="font-display text-[14.5px]">Toque pra escolher o arquivo</strong>
            <span className="text-[12px] text-text-faint max-w-[260px]">PDF baixado do app do banco/cartão, ou o OFX exportado do internet banking.</span>
            <div className="flex gap-1.5 mt-1">
              <Pill tone="neutral">.PDF</Pill>
              <Pill tone="neutral">.OFX</Pill>
            </div>
            <Button variant="primary" className="mt-2" disabled={busy}>
              {busy ? 'Lendo...' : 'Selecionar arquivo'}
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".ofx,.pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
              e.target.value = ''
            }}
          />

          {error && (
            <div className="mt-3 flex items-start gap-2 text-[12px] text-negative bg-negative-soft border border-negative/30 rounded-lg p-3">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}
          {result && (
            <div className="mt-3 text-[12.5px] text-positive bg-positive-soft border border-positive/30 rounded-lg p-3">
              Importado! {result.importedCount} lançamento{result.importedCount === 1 ? '' : 's'}
              {result.matchedCount > 0 && `, ${result.matchedCount} já casou com previsto`}
              . Vá em "Conciliar" pra revisar e classificar.
            </div>
          )}

          <p className="text-[11.5px] text-text-faint leading-relaxed mt-3">
            No OFX, data/valor/identificador já vêm estruturados — a leitura é confiável. No PDF a extração é por
            reconhecimento de texto (data + valor na mesma linha) e pode errar dependendo do layout do banco — sempre
            revise na tela de conciliação.
          </p>
        </Card>

        {preview && (
          <Card className="p-4 border-accent border-[1.5px]">
            <CardTitle>Prévia da leitura — {preview.filename}</CardTitle>
            <div className="grid grid-cols-2 gap-2.5 mb-3">
              <div className="rounded-lg bg-surface-2 border border-border p-2.5">
                <div className="text-[10px] font-bold uppercase text-text-faint">Lançamentos lidos</div>
                <div className="text-[14px] font-bold">{preview.parsed.entries.length}</div>
              </div>
              <div className="rounded-lg bg-surface-2 border border-border p-2.5">
                <div className="text-[10px] font-bold uppercase text-text-faint">Total do arquivo</div>
                <div className="text-[14px] font-bold font-mono">{preview.parsed.totalAmount ? formatBRL(preview.parsed.totalAmount) : '—'}</div>
              </div>
            </div>
            <div className="max-h-52 overflow-y-auto flex flex-col gap-1.5 mb-3">
              {preview.parsed.entries.slice(0, 8).map((e, i) => (
                <div key={i} className="flex items-center justify-between text-[12px] gap-2">
                  <span className="text-text-faint flex-shrink-0 font-mono">{formatDateFull(e.date).slice(0, 5)}</span>
                  <span className="truncate flex-1">{e.description}</span>
                  <span className={`font-mono flex-shrink-0 ${e.isCredit ? 'text-positive' : ''}`}>{e.isCredit ? '+ ' : ''}{formatBRL(e.amount)}</span>
                </div>
              ))}
              {preview.parsed.entries.length > 8 && <span className="text-[11px] text-text-faint">+ {preview.parsed.entries.length - 8} outros...</span>}
            </div>
            {!pendingFile && (
              <p className="text-[11px] text-warning mb-2">A página recarregou desde que você leu esse arquivo — vai importar os lançamentos normalmente, mas sem guardar o arquivo original pra visualizar depois.</p>
            )}
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1 justify-center" onClick={confirmImport} disabled={busy}>
                {busy ? 'Salvando...' : 'Confirmar importação'}
              </Button>
              <Button variant="ghost" onClick={() => { setPreview(null); setPendingFile(null) }} disabled={busy}>
                Cancelar
              </Button>
            </div>
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
