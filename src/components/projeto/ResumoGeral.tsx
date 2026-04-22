import { useState } from 'react'
import type { Projeto, Receitas } from '../../types'
import { calcResumoProjeto } from '../../utils/calculos'
import { formatBRL } from '../../utils/formatters'

interface ResumoGeralProps {
  projeto: Projeto
  onUpdateReceitas: (r: Receitas) => void
}

// Input BRL inline: mostra valor formatado, clica para editar com vírgula decimal
function ReceitaInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [raw, setRaw] = useState('')

  function startEdit() {
    setEditing(true)
    setRaw(value === 0 ? '' : String(value).replace('.', ','))
  }

  function commit() {
    setEditing(false)
    const n = parseFloat(raw.replace(/\./g, '').replace(',', '.')) || 0
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
        className="w-full text-right bg-white border border-blue-400 rounded px-2 py-0.5 text-sm text-gray-800 focus:outline-none"
        placeholder="0,00"
      />
    )
  }

  return (
    <span
      onClick={startEdit}
      className="block w-full text-right cursor-pointer hover:bg-blue-50 rounded px-2 py-0.5 text-sm text-text-main transition-colors"
      title="Clique para editar"
    >
      {value ? formatBRL(value) : <span className="text-text-muted italic text-xs">clique para preencher</span>}
    </span>
  )
}

function ValorCell({ value, className = '' }: { value: number; className?: string }) {
  return <td className={`text-right px-3 py-1.5 text-sm ${className}`}>{formatBRL(value)}</td>
}

export function ResumoGeral({ projeto, onUpdateReceitas }: ResumoGeralProps) {
  const resumo = calcResumoProjeto(projeto)
  const r = projeto.receitas

  const RECEITA_CAMPOS: { label: string; key: keyof Receitas }[] = [
    { label: 'Faturamento Adesões', key: 'faturamentoAdesoes' },
    { label: 'Vendas Convites Extras', key: 'vendasConvitesExtras' },
    { label: 'Vendas Mesas Extras', key: 'vendasMesasExtras' },
    { label: 'Arrecadação Extra', key: 'arrecadacaoExtra' },
    { label: 'Receita Vendas Baile', key: 'receitaVendasBaile' },
    { label: 'Outros', key: 'outros' },
    { label: 'Receita Rescisões', key: 'receitaRescisoes' },
  ]

  const margemPositiva = resumo.margem.vendido >= 0

  return (
    <div className="space-y-6">
      <div className="card overflow-x-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-main">Resumo Geral</h3>
          <span className="text-text-muted text-xs italic">Clique em qualquer receita para editar</span>
        </div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-surface-2">
              <th className="text-left px-3 py-2 text-text-muted font-medium text-xs">Descrição</th>
              <th className="text-right px-3 py-2 text-text-muted font-medium text-xs">Vendido</th>
              <th className="text-right px-3 py-2 text-text-muted font-medium text-xs">Orçado</th>
              <th className="text-right px-3 py-2 text-text-muted font-medium text-xs">Contratado</th>
              <th className="text-right px-3 py-2 text-text-muted font-medium text-xs">Pago</th>
              <th className="text-right px-3 py-2 text-text-muted font-medium text-xs">Falta Pagar</th>
            </tr>
          </thead>
          <tbody>
            {/* RECEITAS */}
            <tr>
              <td colSpan={6} className="px-3 py-1 text-xs font-bold text-text-muted uppercase tracking-wide bg-surface border-t border-white/10">
                Receitas
              </td>
            </tr>

            {RECEITA_CAMPOS.map(({ label, key }) => (
              <tr key={key} className="border-b border-white/5 hover:bg-white/5">
                <td className="px-3 py-1 text-text-main text-sm">{label}</td>
                <td className="px-2 py-0.5 min-w-[160px]">
                  <ReceitaInput
                    value={r[key]}
                    onChange={(v) => onUpdateReceitas({ ...r, [key]: v })}
                  />
                </td>
                <td className="text-right px-3 py-1.5 text-text-muted text-sm">—</td>
                <td className="text-right px-3 py-1.5 text-text-muted text-sm">—</td>
                <td className="text-right px-3 py-1.5 text-text-muted text-sm">—</td>
                <td className="text-right px-3 py-1.5 text-text-muted text-sm">—</td>
              </tr>
            ))}

            {/* RECEITA BAILE */}
            <tr className="bg-blue-50 border-t-2 border-blue-200">
              <td className="px-3 py-2 font-bold text-blue-800 text-sm">RECEITA BAILE</td>
              <ValorCell value={resumo.receitaBaile.vendido} className="font-bold text-blue-800" />
              <ValorCell value={resumo.receitaBaile.orcado} className="font-bold text-blue-800" />
              <ValorCell value={resumo.receitaBaile.contratado} className="font-bold text-blue-800" />
              <ValorCell value={0} className="text-blue-400" />
              <ValorCell value={0} className="text-blue-400" />
            </tr>

            {/* CUSTOS */}
            <tr>
              <td colSpan={6} className="px-3 py-1 text-xs font-bold text-text-muted uppercase tracking-wide bg-surface border-t border-white/10">
                Custos
              </td>
            </tr>
            {resumo.custos.map((c) => (
              <tr key={c.secaoId} className="border-b border-white/5 hover:bg-white/5">
                <td className="px-3 py-1.5 text-text-main text-sm">{c.nome}</td>
                <ValorCell value={c.vendido} />
                <ValorCell value={c.orcado} />
                <ValorCell value={c.contratado} />
                <ValorCell value={c.pago} />
                <ValorCell value={c.faltaPagar} className={c.faltaPagar > 0 ? 'text-danger' : ''} />
              </tr>
            ))}

            {/* CUSTO TOTAL */}
            <tr className="bg-surface-2 border-t-2 border-white/20">
              <td className="px-3 py-2 font-bold text-text-main text-sm">CUSTO TOTAL</td>
              <ValorCell value={resumo.custoTotal.vendido} className="font-bold" />
              <ValorCell value={resumo.custoTotal.orcado} className="font-bold" />
              <ValorCell value={resumo.custoTotal.contratado} className="font-bold" />
              <ValorCell value={resumo.custoTotal.pago} className="font-bold" />
              <ValorCell value={resumo.custoTotal.faltaPagar} className="font-bold text-danger" />
            </tr>

            {/* MARGEM */}
            <tr className={`border-t-2 ${margemPositiva ? 'bg-green-50' : 'bg-red-50'}`}>
              <td className={`px-3 py-2.5 font-bold text-sm ${margemPositiva ? 'text-green-800' : 'text-red-800'}`}>
                MARGEM DE CONTRIBUIÇÃO
              </td>
              <ValorCell value={resumo.margem.vendido} className={`font-bold text-lg ${margemPositiva ? 'text-green-700' : 'text-red-700'}`} />
              <ValorCell value={resumo.margem.orcado} className={`font-bold ${margemPositiva ? 'text-green-600' : 'text-red-600'}`} />
              <ValorCell value={resumo.margem.contratado} className={`font-bold ${margemPositiva ? 'text-green-600' : 'text-red-600'}`} />
              <td className="px-3 py-2.5 text-right text-gray-400 text-sm">—</td>
              <td className="px-3 py-2.5 text-right text-gray-400 text-sm">—</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
