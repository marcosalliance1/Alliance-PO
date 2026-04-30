import { useMemo, useCallback, useState } from 'react'
import type { SecaoCusto as TSecao, ItemCusto, ItemCatalogo } from '../../types'
import { LinhaItem } from './LinhaItem'
import { TotaisSecaoRow } from './TotaisSecao'
import { ModalBancoItens } from './ModalBancoItens'
import { calcTotaisSecao } from '../../utils/calculos'
import { formatBRL } from '../../utils/formatters'
import { Plus, BookOpen } from 'lucide-react'

interface SecaoCustoProps {
  secao: TSecao
  qtdFormandos: number
  bancoItens?: ItemCatalogo[]
  onAddItem: () => void
  onAddItemFromBanco?: (partial: Partial<ItemCusto>) => void
  onUpdateItem: (itemId: string, changes: Partial<ItemCusto>) => void
  onDeleteItem: (itemId: string) => void
  fornecedoresSugeridos?: string[]
}

const COLUNAS = [
  'Cód.', 'Área', 'MoSCoW', 'Custo', 'Sub Cat.', 'Item', 'Fornecedor',
  'Qtde V.', '$ Unit. Atual', 'Total Atual', '$ Proj.', 'Total Proj.',
  '|',
  'Qtde O.', '$ Unit. Orç.', 'Valor Orç.',
  '|',
  'Qtde C.', '$ Unit. Cont.', 'Valor Cont.',
  'Responsável', 'Status', 'Pgto.',
  'Vlr. Final', 'Vlr. Pago', 'Falta Pagar', 'Total Prog.', 'Em Aberto', '',
]

export function SecaoCusto({
  secao,
  qtdFormandos,
  bancoItens = [],
  onAddItem,
  onAddItemFromBanco,
  onUpdateItem,
  onDeleteItem,
  fornecedoresSugeridos = [],
}: SecaoCustoProps) {
  const [showBanco, setShowBanco] = useState(false)
  const totais = useMemo(() => calcTotaisSecao(secao, qtdFormandos), [secao, qtdFormandos])

  // Agrupar itens por área para exibir separadores
  const grupos = useMemo(() => {
    const map = new Map<string, ItemCusto[]>()
    for (const item of secao.itens) {
      const area = item.area || '(sem área)'
      if (!map.has(area)) map.set(area, [])
      map.get(area)!.push(item)
    }
    return Array.from(map.entries())
  }, [secao.itens])

  const handleUpdate = useCallback(
    (itemId: string, changes: Partial<ItemCusto>) => onUpdateItem(itemId, changes),
    [onUpdateItem],
  )

  return (
    <div className="overflow-x-auto rounded-inner shadow-card">
      {/* Legenda de cores */}
      <div className="flex items-center gap-4 px-3 py-1.5 bg-surface border-b border-white/5 text-[10px] text-text-muted">
        <span className="font-medium">Status:</span>
        {[
          { color: '#3B82F6', label: 'Vendido' },
          { color: '#EAB308', label: 'Orçado' },
          { color: '#16A34A', label: 'Contratado' },
          { color: '#10B981', label: 'Pago' },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>
      <table className="table-po">
        <thead>
          <tr>
            {COLUNAS.map((col, i) => (
              <th key={i} className={col === '|' ? 'px-1 text-white/20' : ''}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grupos.map(([area, itens]) => (
            <>
              {/* Linha separadora de área */}
              <tr key={`area-${area}`} className="row-area">
                <td colSpan={COLUNAS.length}>
                  {area}
                  <span className="ml-3 text-xs font-normal text-gray-500">
                    {itens.length} {itens.length === 1 ? 'item' : 'itens'} —{' '}
                    Vendido: {formatBRL(itens.reduce((s, i) => s + i.totalAtual, 0))} |{' '}
                    Orçado: {formatBRL(itens.reduce((s, i) => s + i.valorOrcado, 0))} |{' '}
                    Contratado: {formatBRL(itens.reduce((s, i) => s + i.valorContratado, 0))}
                  </span>
                </td>
              </tr>
              {itens.map((item) => (
                <LinhaItem
                  key={item.id}
                  item={item}
                  onChange={(changes) => handleUpdate(item.id, changes)}
                  onDelete={() => onDeleteItem(item.id)}
                  fornecedoresSugeridos={fornecedoresSugeridos}
                />
              ))}
            </>
          ))}

          {secao.itens.length === 0 && (
            <tr>
              <td colSpan={COLUNAS.length} className="text-center text-gray-400 py-4 italic text-xs">
                Nenhum item cadastrado. Clique em "+ Adicionar Item" para começar.
              </td>
            </tr>
          )}

          <TotaisSecaoRow totais={totais} nomeSecao={secao.nome} />
        </tbody>
      </table>

      <div className="bg-white px-4 py-2 border-t border-gray-100 flex gap-2">
        <button
          onClick={onAddItem}
          className="flex items-center gap-1.5 text-xs text-primary border border-primary/30 hover:bg-primary/5 px-3 py-1.5 rounded-inner transition-colors"
        >
          <Plus size={13} /> Adicionar Item
        </button>
        {bancoItens.length > 0 && onAddItemFromBanco && (
          <button
            onClick={() => setShowBanco(true)}
            className="flex items-center gap-1.5 text-xs text-text-muted border border-white/20 hover:border-primary/30 hover:text-primary px-3 py-1.5 rounded-inner transition-colors"
          >
            <BookOpen size={13} /> Adicionar do Banco de Itens
          </button>
        )}
      </div>

      {showBanco && onAddItemFromBanco && (
        <ModalBancoItens
          open={showBanco}
          onClose={() => setShowBanco(false)}
          itens={bancoItens}
          secaoNumero={secao.numero}
          onAdicionar={(partial) => { onAddItemFromBanco(partial); setShowBanco(false) }}
        />
      )}
    </div>
  )
}
