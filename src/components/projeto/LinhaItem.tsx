import { useState, useCallback } from 'react'
import type { ItemCusto, StatusItem, StatusPagamento, TipoCusto } from '../../types'
import { Trash2 } from 'lucide-react'
import { formatBRL } from '../../utils/formatters'
import { useAuth } from '../../contexts/AuthContext'

interface LinhaItemProps {
  item: ItemCusto
  onChange: (changes: Partial<ItemCusto>) => void
  onDelete: () => void
  fornecedoresSugeridos?: string[]
}

const STATUS_OPTS: StatusItem[] = ['orçar', 'orçando', 'estimado', 'fechado', 'N/A']
const PGTO_OPTS: StatusPagamento[] = ['N/A', 'em aberto', 'parcial', 'pago']
const TIPO_CUSTO_OPTS: TipoCusto[] = ['Custo Fixo', 'Custo Variável']
const MOSCOW_OPTS = ['', 'M', 'S', 'C', 'W']

function Td({ children, className = '', style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <td className={className} style={style}>{children}</td>
}

// Formato "contabilidade" (R$ grudado à esquerda, número grudado à direita) — alinha as
// casas decimais verticalmente entre linhas, igual planilha. Não renderiza nada em zero,
// pra manter a tabela limpa (mesmo comportamento de antes).
export function ValorContabil({ value, className = '', style, title }: {
  value: number; className?: string; style?: React.CSSProperties; title?: string
}) {
  if (!value) return null
  const sinal = value < 0 ? '-' : ''
  const abs = Math.abs(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return (
    <span className={`flex items-baseline justify-between gap-1 tabular-nums w-full min-w-[84px] ${className}`} style={style} title={title}>
      <span className="opacity-50">{sinal}R$</span>
      <span>{abs}</span>
    </span>
  )
}

// Cor vem só do status de planejamento — orçar fica sem cor (branco), o resto segue a
// legenda oficial: orçando=amarelo, estimado=azul, fechado=verde.
function getStickyBg(item: ItemCusto): string {
  switch (item.status) {
    case 'orçando': return '#fffbeb'
    case 'estimado': return '#eff6ff'
    case 'fechado': return '#f0fdf4'
    default: return '#ffffff'
  }
}

function NumInput({ value, onChange, readOnly }: { value: number; onChange: (v: number) => void; readOnly?: boolean }) {
  const [editing, setEditing] = useState(false)
  const [raw, setRaw] = useState('')

  function startEdit() {
    if (readOnly) return
    setEditing(true)
    setRaw(value === 0 ? '' : String(value).replace('.', ','))
  }

  function commit() {
    setEditing(false)
    const n = parseFloat(raw.replace(',', '.')) || 0
    onChange(n)
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Tab') commit() }}
        style={{ width: '80px', textAlign: 'right' }}
      />
    )
  }
  return (
    <span
      className={`block w-full rounded px-1 ${readOnly ? '' : 'cursor-pointer hover:bg-blue-50'}`}
      onClick={startEdit}
    >
      <ValorContabil value={value} />
    </span>
  )
}

function QtyInput({ value, onChange, readOnly }: { value: number; onChange: (v: number) => void; readOnly?: boolean }) {
  return (
    <input
      type="number"
      value={value || ''}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      style={{ width: '50px', textAlign: 'right' }}
      readOnly={readOnly}
      disabled={readOnly}
    />
  )
}

function TextInput({ value, onChange, placeholder = '', width = '100px', readOnly }: {
  value: string; onChange: (v: string) => void; placeholder?: string; width?: string; readOnly?: boolean
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ width }}
      readOnly={readOnly}
      disabled={readOnly}
    />
  )
}

function isDivCol(item: ItemCusto, coluna: string): boolean {
  return item.divergenciaDetalhe?.some((d) => d.coluna === coluna) ?? false
}

function divTitle(item: ItemCusto, coluna: string): string {
  const d = item.divergenciaDetalhe?.find((x) => x.coluna === coluna)
  if (!d) return ''
  return `${coluna}: ${d.qtde} × ${formatBRL(d.unitario)} = ${formatBRL(d.totalCalculado)} | Planilha: ${formatBRL(d.totalPlanilha)}`
}

// Mesma regra de getStickyBg, só que pra linha inteira (cor mais forte) — orçar sem cor.
function getRowStyle(item: ItemCusto): React.CSSProperties {
  switch (item.status) {
    case 'orçando': return { backgroundColor: 'rgba(234,179,8,0.08)', borderLeft: '3px solid #EAB308' }
    case 'estimado': return { backgroundColor: 'rgba(59,130,246,0.08)', borderLeft: '3px solid #3B82F6' }
    case 'fechado': return { backgroundColor: 'rgba(22,163,74,0.08)', borderLeft: '3px solid #16A34A' }
    default: return {}
  }
}

