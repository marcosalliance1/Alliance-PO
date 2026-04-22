import { useState } from 'react'
import type { Projeto, Receitas } from '../../types'
import { calcResumoProjeto } from '../../utils/calculos'
import { formatBRL } from '../../utils/formatters'

interface ResumoGeralProps {
  projeto: Projeto
  onUpdateReceitas: (r: Receitas) => void
}

const INPUT = 'bg-transparent border border-transparent hover:border-blue-200 focus:border-blue-400 rounded px-1 py-0.5 text-right text-sm w-full focus:outline-none'

function ReceitaInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      className={INPUT}
      value={value || ''}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
    />
  )
}

function ValorCell({ value, className = '' }: { value: number; className?: string }) {
  return <td className={`text-right px-3 py-1.5 text-sm ${className}`}>{formatBRL(value)}</td>
}

export function ResumoGeral({ projeto, onUpdateReceitas }: ResumoGeralProps) {
  const [editReceitas, setEditReceitas] = useState(false)
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
          <button
            className="btn-secondary text-xs py-1 px-3"
            onClick={() => setEditReceitas(!editReceitas)}
          >
            {editReceitas ? 'Salvar Receitas' : 'Editar Receitas'}
          </button>
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
                <td className="px-3 py-1.5 text-text-main text-sm">{label}</td>
                <td className="text-right px-3 py-1.5">
                  {editReceitas ? (
                    <ReceitaInput
                      value={r[key]}
                      onChange={(v) => onUpdateReceitas({ ...r, [key]: v })}
                    />
                  ) : (
                    <span className="text-sm">{formatBRL(r[key])}</span>
                  )}
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
              <td colSpan={6} className="px-3 py-1 text-xs font-bold text-text-muted uppercase tracking-wide bg-surface border-t border-white/10 mt-2">
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
