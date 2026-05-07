import { useState, useCallback } from 'react'
import type { ItemCusto, StatusItem, StatusPagamento, TipoCusto } from '../../types'
import { Trash2 } from 'lucide-react'
import { formatBRL } from '../../utils/formatters'

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

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={className}>{children}</td>
}

function NumInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [raw, setRaw] = useState('')

  function startEdit() {
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
        style={{ width: '80px' }}
      />
    )
  }
  return (
    <span
      className="cursor-pointer block w-full hover:bg-blue-50 rounded px-1"
      onClick={startEdit}
    >
      {value === 0 ? '' : formatBRL(value)}
    </span>
  )
}

function QtyInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      value={value || ''}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      style={{ width: '50px' }}
    />
  )
}

function TextInput({ value, onChange, placeholder = '', width = '100px' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; width?: string
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ width }}
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

function getRowStyle(item: ItemCusto): React.CSSProperties {
  if (item.statusPagamento === 'pago') {
    return { backgroundColor: 'rgba(16,185,129,0.12)', borderLeft: '3px solid #10B981' }
  }
  if (item.status === 'fechado' || item.statusPagamento === 'parcial') {
    return { backgroundColor: 'rgba(22,163,74,0.08)', borderLeft: '3px solid #16A34A' }
  }
  if (item.status === 'estimado' || item.status === 'orçando') {
    return { backgroundColor: 'rgba(234,179,8,0.08)', borderLeft: '3px solid #EAB308' }
  }
  if (item.qtdeVendida > 0 && item.valorUnitarioAtual > 0) {
    return { backgroundColor: 'rgba(59,130,246,0.08)', borderLeft: '3px solid #3B82F6' }
  }
  return {}
}

export function LinhaItem({ item, onChange, onDelete, fornecedoresSugeridos = [] }: LinhaItemProps) {
  const upd = useCallback(
    (changes: Partial<ItemCusto>) => onChange(changes),
    [onChange],
  )

  return (
    <tr style={getRowStyle(item)}>
      <Td><TextInput value={item.codigo} onChange={(v) => upd({ codigo: v })} width="60px" /></Td>
      <Td><TextInput value={item.area} onChange={(v) => upd({ area: v })} width="80px" /></Td>
      <Td>
        <select value={item.moscow} onChange={(e) => upd({ moscow: e.target.value })} style={{ width: '50px' }}>
          {MOSCOW_OPTS.map((o) => <option key={o} value={o}>{o || '—'}</option>)}
        </select>
      </Td>
      <Td>
        <select value={item.tipoCusto} onChange={(e) => upd({ tipoCusto: e.target.value as TipoCusto })} style={{ width: '90px' }}>
          {TIPO_CUSTO_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </Td>
      <Td><TextInput value={item.subcategoria} onChange={(v) => upd({ subcategoria: v })} width="90px" /></Td>
      <Td><TextInput value={item.item} onChange={(v) => upd({ item: v })} width="120px" /></Td>
      <Td>
        {fornecedoresSugeridos.length > 0 ? (
          <input
            list={`forn-${item.id}`}
            value={item.fornecedor}
            onChange={(e) => upd({ fornecedor: e.target.value })}
            style={{ width: '100px' }}
          />
        ) : (
          <TextInput value={item.fornecedor} onChange={(v) => upd({ fornecedor: v })} width="100px" />
        )}
        {fornecedoresSugeridos.length > 0 && (
          <datalist id={`forn-${item.id}`}>
            {fornecedoresSugeridos.map((f) => <option key={f} value={f} />)}
          </datalist>
        )}
      </Td>

      {/* VENDIDO */}
      <Td><QtyInput value={item.qtdeVendida} onChange={(v) => upd({ qtdeVendida: v })} /></Td>
      <Td><NumInput value={item.valorUnitarioAtual} onChange={(v) => upd({ valorUnitarioAtual: v })} /></Td>
      <Td className="font-medium">
        {item.totalAtual ? (
          <span
            style={isDivCol(item, 'Vendido') ? { color: '#EA580C', fontWeight: 600 } : undefined}
            title={divTitle(item, 'Vendido') || undefined}
          >{formatBRL(item.totalAtual)}</span>
        ) : ''}
      </Td>
      <Td className="text-blue-600">{item.valorProjetado ? formatBRL(item.valorProjetado) : ''}</Td>
      <Td className="text-blue-600">{item.totalProjetado ? formatBRL(item.totalProjetado) : ''}</Td>

      <Td className="text-gray-300 select-none">|</Td>

      {/* ORÇADO */}
      <Td><QtyInput value={item.qtdeOrcada} onChange={(v) => upd({ qtdeOrcada: v })} /></Td>
      <Td><NumInput value={item.valorUnitarioOrcado} onChange={(v) => upd({ valorUnitarioOrcado: v })} /></Td>
      <Td className="font-medium">
        {item.valorOrcado ? (
          <span
            style={isDivCol(item, 'Orçado') ? { color: '#EA580C', fontWeight: 600 } : undefined}
            title={divTitle(item, 'Orçado') || undefined}
          >{formatBRL(item.valorOrcado)}</span>
        ) : ''}
      </Td>

      <Td className="text-gray-300 select-none">|</Td>

      {/* CONTRATADO */}
      <Td><QtyInput value={item.qtdeContratada} onChange={(v) => upd({ qtdeContratada: v })} /></Td>
      <Td><NumInput value={item.valorUnitarioContratado} onChange={(v) => upd({ valorUnitarioContratado: v })} /></Td>
      <Td className="font-medium">
        {item.valorContratado ? (
          <span
            style={isDivCol(item, 'Contratado') ? { color: '#EA580C', fontWeight: 600 } : undefined}
            title={divTitle(item, 'Contratado') || undefined}
          >{formatBRL(item.valorContratado)}</span>
        ) : ''}
      </Td>

      <Td><TextInput value={item.responsavel} onChange={(v) => upd({ responsavel: v })} width="80px" /></Td>
      <Td>
        <select value={item.status} onChange={(e) => upd({ status: e.target.value as StatusItem })} style={{ width: '80px' }}>
          {STATUS_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </Td>
      <Td>
        <select value={item.statusPagamento} onChange={(e) => upd({ statusPagamento: e.target.value as StatusPagamento })} style={{ width: '80px' }}>
          {PGTO_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </Td>
      <Td><NumInput value={item.valorFinal} onChange={(v) => upd({ valorFinal: v })} /></Td>
      <Td><NumInput value={item.valorPago} onChange={(v) => upd({ valorPago: v })} /></Td>
      <Td className={item.faltaPagar > 0 ? 'text-red-600 font-medium' : ''}>
        {item.faltaPagar ? formatBRL(item.faltaPagar) : ''}
      </Td>
      <Td><NumInput value={item.totalProgramado} onChange={(v) => upd({ totalProgramado: v })} /></Td>
      <Td>{item.emAberto ? formatBRL(item.emAberto) : ''}</Td>

      <Td>
        <button
          onClick={onDelete}
          className="text-gray-300 hover:text-red-500 transition-colors"
          title="Excluir item"
        >
          <Trash2 size={13} />
        </button>
      </Td>
    </tr>
  )
}