export function LinhaItem({ item, onChange, onDelete, fornecedoresSugeridos = [] }: LinhaItemProps) {
  const { isAdmin } = useAuth()
  const ro = !isAdmin

  const upd = useCallback(
    (changes: Partial<ItemCusto>) => onChange(changes),
    [onChange],
  )

  const bg = getStickyBg(item)
  const fixed = (cls: string) => ({ className: `col-fixed ${cls}`, style: { backgroundColor: bg } })

  return (
    <tr style={getRowStyle(item)}>
      <Td {...fixed('col-0')}><TextInput value={item.codigo} onChange={(v) => upd({ codigo: v })} width="60px" readOnly={ro} /></Td>
      <Td {...fixed('col-1')}><TextInput value={item.area} onChange={(v) => upd({ area: v })} width="80px" readOnly={ro} /></Td>
      <Td {...fixed('col-2')}>
        <select value={item.moscow} onChange={(e) => upd({ moscow: e.target.value })} style={{ width: '50px' }} disabled={ro}>
          {MOSCOW_OPTS.map((o) => <option key={o} value={o}>{o || '—'}</option>)}
        </select>
      </Td>
      <Td {...fixed('col-3')}>
        <select value={item.tipoCusto} onChange={(e) => upd({ tipoCusto: e.target.value as TipoCusto })} style={{ width: '90px' }} disabled={ro}>
          {TIPO_CUSTO_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </Td>
      <Td {...fixed('col-4')}><TextInput value={item.subcategoria} onChange={(v) => upd({ subcategoria: v })} width="90px" readOnly={ro} /></Td>
      <Td {...fixed('col-5')}><TextInput value={item.item} onChange={(v) => upd({ item: v })} width="120px" readOnly={ro} /></Td>
      <Td {...fixed('col-6')}>
        {fornecedoresSugeridos.length > 0 ? (
          <input
            list={`forn-${item.id}`}
            value={item.fornecedor}
            onChange={(e) => upd({ fornecedor: e.target.value })}
            style={{ width: '100px' }}
            readOnly={ro}
            disabled={ro}
          />
        ) : (
          <TextInput value={item.fornecedor} onChange={(v) => upd({ fornecedor: v })} width="100px" readOnly={ro} />
        )}
        {fornecedoresSugeridos.length > 0 && (
          <datalist id={`forn-${item.id}`}>
            {fornecedoresSugeridos.map((f) => <option key={f} value={f} />)}
          </datalist>
        )}
      </Td>

      {/* VENDIDO */}
      <Td><QtyInput value={item.qtdeVendida} onChange={(v) => upd({ qtdeVendida: v })} readOnly={ro} /></Td>
      <Td><NumInput value={item.valorUnitarioAtual} onChange={(v) => upd({ valorUnitarioAtual: v })} readOnly={ro} /></Td>
      <Td className="font-medium">
        <ValorContabil
          value={item.totalAtual}
          style={isDivCol(item, 'Vendido') ? { color: '#EA580C', fontWeight: 600 } : undefined}
          title={divTitle(item, 'Vendido') || undefined}
        />
      </Td>
      <Td className="text-blue-600"><ValorContabil value={item.valorProjetado} /></Td>
      <Td className="text-blue-600"><ValorContabil value={item.totalProjetado} /></Td>

      <td className="col-sep" />

      {/* ORÇADO */}
      <Td><QtyInput value={item.qtdeOrcada} onChange={(v) => upd({ qtdeOrcada: v })} readOnly={ro} /></Td>
      <Td><NumInput value={item.valorUnitarioOrcado} onChange={(v) => upd({ valorUnitarioOrcado: v })} readOnly={ro} /></Td>
      <Td className="font-medium">
        <ValorContabil
          value={item.valorOrcado}
          style={isDivCol(item, 'Orçado') ? { color: '#EA580C', fontWeight: 600 } : undefined}
          title={divTitle(item, 'Orçado') || undefined}
        />
      </Td>

      <td className="col-sep" />

      {/* CONTRATADO */}
      <Td><QtyInput value={item.qtdeContratada} onChange={(v) => upd({ qtdeContratada: v })} readOnly={ro} /></Td>
      <Td><NumInput value={item.valorUnitarioContratado} onChange={(v) => upd({ valorUnitarioContratado: v })} readOnly={ro} /></Td>
      <Td className="font-medium">
        <ValorContabil
          value={item.valorContratado}
          style={isDivCol(item, 'Contratado') ? { color: '#EA580C', fontWeight: 600 } : undefined}
          title={divTitle(item, 'Contratado') || undefined}
        />
      </Td>

      <td className="col-sep" />

      <Td>
        <select value={item.status} onChange={(e) => upd({ status: e.target.value as StatusItem })} style={{ width: '80px' }} disabled={ro}>
          {STATUS_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </Td>
      <Td>
        <select value={item.statusPagamento} onChange={(e) => upd({ statusPagamento: e.target.value as StatusPagamento })} style={{ width: '80px' }} disabled={ro}>
          {PGTO_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </Td>
      <Td><NumInput value={item.valorFinal} onChange={(v) => upd({ valorFinal: v })} readOnly={ro} /></Td>
      <Td><NumInput value={item.valorPago} onChange={(v) => upd({ valorPago: v })} readOnly={ro} /></Td>
      <Td className={item.faltaPagar > 0 ? 'text-red-600 font-medium' : ''}>
        <ValorContabil value={item.faltaPagar} />
      </Td>

      <Td>
        {isAdmin && (
          <button
            onClick={onDelete}
            className="text-gray-300 hover:text-red-500 transition-colors"
            title="Excluir item"
          >
            <Trash2 size={13} />
          </button>
        )}
      </Td>
    </tr>
  )
}
