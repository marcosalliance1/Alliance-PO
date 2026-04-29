import { useState, useMemo } from 'react'
import { Modal } from '../ui/Modal'
import type { ItemCatalogo, ItemCusto, TipoCusto } from '../../types'
import { Search, Plus } from 'lucide-react'
import { v4 as uuid } from '../../utils/uuid'

interface ModalBancoItensProps {
  open: boolean
  onClose: () => void
  itens: ItemCatalogo[]
  secaoNumero: string
  onAdicionar: (item: Partial<ItemCusto>) => void
}

export function ModalBancoItens({ open, onClose, itens, secaoNumero, onAdicionar }: ModalBancoItensProps) {
  const [busca, setBusca] = useState('')

  const itensFiltrados = useMemo(() => {
    const ativos = itens.filter((i) => i.ativo !== false)
    if (!busca.trim()) return ativos
    const lower = busca.toLowerCase()
    return ativos.filter(
      (i) =>
        i.item.toLowerCase().includes(lower) ||
        i.subcategoria.toLowerCase().includes(lower) ||
        i.area.toLowerCase().includes(lower),
    )
  }, [itens, busca])

  function handleAdicionar(item: ItemCatalogo) {
    onAdicionar({
      id: uuid(),
      codigo: item.codigo || '',
      area: item.area || '',
      subcategoria: item.subcategoria || '',
      item: item.item || '',
      fornecedor: item.fornecedorPadrao || '',
      tipoCusto: (item.tipoCusto as TipoCusto) || 'Custo Fixo',
      moscow: '',
      qtdeVendida: 0,
      valorUnitarioAtual: item.valorUnitarioReferencia || 0,
      totalAtual: 0,
      valorProjetado: item.valorUnitarioReferencia || 0,
      totalProjetado: 0,
      qtdeOrcada: 0,
      valorUnitarioOrcado: 0,
      valorOrcado: 0,
      qtdeContratada: 0,
      valorUnitarioContratado: 0,
      valorContratado: 0,
      responsavel: '',
      status: 'orçar',
      statusPagamento: 'N/A',
      valorFinal: 0,
      valorPago: 0,
      faltaPagar: 0,
      totalProgramado: 0,
      emAberto: 0,
      jotform: [],
    })
    onClose()
  }

  const itensDaSecao = useMemo(
    () => itensFiltrados.filter((i) => !i.secaoAplicavel?.length || i.secaoAplicavel.includes(secaoNumero)),
    [itensFiltrados, secaoNumero],
  )
  const outrosItens = useMemo(
    () => itensFiltrados.filter((i) => i.secaoAplicavel?.length && !i.secaoAplicavel.includes(secaoNumero)),
    [itensFiltrados, secaoNumero],
  )

  return (
    <Modal open={open} onClose={onClose} title="Adicionar do Banco de Itens" width="max-w-lg">
      <div className="space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            autoFocus
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar item, subcategoria ou área..."
            className="w-full pl-8 pr-3 py-2 text-sm bg-surface-2 border border-white/10 rounded-inner text-text-main placeholder:text-text-muted/50 focus:outline-none focus:border-primary"
          />
        </div>

        <div className="max-h-80 overflow-y-auto space-y-0.5 -mx-1 px-1">
          {itensDaSecao.length > 0 && (
            <>
              <p className="text-[10px] text-text-muted uppercase tracking-wide px-2 py-1 sticky top-0 bg-surface">
                Esta seção ({secaoNumero})
              </p>
              {itensDaSecao.map((item) => (
                <ItemRow key={item.id} item={item} onAdicionar={handleAdicionar} />
              ))}
            </>
          )}

          {outrosItens.length > 0 && (
            <>
              <p className="text-[10px] text-text-muted uppercase tracking-wide px-2 py-1 sticky top-0 bg-surface mt-2">
                Outros itens
              </p>
              {outrosItens.map((item) => (
                <ItemRow key={item.id} item={item} onAdicionar={handleAdicionar} />
              ))}
            </>
          )}

          {itensDaSecao.length === 0 && outrosItens.length === 0 && (
            <p className="text-text-muted text-sm text-center py-8">Nenhum item encontrado</p>
          )}
        </div>
      </div>
    </Modal>
  )
}

function ItemRow({ item, onAdicionar }: { item: ItemCatalogo; onAdicionar: (i: ItemCatalogo) => void }) {
  return (
    <button
      className="w-full text-left px-3 py-2 rounded-inner hover:bg-white/5 transition-colors group flex items-center gap-3"
      onClick={() => onAdicionar(item)}
    >
      <div className="flex-1 min-w-0">
        <p className="text-text-main text-xs font-medium truncate">{item.item}</p>
        <p className="text-text-muted text-[10px] truncate">{item.subcategoria} {item.area ? `· ${item.area}` : ''}</p>
      </div>
      <Plus size={14} className="text-text-muted group-hover:text-primary transition-colors shrink-0" />
    </button>
  )
}
