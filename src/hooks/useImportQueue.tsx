import { createContext, useContext, useState, type ReactNode } from 'react'
import { useEntries } from './useEntries'
import { parseOFX, type OfxParsed } from '../lib/ofx'
import { getErrorMessage } from '../lib/errors'

export interface BatchItem {
  id: string
  file: File
  filename: string
  fileType: 'pdf' | 'ofx'
  status: 'reading' | 'ready' | 'parse-error' | 'importing' | 'done' | 'import-error'
  parsed?: OfxParsed
  error?: string
  result?: { importedCount: number; matchedCount: number }
}

interface ImportQueueContextValue {
  items: BatchItem[]
  confirming: boolean
  handleFiles: (files: FileList) => void
  removeItem: (id: string) => void
  confirmAll: () => Promise<void>
  clearQueue: () => void
}

const ImportQueueContext = createContext<ImportQueueContextValue | null>(null)

let nextId = 0

// Este provider fica acima das rotas (ver App.tsx), então navegar entre
// telas durante uma importação não desmonta esse estado nem interrompe o
// confirmAll em andamento — antes isso vivia dentro de ImportPage e trocar
// de tela no meio da importação apagava a fila e podia deixar o loop
// atualizando um componente que não existia mais.
export function ImportQueueProvider({ children }: { children: ReactNode }) {
  const { importFile } = useEntries()
  const [items, setItems] = useState<BatchItem[]>([])
  const [confirming, setConfirming] = useState(false)

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
    const accepted: BatchItem[] = []
    for (const file of Array.from(files)) {
      const isOfx = /\.ofx$/i.test(file.name)
      const isPdf = /\.pdf$/i.test(file.name)
      if (!isOfx && !isPdf) continue
      accepted.push({ id: String(nextId++), file, filename: file.name, fileType: isOfx ? 'ofx' : 'pdf', status: 'reading' })
    }
    if (accepted.length === 0) return
    setItems((prev) => [...prev, ...accepted])
    accepted.forEach(parseOne)
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id))
  }

  function clearQueue() {
    setItems([])
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

  return (
    <ImportQueueContext.Provider value={{ items, confirming, handleFiles, removeItem, confirmAll, clearQueue }}>
      {children}
    </ImportQueueContext.Provider>
  )
}

export function useImportQueue() {
  const ctx = useContext(ImportQueueContext)
  if (!ctx) throw new Error('useImportQueue precisa estar dentro de ImportQueueProvider')
  return ctx
}
