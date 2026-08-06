import { useEffect, useRef, useState } from 'react'
import { Upload, FileText, AlertTriangle } from 'lucide-react'
import { TopBar } from '../components/TopBar'
import { Button, Card, CardTitle, Pill } from '../components/ui'
import { useEntries } from '../hooks/useEntries'
import { parseOFX, type OfxParsed } from '../lib/ofx'
import { formatBRL, formatDateFull } from '../lib/format'
import { getErrorMessage } from '../lib/errors'

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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<Preview | null>(() => loadStoredPreview())
  const [result, setResult] = useState<{ importedCount: number; matchedCount: number; skippedCount: number } | null>(null)

  // Guarda a prévia lida enquanto ela não é confirmada — trocar de aba,
  // a PWA atualizar sozinha em segundo plano, ou o navegador descartar a
  // aba não pode fazer você reimportar o arquivo do zero.
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
        preview.parsed
      )
      setResult(summary)
      setPreview(null)
    } catch (err) {
      setError(getErrorMessage(err, 'Não consegui salvar os lançamentos.'))
    } finally {
      setBusy(false)
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
              Importado! {result.importedCount} lançamento{result.importedCount === 1 ? '' : 's'} novo{result.importedCount === 1 ? '' : 's'}
              {result.matchedCount > 0 && `, ${result.matchedCount} já casou com previsto`}
              {result.skippedCount > 0 && ` · ${result.skippedCount} ignorado${result.skippedCount === 1 ? '' : 's'} por já existir (mesma data/valor/descrição)`}
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
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1 justify-center" onClick={confirmImport} disabled={busy}>
                {busy ? 'Salvando...' : 'Confirmar importação'}
              </Button>
              <Button variant="ghost" onClick={() => setPreview(null)} disabled={busy}>
                Cancelar
              </Button>
            </div>
          </Card>
        )}

        <div className="flex items-center gap-2 text-text-faint justify-center py-2">
          <FileText size={13} />
          <span className="text-[11.5px]">Depois de importar, os lançamentos aparecem em "Conciliar" pra você e a Ana classificarem.</span>
        </div>
      </div>
    </div>
  )
}
