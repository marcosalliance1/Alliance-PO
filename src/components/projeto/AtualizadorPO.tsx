import { useState, useRef } from 'react'
import { Modal } from '../ui/Modal'
import { ProgressBar } from '../ui/ProgressBar'
import { importarXlsx } from '../../utils/importadorXlsx'
import type { Projeto, ItemCusto } from '../../types'
import { Upload, AlertTriangle, CheckCircle } from 'lucide-react'

interface AtualizadorPOProps {
  projetoAtual: Projeto
  onClose: () => void
  onAtualizado: (projeto: Projeto) => void
}

type Estado = 'idle' | 'reading' | 'done' | 'error'

function mergeSecoes(projetoAtual: Projeto, projetoNovo: Projeto): Projeto['secoes'] {
  return projetoNovo.secoes.map((secaoNova) => {
    const secaoAtual = projetoAtual.secoes.find((s) => s.numero === secaoNova.numero)
    if (!secaoAtual) return secaoNova

    const itensComPago: ItemCusto[] = secaoNova.itens.map((itemNovo) => {
      // Preservar valorPago de item existente (match por subcategoria + item)
      const itemAtual = secaoAtual.itens.find(
        (ia) =>
          ia.subcategoria === itemNovo.subcategoria &&
          ia.item === itemNovo.item,
      )
      if (itemAtual && itemAtual.valorPago > 0) {
        return { ...itemNovo, valorPago: itemAtual.valorPago, faltaPagar: itemNovo.valorFinal - itemAtual.valorPago }
      }
      return itemNovo
    })

    return { ...secaoNova, itens: itensComPago }
  })
}

function calcDiff(projetoAtual: Projeto, projetoNovo: Projeto) {
  let atualizados = 0, adicionados = 0, removidos = 0
  for (const secaoNova of projetoNovo.secoes) {
    const secaoAtual = projetoAtual.secoes.find((s) => s.numero === secaoNova.numero)
    for (const itemNovo of secaoNova.itens) {
      const existe = secaoAtual?.itens.find(
        (ia) => ia.subcategoria === itemNovo.subcategoria && ia.item === itemNovo.item,
      )
      if (existe) atualizados++
      else adicionados++
    }
    if (secaoAtual) {
      for (const itemAtual of secaoAtual.itens) {
        const ainda = secaoNova.itens.find(
          (in_) => in_.subcategoria === itemAtual.subcategoria && in_.item === itemAtual.item,
        )
        if (!ainda) removidos++
      }
    }
  }
  return { atualizados, adicionados, removidos }
}

export function AtualizadorPO({ projetoAtual, onClose, onAtualizado }: AtualizadorPOProps) {
  const [estado, setEstado] = useState<Estado>('idle')
  const [progresso, setProgresso] = useState(0)
  const [avisos, setAvisos] = useState<string[]>([])
  const [erro, setErro] = useState('')
  const [projetoMergeado, setProjetoMergeado] = useState<Projeto | null>(null)
  const [diff, setDiff] = useState<{ atualizados: number; adicionados: number; removidos: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setEstado('idle'); setProgresso(0); setAvisos([]); setErro(''); setProjetoMergeado(null); setDiff(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setEstado('reading'); setProgresso(20)
    try {
      const buffer = await file.arrayBuffer()
      setProgresso(60)
      const { projeto: projetoNovo, avisos: av } = importarXlsx(buffer, file.name)
      setProgresso(90)
      const secoesAtualizadas = mergeSecoes(projetoAtual, projetoNovo)
      const merged: Projeto = {
        ...projetoAtual,
        tap: projetoNovo.tap,
        secoes: secoesAtualizadas,
        importadoDe: file.name,
        atualizadoEm: new Date().toISOString(),
      }
      setDiff(calcDiff(projetoAtual, projetoNovo))
      setAvisos(av)
      setProjetoMergeado(merged)
      setEstado('done'); setProgresso(100)
    } catch (err) {
      setEstado('error')
      setErro(err instanceof Error ? err.message : 'Erro ao importar arquivo.')
    }
  }

  const titulo = projetoAtual.tap.turma || projetoAtual.tap.instituicao || 'Projeto'

  return (
    <Modal open onClose={onClose} title={`Atualizar P.O. — ${titulo}`} width="max-w-md">
      {estado === 'idle' && (
        <div className="space-y-4">
          <p className="text-text-muted text-sm">
            Selecione a versão atualizada do arquivo Excel. Os valores pagos inseridos manualmente serão preservados.
          </p>
          <div
            className="border-2 border-dashed border-white/20 rounded-inner p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => inputRef.current?.click()}
          >
            <Upload size={32} className="mx-auto text-text-muted mb-2" />
            <p className="text-text-muted text-sm">Clique para selecionar o arquivo</p>
            <p className="text-text-muted text-xs mt-1">.xlsx, .xls</p>
          </div>
          <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
        </div>
      )}

      {estado === 'reading' && (
        <div className="py-6 space-y-4">
          <p className="text-text-muted text-sm text-center">Processando arquivo...</p>
          <ProgressBar value={progresso} label="Progresso" />
        </div>
      )}

      {estado === 'done' && projetoMergeado && diff && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-success">
            <CheckCircle size={20} />
            <span className="font-medium text-sm">Arquivo processado com sucesso!</span>
          </div>

          <div className="bg-surface-2 rounded-inner p-3 text-sm space-y-1.5">
            <div className="flex justify-between">
              <span className="text-text-muted">Itens atualizados:</span>
              <span className="text-text-main font-medium">{diff.atualizados}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Itens adicionados:</span>
              <span className="text-success font-medium">{diff.adicionados}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Itens removidos:</span>
              <span className={diff.removidos > 0 ? 'text-warning font-medium' : 'text-text-main font-medium'}>{diff.removidos}</span>
            </div>
          </div>

          {avisos.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-inner p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-yellow-700 text-xs font-medium">
                <AlertTriangle size={14} /> Avisos
              </div>
              {avisos.map((a, i) => <p key={i} className="text-yellow-700 text-xs">{a}</p>)}
            </div>
          )}

          <p className="text-text-muted text-xs italic">
            Os valores pagos inseridos manualmente foram preservados nos itens correspondentes.
          </p>

          <div className="flex gap-3 justify-end pt-2">
            <button className="btn-secondary" onClick={reset}>Cancelar</button>
            <button className="btn-primary" onClick={() => { onAtualizado(projetoMergeado); onClose() }}>Salvar Atualização</button>
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
