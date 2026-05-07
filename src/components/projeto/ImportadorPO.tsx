import { useState, useRef } from 'react'
import { Modal } from '../ui/Modal'
import { ProgressBar } from '../ui/ProgressBar'
import { importarXlsx } from '../../utils/importadorXlsx'
import type { Projeto } from '../../types'
import { Upload, AlertTriangle, CheckCircle } from 'lucide-react'

interface ImportadorPOProps {
  open: boolean
  onClose: () => void
  onImported: (projeto: Projeto) => void
}

type Estado = 'idle' | 'reading' | 'done' | 'error'

export function ImportadorPO({ open, onClose, onImported }: ImportadorPOProps) {
  const [estado, setEstado] = useState<Estado>('idle')
  const [progresso, setProgresso] = useState(0)
  const [avisos, setAvisos] = useState<string[]>([])
  const [erro, setErro] = useState('')
  const [projetoImportado, setProjetoImportado] = useState<Projeto | null>(null)
  const [totalDivergencias, setTotalDivergencias] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setEstado('idle')
    setProgresso(0)
    setAvisos([])
    setErro('')
    setProjetoImportado(null)
    setTotalDivergencias(0)
    if (inputRef.current) inputRef.current.value = ''
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setEstado('reading')
    setProgresso(20)

    try {
      const buffer = await file.arrayBuffer()
      setProgresso(60)
      const { projeto, avisos: av, totalDivergencias: totalDiv } = importarXlsx(buffer, file.name)
      setProgresso(90)
      setAvisos(av)
      setTotalDivergencias(totalDiv)
      setProjetoImportado(projeto)
      setEstado('done')
      setProgresso(100)
    } catch (err) {
      setEstado('error')
      setErro(err instanceof Error ? err.message : 'Erro ao importar arquivo.')
    }
  }

  function confirmar() {
    if (!projetoImportado) return
    onImported(projetoImportado)
    handleClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Importar P.O. (.xlsx)" width="max-w-md">
      {estado === 'idle' && (
        <div className="space-y-4">
          <p className="text-text-muted text-sm">
            Selecione um arquivo .xlsx exportado do Excel. O sistema irá criar um novo projeto com todos os dados importados.
          </p>
          <div
            className="border-2 border-dashed border-white/20 rounded-inner p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => inputRef.current?.click()}
          >
            <Upload size={32} className="mx-auto text-text-muted mb-2" />
            <p className="text-text-muted text-sm">Clique para selecionar o arquivo</p>
            <p className="text-text-muted text-xs mt-1">.xlsx, .xls</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFile}
          />
        </div>
      )}

      {estado === 'reading' && (
        <div className="py-6 space-y-4">
          <p className="text-text-muted text-sm text-center">Lendo arquivo...</p>
          <ProgressBar value={progresso} label="Progresso" />
        </div>
      )}

      {estado === 'done' && projetoImportado && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-success">
            <CheckCircle size={20} />
            <span className="font-medium text-sm">Arquivo lido com sucesso!</span>
          </div>

          <div className="bg-surface-2 rounded-inner p-3 text-sm space-y-1">
            <div className="text-text-muted">
              <span className="text-text-main font-medium">Instituição:</span> {projetoImportado.tap.instituicao || '—'}
            </div>
            <div className="text-text-muted">
              <span className="text-text-main font-medium">Turma:</span> {projetoImportado.tap.turma || '—'}
            </div>
            <div className="text-text-muted">
              <span className="text-text-main font-medium">Tipo:</span> {projetoImportado.tap.tipoEscola}
            </div>
            <div className="text-text-muted">
              <span className="text-text-main font-medium">Seções importadas:</span> {projetoImportado.secoes.filter((s) => s.itens.length > 0).length}
            </div>
            <div className="text-text-muted">
              <span className="text-text-main font-medium">Total de itens:</span> {projetoImportado.secoes.reduce((s, sec) => s + sec.itens.length, 0)}
            </div>
          </div>

          {totalDivergencias > 0 && (
            <div className="rounded-inner p-2.5" style={{ background: '#1A1D2E', border: '1px solid #EA580C' }}>
              <span className="text-xs" style={{ color: '#EA580C' }}>
                {totalDivergencias} {totalDivergencias === 1 ? 'item com' : 'itens com'} divergência de totais — valores marcados em laranja na tabela.
              </span>
            </div>
          )}

          {avisos.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-inner p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-yellow-700 text-xs font-medium">
                <AlertTriangle size={14} /> Avisos
              </div>
              {avisos.map((a, i) => (
                <p key={i} className="text-yellow-700 text-xs">{a}</p>
              ))}
            </div>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <button className="btn-secondary" onClick={reset}>Cancelar</button>
            <button className="btn-primary" onClick={confirmar}>Criar Projeto</button>
          </div>
        </div>
      )}

      {estado === 'error' && (
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-inner p-3 text-red-700 text-sm">
            <strong>Erro:</strong> {erro}
          </div>
          <button className="btn-secondary w-full" onClick={reset}>Tentar novamente</button>
        </div>
      )}
    </Modal>
  )
}
