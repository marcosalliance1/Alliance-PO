import { useState } from 'react'
import type { Projeto, Receitas, ReceitaLinha } from '../../types'
import { calcResumoProjeto } from '../../utils/calculos'
import { formatBRL } from '../../utils/formatters'

interface ResumoGeralProps {
  projeto: Projeto
  onUpdateReceitas: (r: Receitas) => void
}

// Input BRL inline: exibe formatado, clique para editar com vírgula decimal
function BRLInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
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
        className="w-full text-right bg-white border border-blue-400 rounded px-2 py-0.5 text-sm text-gray-800 focus:outline-none min-w-[120px]"
        placeholder="0,00"
      />
    )
  }

  return (
    <span
      onClick={startEdit}
      title="Clique para editar"
      className="block w-full text-right cursor-pointer hover:bg-blue-50 rounded px-1 py-0.5 text-sm transition-colors select-none"
    >
      {value
        ? <span className="text-text-main">{formatBRL(value)}</span>
        : <span className="text-text-muted/50 text-xs italic">—</span>
      }
    </span>
  )
}

function ValorCell({ value, className = '' }: { value: number; className?: string }) {
  return (
    <td className={`text-right px-3 py-1.5 text-sm whitespace-nowrap ${className}`}>
      {formatBRL(value)}
    </td>
  )
}

const RECEITA_CAMPOS: { label: string; key: keyof Receitas }[] = [
  { label: 'Faturamento Adesões',  key: 'faturamentoAdesoes' },
  { label: 'Vendas Convites Extras', key: 'vendasConvitesExtras' },
  { label: 'Vendas Mesas Extras',  key: 'vendasMesasExtras' },
  { label: 'Arrecadação Extra',    key: 'arrecadacaoExtra' },
  { label: 'Receita Vendas Baile', key: 'receitaVendasBaile' },
  { label: 'Outros',               key: 'outros' },
  { label: 'Receita Rescisões',    key: 'receitaRescisoes' },
]

export function ResumoGeral({ projeto, onUpdateReceitas }: ResumoGeralProps) {
  const resumo = calcResumoProjeto(projeto)
  const r = projeto.receitas
  const margemPositiva = resumo.margem.vendido >= 0

  function updateLinha(key: keyof Receitas, field: keyof ReceitaLinha, valor: number) {
    onUpdateReceitas({ ...r, [key]: { ...r[key], [field]: valor } })
  }

  return (
    <div className="space-y-6">
      <div className="card overflow-x-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-main">Resumo Geral</h3>
          <span className="text-text-muted text-xs italic">Clique em qualquer célula para editar</span>
        </div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-surface-2">
              <th className="text-left px-3 py-2 text-text-muted font-medium text-xs w-48">Descrição</th>
              <th className="text-right px-3 py-2 text-text-muted font-medium text-xs min-w-[140px]">Vendido</th>
              <th className="text-right px-3 py-2 text-text-muted font-medium text-xs min-w-[140px]">Orçado</th>
              <th className="text-right px-3 py-2 text-text-muted font-medium text-xs min-w-[140px]">Contratado</th>
              <th className="text-right px-3 py-2 text-text-muted font-medium text-xs min-w-[140px]">Pago</th>
              <th className="text-right px-3 py-2 text-text-muted font-medium text-xs min-w-[140px]">Falta Pagar</th>
            </tr>
          </thead>
          <tbody>
            {/* ── RECEITAS ────────────────────────────────────────────── */}
            <tr>
              <td colSpan={6} className="px-3 py-1 text-xs font-bold text-text-muted uppercase tracking-wide bg-surface border-t border-white/10">
                Receitas
              </td>
            </tr>

            {RECEITA_CAMPOS.map(({ label, key }) => {
              const linha = r[key]
              const faltaPagar = linha.contratado - linha.pago
              return (
                <tr key={key} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-3 py-1 text-text-main text-sm">{label}</td>
                  <td className="px-2 py-0.5">
                    <BRLInput value={linha.vendido}    onChange={(v) => updateLinha(key, 'vendido', v)} />
                  </td>
                  <td className="px-2 py-0.5">
                    <BRLInput value={linha.orcado}     onChange={(v) => updateLinha(key, 'orcado', v)} />
                  </td>
                  <td className="px-2 py-0.5">
                    <BRLInput value={linha.contratado} onChange={(v) => updateLinha(key, 'contratado', v)} />
                  </td>
                  <td className="px-2 py-0.5">
                    <BRLInput value={linha.pago}       onChange={(v) => updateLinha(key, 'pago', v)} />
                  </td>
                  <td className="text-right px-3 py-1 text-sm">
                    <span className={faltaPagar > 0 ? 'text-danger font-medium' : faltaPagar < 0 ? 'text-success' : 'text-text-muted'}>
                      {formatBRL(faltaPagar)}
                    </span>
                  </td>
                </tr>
              )
            })}

            {/* RECEITA BAILE */}
            <tr className="bg-blue-50 border-t-2 border-blue-200">
              <td className="px-3 py-2 font-bold text-blue-800 text-sm">RECEITA BAILE</td>
              <ValorCell value={resumo.receitaBaile.vendido}     className="font-bold text-blue-800" />
              <ValorCell value={resumo.receitaBaile.orcado}      className="font-bold text-blue-800" />
              <ValorCell value={resumo.receitaBaile.contratado}  className="font-bold text-blue-800" />
              <ValorCell value={resumo.receitaBaile.pago}        className="font-bold text-blue-700" />
              <ValorCell value={resumo.receitaBaile.faltaPagar}  className={`font-bold ${resumo.receitaBaile.faltaPagar > 0 ? 'text-danger' : 'text-blue-700'}`} />
            </tr>

            {/* ── CUSTOS ──────────────────────────────────────────────── */}
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
              <ValorCell value={resumo.custoTotal.vendido}    className="font-bold" />
              <ValorCell value={resumo.custoTotal.orcado}     className="font-bold" />
              <ValorCell value={resumo.custoTotal.contratado} className="font-bold" />
              <ValorCell value={resumo.custoTotal.pago}       className="font-bold" />
              <ValorCell value={resumo.custoTotal.faltaPagar} className="font-bold text-danger" />
            </tr>

            {/* MARGEM */}
            <tr className={`border-t-2 ${margemPositiva ? 'bg-green-50' : 'bg-red-50'}`}>
              <td className={`px-3 py-2.5 font-bold text-sm ${margemPositiva ? 'text-green-800' : 'text-red-800'}`}>
                MARGEM DE CONTRIBUIÇÃO
              </td>
              <ValorCell value={resumo.margem.vendido}    className={`font-bold text-lg ${margemPositiva ? 'text-green-700' : 'text-red-700'}`} />
              <ValorCell value={resumo.margem.orcado}     className={`font-bold ${margemPositiva ? 'text-green-600' : 'text-red-600'}`} />
              <ValorCell value={resumo.margem.contratado} className={`font-bold ${margemPositiva ? 'text-green-600' : 'text-red-600'}`} />
              <ValorCell value={resumo.margem.pago}       className={`font-bold ${resumo.margem.pago >= 0 ? 'text-green-600' : 'text-red-600'}`} />
              <ValorCell value={resumo.margem.faltaPagar} className="font-bold text-text-muted" />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
