import React, { memo, useCallback, useRef, useState, useMemo } from 'react'
import { Plus, Trash2, Paperclip, Download, X, Eye, ChevronDown, ChevronRight, GripVertical } from 'lucide-react'
import type { ItemOrcamento, ItemStatus, NotaFiscal } from '../../types'
import { formatBRL, newItemId } from '../../utils/formatters'
import { recalcularItem } from '../../utils/automacoes'
import CampoMoeda from '../UI/CampoMoeda'
import MultiComboboxFornecedor from '../UI/MultiComboboxFornecedor'
import { useAppContext } from '../../contexts/AppContext'

interface Props {
  items: ItemOrcamento[]
  onChange: (items: ItemOrcamento[]) => void
  podeAdicionar?: boolean
  filtroFornecedor?: string // se setado, mostra só itens desse fornecedor
}

const STATUS_COLORS: Record<ItemStatus, string> = {
  PENDENTE:   'bg-warning/20 text-warning border-warning/30',
  CONTRATADO: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  PAGO:       'bg-success/20 text-success border-success/30',
}
const STATUS_LABELS: Record<ItemStatus, string> = {
  PENDENTE: 'Pendente', CONTRATADO: 'Contratado', PAGO: 'Pago',
}
const MAX_SIZE = 4 * 1024 * 1024

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1048576).toFixed(1)} MB`
}

function emptyItem(): ItemOrcamento {
  return {
    id: newItemId(), item: '', fornecedor: '', qtde: 1, custoUnitario: 0,
    totalOrcado: 0, totalPagoReal: 0, valorPassadoCliente: 0,
    bvAbsoluto: 0, bvPercentual: 0, status: 'PENDENTE',
    dataPagamento: null, notas: '', automatico: false, fixo: false,
  }
}

// ─── Célula NF ────────────────────────────────────────────────────────────────
const CelulaNotaFiscal: React.FC<{
  notaFiscal?: NotaFiscal
  onAnexar: (nf: NotaFiscal) => void
  onRemover: () => void
}> = ({ notaFiscal, onAnexar, onRemover }) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [erro, setErro] = useState('')

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_SIZE) {
      setErro('Máx. 4MB'); setTimeout(() => setErro(''), 3000); return
    }
    const reader = new FileReader()
    reader.onload = () => onAnexar({ nome: file.name, tipo: file.type, dados: reader.result as string, tamanho: file.size })
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function handleDownload() {
    if (!notaFiscal) return
    const a = document.createElement('a'); a.href = notaFiscal.dados; a.download = notaFiscal.nome; a.click()
  }

  function handleVisualizar() {
    if (!notaFiscal) return
    const w = window.open()
    if (w) {
      if (notaFiscal.tipo === 'application/pdf')
        w.document.write(`<iframe src="${notaFiscal.dados}" width="100%" height="100%" style="border:none"></iframe>`)
      else
        w.document.write(`<img src="${notaFiscal.dados}" style="max-width:100%" />`)
    }
  }

  if (notaFiscal) return (
    <div className="flex items-center gap-1 min-w-0">
      <span className="text-[10px] text-success truncate max-w-[80px] cursor-pointer hover:underline"
        title={`${notaFiscal.nome} (${formatBytes(notaFiscal.tamanho)})`} onClick={handleVisualizar}>
        {notaFiscal.nome}
      </span>
      <button onClick={handleVisualizar} className="text-muted hover:text-white transition-colors shrink-0 min-w-[20px] min-h-[20px] flex items-center justify-center" title="Visualizar"><Eye className="w-3 h-3" /></button>
      <button onClick={handleDownload} className="text-muted hover:text-blue-400 transition-colors shrink-0 min-w-[20px] min-h-[20px] flex items-center justify-center" title="Baixar"><Download className="w-3 h-3" /></button>
      <button onClick={onRemover} className="text-muted hover:text-danger transition-colors shrink-0 min-w-[20px] min-h-[20px] flex items-center justify-center" title="Remover NF"><X className="w-3 h-3" /></button>
    </div>
  )

  return (
    <div className="flex flex-col items-start">
      <button onClick={() => inputRef.current?.click()}
        className="flex items-center gap-1 text-[10px] text-muted hover:text-accent transition-colors border border-dashed border-bordercol hover:border-accent/50 rounded px-1.5 py-0.5">
        <Paperclip className="w-3 h-3" /> Anexar
      </button>
      {erro && <span className="text-[9px] text-danger mt-0.5">{erro}</span>}
      <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handleFile} />
    </div>
  )
}

// ─── Linha de item ────────────────────────────────────────────────────────────
const LinhaItem: React.FC<{
  item: ItemOrcamento
  idx: number
  indentado?: boolean
  fornecedores: string[]
  onUpdate: (id: string, field: keyof ItemOrcamento, val: string | number) => void
  onUpdateNF: (id: string, nf: NotaFiscal | undefined) => void
  onRemove: (id: string) => void
  onDragStartRow: (id: string) => void
  onDragOverRow: (id: string) => void
  onDropRow: (id: string) => void
  onDragEndRow: () => void
  isDragging: boolean
  isOver: boolean
}> = ({ item, idx, indentado = false, fornecedores, onUpdate, onUpdateNF, onRemove,
       onDragStartRow, onDragOverRow, onDropRow, onDragEndRow, isDragging, isOver }) => {
  const tdBase   = 'px-2 py-1.5 text-xs text-gray-300 border-b border-bordercol'
  const inputCls = 'w-full bg-transparent text-xs text-white outline-none border border-transparent hover:border-bordercol focus:border-accent rounded px-1 py-0.5 transition-colors'
  const numCls   = `${inputCls} text-right`

  function handleRemove() {
    if (window.confirm(`Tem certeza que deseja remover "${item.item || 'este item'}"?`)) {
      onRemove(item.id)
    }
  }

  return (
    <tr
      className={`hover:bg-white/[0.02] group transition-colors ${isDragging ? 'opacity-40' : ''} ${isOver ? 'border-t-2 border-accent' : ''}`}
      onDragOver={e => { e.preventDefault(); onDragOverRow(item.id) }}
      onDrop={e => { e.preventDefault(); onDropRow(item.id) }}
    >
      {/* # / badge AUTO — vira puxador (arrastar pra reordenar) no hover */}
      <td className={`${tdBase} text-center relative`}>
        <span className="group-hover:opacity-0 transition-opacity">
          {item.automatico
            ? <span className="inline-block bg-accent/20 text-accent border border-accent/30 rounded px-1 text-[10px] font-bold">A</span>
            : <span className="text-muted">{idx + 1}</span>
          }
        </span>
        <span
          draggable
          onDragStart={() => onDragStartRow(item.id)}
          onDragEnd={onDragEndRow}
          className="absolute inset-0 hidden group-hover:flex items-center justify-center cursor-grab active:cursor-grabbing text-muted hover:text-white"
          title="Arrastar pra reordenar"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </span>
      </td>
      {/* Item */}
      <td className={tdBase}>
        <div className={indentado ? 'pl-3 border-l-2 border-accent/30' : ''}>
          <input className={inputCls} value={item.item}
            onChange={e => onUpdate(item.id, 'item', e.target.value)} placeholder="Item" />
        </div>
      </td>
      {/* Fornecedor — multi-combobox */}
      <td className={tdBase}>
        <MultiComboboxFornecedor
          value={item.fornecedor}
          onChange={v => onUpdate(item.id, 'fornecedor', v)}
          fornecedores={fornecedores}
          placeholder="Fornecedor"
        />
      </td>
      {/* Qtde — min 70px */}
      <td className={tdBase} style={{ minWidth: 70 }}>
        <input type="number" min={0} style={{ minWidth: 60 }}
          className={numCls} value={item.qtde || ''}
          onChange={e => onUpdate(item.id, 'qtde', Number(e.target.value))} />
      </td>
      {/* Custo Unit. */}
      <td className={tdBase} style={{ minWidth: 140 }}>
        <CampoMoeda value={item.custoUnitario} onChange={v => onUpdate(item.id, 'custoUnitario', v)} className={numCls} />
      </td>
      {/* Total Orç. */}
      <td className={`${tdBase} text-right text-gray-400`}>{formatBRL(item.totalOrcado)}</td>
      {/* Total Pago */}
      <td className={tdBase}>
        <CampoMoeda value={item.totalPagoReal} onChange={v => onUpdate(item.id, 'totalPagoReal', v)} className={numCls} />
      </td>
      {/* Val. Cliente */}
      <td className={tdBase}>
        <CampoMoeda value={item.valorPassadoCliente} onChange={v => onUpdate(item.id, 'valorPassadoCliente', v)} className={numCls} />
      </td>
      {/* BV R$ */}
      <td className={`${tdBase} text-right font-semibold ${item.bvAbsoluto >= 0 ? 'text-success' : 'text-danger'}`}>
        {formatBRL(item.bvAbsoluto)}
      </td>
      {/* BV % */}
      <td className={`${tdBase} text-right font-semibold ${item.bvPercentual >= 0 ? 'text-success' : 'text-danger'}`}>
        {item.bvPercentual.toFixed(1)}%
      </td>
      {/* Status */}
      <td className={`${tdBase} text-center`}>
        <select value={item.status} onChange={e => onUpdate(item.id, 'status', e.target.value)}
          className={`text-[10px] border rounded px-1 py-0.5 outline-none cursor-pointer bg-surface ${STATUS_COLORS[item.status]}`}>
          {(Object.keys(STATUS_LABELS) as ItemStatus[]).map(s => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
      </td>
      {/* Data Pgto. */}
      <td className={tdBase}>
        <input
          type="date"
          className={`${inputCls} text-center`}
          value={item.dataPagamento ?? ''}
          onChange={e => onUpdate(item.id, 'dataPagamento', e.target.value)}
          title="Data de Pagamento"
        />
      </td>
      {/* NF */}
      <td className={tdBase}>
        <CelulaNotaFiscal notaFiscal={item.notaFiscal}
          onAnexar={nf => onUpdateNF(item.id, nf)} onRemover={() => onUpdateNF(item.id, undefined)} />
      </td>
      {/* Notas */}
      <td className={tdBase}>
        <input className={inputCls} value={item.notas}
          onChange={e => onUpdate(item.id, 'notas', e.target.value)} placeholder="Observações" />
      </td>
      {/* Excluir */}
      <td className={`${tdBase} text-center`}>
        <button
          onClick={handleRemove}
          className="opacity-0 group-hover:opacity-100 text-danger/70 hover:text-danger transition-all min-w-[28px] min-h-[28px] flex items-center justify-center mx-auto"
          title="Remover linha"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  )
}

// ─── Tabela Principal ─────────────────────────────────────────────────────────
const TabelaItens: React.FC<Props> = ({ items, onChange, podeAdicionar = true, filtroFornecedor }) => {
  const { fornecedores } = useAppContext()
  // Itens exibidos (aplica o filtro de fornecedor). Edições/add/remove usam `items` cheio.
  const itemsView = useMemo(() => {
    if (!filtroFornecedor) return items
    return items.filter(i => (i.fornecedor || '').split('||').map(f => f.trim()).includes(filtroFornecedor))
  }, [items, filtroFornecedor])
  const [gruposAbertos, setGruposAbertos] = useState<Set<string>>(new Set(['Time Alliance']))

  const toggleGrupo = (g: string) =>
    setGruposAbertos(prev => { const n = new Set(prev); n.has(g) ? n.delete(g) : n.add(g); return n })

  const update = useCallback((id: string, field: keyof ItemOrcamento, raw: string | number) => {
    onChange(items.map(item => item.id !== id ? item : recalcularItem({ ...item, [field]: raw })))
  }, [items, onChange])

  const updateNF = useCallback((id: string, nf: NotaFiscal | undefined) => {
    onChange(items.map(item => item.id === id ? { ...item, notaFiscal: nf } : item))
  }, [items, onChange])

  const addRow    = useCallback(() => onChange([...items, emptyItem()]), [items, onChange])
  const removeRow = useCallback((id: string) => onChange(items.filter(i => i.id !== id)), [items, onChange])

  // ─── Reordenar linhas por arrastar (drag & drop) ───
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const onDragStartRow = useCallback((id: string) => setDragId(id), [])
  const onDragOverRow  = useCallback((id: string) => setOverId(prev => (prev === id ? prev : id)), [])
  const onDragEndRow   = useCallback(() => { setDragId(null); setOverId(null) }, [])
  const onDropRow = useCallback((targetId: string) => {
    if (dragId && dragId !== targetId) {
      const from = items.findIndex(i => i.id === dragId)
      const to   = items.findIndex(i => i.id === targetId)
      // Só reordena dentro do mesmo contexto (itens soltos entre si, ou dentro do mesmo grupo).
      if (from !== -1 && to !== -1 && (items[from].grupo ?? '') === (items[to].grupo ?? '')) {
        const copy = [...items]
        const [movido] = copy.splice(from, 1)
        copy.splice(to, 0, movido)
        onChange(copy)
      }
    }
    setDragId(null); setOverId(null)
  }, [dragId, items, onChange])

  const totOrcado  = itemsView.reduce((s, i) => s + i.totalOrcado, 0)
  const totPago    = itemsView.reduce((s, i) => s + i.totalPagoReal, 0)
  const totCliente = itemsView.reduce((s, i) => s + i.valorPassadoCliente, 0)
  const totBV      = itemsView.reduce((s, i) => s + i.bvAbsoluto, 0)
  const totBVPct   = totPago > 0 ? (totBV / totPago) * 100 : 0

  type RenderRow =
    | { kind: 'header'; grupo: string; children: ItemOrcamento[] }
    | { kind: 'item'; item: ItemOrcamento; idx: number; indentado: boolean }

  const rows = useMemo<RenderRow[]>(() => {
    const list: RenderRow[] = []
    const seen = new Set<string>()
    let nonGroupIdx = 0
    for (const item of itemsView) {
      if (item.grupo) {
        if (!seen.has(item.grupo)) {
          seen.add(item.grupo)
          list.push({ kind: 'header', grupo: item.grupo, children: itemsView.filter(i => i.grupo === item.grupo) })
        }
        if (gruposAbertos.has(item.grupo))
          list.push({ kind: 'item', item, idx: nonGroupIdx++, indentado: true })
      } else {
        list.push({ kind: 'item', item, idx: nonGroupIdx++, indentado: false })
      }
    }
    return list
  }, [itemsView, gruposAbertos])

  const thCls = 'px-2 py-2 text-left text-muted font-medium text-xs'

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs" style={{ minWidth: 1250 }}>
        <thead>
          <tr className="bg-surface2/50">
            <th className={`${thCls} w-8`}>#</th>
            <th className={`${thCls} min-w-[130px]`}>Item</th>
            <th className={`${thCls} min-w-[140px]`}>Fornecedor</th>
            <th className={`${thCls} text-right`} style={{ minWidth: 70 }}>Qtde</th>
            <th className={`${thCls} text-right`} style={{ minWidth: 140 }}>Custo Unit.</th>
            <th className={`${thCls} w-28 text-right`}>Total Orç.</th>
            <th className={`${thCls} w-28 text-right`}>Total Pago</th>
            <th className={`${thCls} w-28 text-right`}>Val. Cliente</th>
            <th className={`${thCls} w-24 text-right`}>BV R$</th>
            <th className={`${thCls} w-14 text-right`}>BV %</th>
            <th className={`${thCls} w-24 text-center`}>Status</th>
            <th className={`${thCls} w-24 text-center`}>Data Pgto.</th>
            <th className={thCls} style={{ minWidth: 110 }}><span className="flex items-center gap-1"><Paperclip className="w-3 h-3" />NF</span></th>
            <th className={`${thCls} min-w-[90px]`}>Notas</th>
            <th className="px-2 py-2 w-8"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => {
            if (row.kind === 'header') {
              const aberto = gruposAbertos.has(row.grupo)
              const gOrcado = row.children.reduce((s, i) => s + i.totalOrcado, 0)
              const gPago   = row.children.reduce((s, i) => s + i.totalPagoReal, 0)
              const gBV     = row.children.reduce((s, i) => s + i.bvAbsoluto, 0)
              return (
                <tr key={`grp-${row.grupo}-${ri}`} className="bg-surface2/60 cursor-pointer select-none"
                  onClick={() => toggleGrupo(row.grupo)}>
                  <td colSpan={2} className="px-2 py-2 text-xs">
                    <div className="flex items-center gap-2">
                      {aberto ? <ChevronDown className="w-3.5 h-3.5 text-accent shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-accent shrink-0" />}
                      <span className="text-white font-semibold">{row.grupo}</span>
                      <span className="text-muted text-[10px]">({row.children.length} itens)</span>
                    </div>
                  </td>
                  <td colSpan={3} className="px-2 py-2"></td>
                  <td className="px-2 py-2 text-xs text-right text-gray-400">{formatBRL(gOrcado)}</td>
                  <td className="px-2 py-2 text-xs text-right text-gray-400">{formatBRL(gPago)}</td>
                  <td className="px-2 py-2"></td>
                  <td className={`px-2 py-2 text-xs text-right font-semibold ${gBV >= 0 ? 'text-success' : 'text-danger'}`}>{formatBRL(gBV)}</td>
                  <td colSpan={6}></td>
                </tr>
              )
            }
            return (
              <LinhaItem
                key={row.item.id}
                item={row.item}
                idx={row.idx}
                indentado={row.indentado}
                fornecedores={fornecedores}
                onUpdate={update}
                onUpdateNF={updateNF}
                onRemove={removeRow}
                onDragStartRow={onDragStartRow}
                onDragOverRow={onDragOverRow}
                onDropRow={onDropRow}
                onDragEndRow={onDragEndRow}
                isDragging={dragId === row.item.id}
                isOver={overId === row.item.id && dragId !== row.item.id}
              />
            )
          })}
        </tbody>
        <tfoot>
          <tr className="bg-surface2/80 font-semibold">
            <td colSpan={5} className="px-2 py-2 text-xs text-muted text-right">SUBTOTAL</td>
            <td className="px-2 py-2 text-xs text-right text-white">{formatBRL(totOrcado)}</td>
            <td className="px-2 py-2 text-xs text-right text-white">{formatBRL(totPago)}</td>
            <td className="px-2 py-2 text-xs text-right text-white">{formatBRL(totCliente)}</td>
            <td className={`px-2 py-2 text-xs text-right font-bold ${totBV >= 0 ? 'text-success' : 'text-danger'}`}>{formatBRL(totBV)}</td>
            <td className={`px-2 py-2 text-xs text-right font-bold ${totBVPct >= 0 ? 'text-success' : 'text-danger'}`}>{totBVPct.toFixed(1)}%</td>
            <td colSpan={5}></td>
          </tr>
        </tfoot>
      </table>

      {podeAdicionar && (
        <button onClick={addRow} className="mt-3 flex items-center gap-2 text-accent text-xs hover:text-accent/80 transition-colors">
          <Plus className="w-4 h-4" /> Adicionar linha
        </button>
      )}
    </div>
  )
}

export default memo(TabelaItens)
