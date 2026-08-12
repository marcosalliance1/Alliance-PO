import { useState } from 'react'
import { Plus, Trash2, Database } from 'lucide-react'
import type { Projeto, Receitas, ReceitaLinha, ConciliacaoEverest, CustoAdicional } from '../../types'
// Receitas is Record<string, ReceitaLinha> — keys are human-readable labels
import { calcResumoProjeto } from '../../utils/calculos'
import { formatBRL } from '../../utils/formatters'
import { v4 as uuid } from '../../utils/uuid'
import { useAuth } from '../../contexts/AuthContext'
import { ValorContabil } from './LinhaItem'

interface ResumoGeralProps {
  projeto: Projeto
  onUpdateReceitas: (r: Receitas) => void
  onUpdateConciliacao: (c: ConciliacaoEverest) => void
  onUpdateCustosAdicionais: (items: CustoAdicional[]) => void
}

// Input BRL inline: exibe formatado, clique para editar com vírgula decimal
function BRLInput({ value, onChange, readOnly }: { value: number; onChange: (v: number) => void; readOnly?: boolean }) {
  const [editing, setEditing] = useState(false)
  const [raw, setRaw] = useState('')

  function startEdit() {
    if (readOnly) return
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
      title={readOnly ? undefined : 'Clique para editar'}
      className={`block w-full text-right rounded px-1 py-0.5 text-sm transition-colors select-none ${readOnly ? '' : 'cursor-pointer hover:bg-blue-50'}`}
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
      <ValorContabil value={value} />
    </td>
  )
}


export function ResumoGeral({ projeto, onUpdateReceitas, onUpdateCustosAdicionais }: ResumoGeralProps) {
  const { isAdmin } = useAuth()
  const resumo = calcResumoProjeto(projeto)
  const r = projeto.receitas
  const margemPositiva = resumo.margem.vendido >= 0
  const custosAdicionais = projeto.custosAdicionais ?? []

  function addCustoAdicional() {
    onUpdateCustosAdicionais([...custosAdicionais, { id: uuid(), descricao: '', vendido: 0, orcado: 0, contratado: 0, pago: 0 }])
  }

  function removeCustoAdicional(id: string) {
    onUpdateCustosAdicionais(custosAdicionais.filter((c) => c.id !== id))
  }

  function updateCustoAdicional(id: string, changes: Partial<CustoAdicional>) {
    onUpdateCustosAdicionais(custosAdicionais.map((c) => c.id === id ? { ...c, ...changes } : c))
  }

  function updateLinha(key: string, field: keyof ReceitaLinha, valor: number) {
    onUpdateReceitas({ ...r, [key]: { ...r[key], [field]: valor } })
  }

  return (
    <div className="space-y-6">
      <div className="card overflow-x-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-main">Resumo Geral</h3>
          {isAdmin && <span className="text-text-muted text-xs italic">Clique em qualquer célula para editar</span>}
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

            {Object.entries(r).filter(([, linha]) =>
              linha.vendido !== 0 || linha.orcado !== 0 || linha.contratado !== 0 || linha.pago !== 0
            ).map(([key, linha]) => {
              const faltaPagar = linha.contratado - linha.pago
              return (
                <tr key={key} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-3 py-1 text-text-main text-sm">{key}</td>
                  <td className="px-2 py-0.5">
                    <BRLInput value={linha.vendido}    onChange={(v) => updateLinha(key, 'vendido', v)} readOnly={!isAdmin} />
                  </td>
                  <td className="px-2 py-0.5">
                    <BRLInput value={linha.orcado}     onChange={(v) => updateLinha(key, 'orcado', v)} readOnly={!isAdmin} />
                  </td>
                  <td className="px-2 py-0.5">
                    <BRLInput value={linha.contratado} onChange={(v) => updateLinha(key, 'contratado', v)} readOnly={!isAdmin} />
                  </td>
                  <td className="px-2 py-0.5">
                    <BRLInput value={linha.pago}       onChange={(v) => updateLinha(key, 'pago', v)} readOnly={!isAdmin} />
                  </td>
                  <td className="text-right px-3 py-1 text-sm">
                    <ValorContabil
                      value={faltaPagar}
                      className={faltaPagar > 0 ? 'text-danger font-medium' : faltaPagar < 0 ? 'text-success' : 'text-text-muted'}
                    />
                  </td>
                </tr>
              )
            })}

            {/* RECEITA BAILE */}
            <tr className="bg-blue-500/10 border-t-2 border-blue-500/30">
              <td className="px-3 py-2 font-bold text-blue-300 text-sm">RECEITA BAILE</td>
              <ValorCell value={resumo.receitaBaile.vendido}     className="font-bold text-blue-300" />
              <ValorCell value={resumo.receitaBaile.orcado}      className="font-bold text-blue-300" />
              <ValorCell value={resumo.receitaBaile.contratado}  className="font-bold text-blue-300" />
              <ValorCell value={resumo.receitaBaile.pago}        className="font-bold text-blue-200" />
              <ValorCell value={resumo.receitaBaile.faltaPagar}  className={`font-bold ${resumo.receitaBaile.faltaPagar > 0 ? 'text-danger' : 'text-blue-200'}`} />
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

            {/* ── CUSTOS ADICIONAIS ──────────────────────────────────────── */}
            <tr>
              <td colSpan={6} className="px-3 py-1 bg-surface border-t border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-muted uppercase tracking-wide">Custos Adicionais</span>
                  {isAdmin && (
                    <button
                      onClick={addCustoAdicional}
                      className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                    >
                      <Plus size={12} /> Adicionar linha
                    </button>
                  )}
                </div>
              </td>
            </tr>

            {custosAdicionais.map((ca) => {
              const faltaPagar = ca.contratado - ca.pago
              return (
                <tr key={ca.id} className="border-b border-white/5 hover:bg-white/5 group">
                  <td className="px-2 py-0.5">
                    <input
                      type="text"
                      value={ca.descricao}
                      onChange={(e) => updateCustoAdicional(ca.id, { descricao: e.target.value })}
                      placeholder="Descrição..."
                      className="w-full text-sm bg-transparent border-b border-white/10 focus:border-primary focus:outline-none py-0.5 text-text-main placeholder:text-text-muted/40"
                      disabled={!isAdmin}
                    />
                  </td>
                  <td className="px-2 py-0.5">
                    <BRLInput value={ca.vendido}    onChange={(v) => updateCustoAdicional(ca.id, { vendido: v })} readOnly={!isAdmin} />
                  </td>
                  <td className="px-2 py-0.5">
                    <BRLInput value={ca.orcado}     onChange={(v) => updateCustoAdicional(ca.id, { orcado: v })} readOnly={!isAdmin} />
                  </td>
                  <td className="px-2 py-0.5">
                    <BRLInput value={ca.contratado} onChange={(v) => updateCustoAdicional(ca.id, { contratado: v })} readOnly={!isAdmin} />
                  </td>
                  <td className="px-2 py-0.5">
                    <BRLInput value={ca.pago}       onChange={(v) => updateCustoAdicional(ca.id, { pago: v })} readOnly={!isAdmin} />
                  </td>
                  <td className="px-3 py-1 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className={`text-sm ${faltaPagar > 0 ? 'text-danger' : 'text-text-muted'}`}>
                        {formatBRL(faltaPagar)}
                      </span>
                      {isAdmin && (
                        <button
                          onClick={() => removeCustoAdicional(ca.id)}
                          className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger transition-all"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}

            {custosAdicionais.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-1.5 text-center text-xs text-text-muted/50 italic">
                  Nenhum custo adicional — clique em "Adicionar linha" para incluir
                </td>
              </tr>
            )}

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
            <tr className={`border-t-2 ${margemPositiva ? 'bg-success/10 border-success/30' : 'bg-danger/10 border-danger/30'}`}>
              <td className={`px-3 py-2.5 font-bold text-sm ${margemPositiva ? 'text-success' : 'text-danger'}`}>
                MARGEM DE CONTRIBUIÇÃO
              </td>
              <ValorCell value={resumo.margem.vendido}    className={`font-bold text-lg ${margemPositiva ? 'text-success' : 'text-danger'}`} />
              <ValorCell value={resumo.margem.orcado}     className={`font-bold ${margemPositiva ? 'text-success' : 'text-danger'}`} />
              <ValorCell value={resumo.margem.contratado} className={`font-bold ${margemPositiva ? 'text-success' : 'text-danger'}`} />
              <ValorCell value={resumo.margem.pago}       className={`font-bold ${resumo.margem.pago >= 0 ? 'text-success' : 'text-danger'}`} />
              <ValorCell value={resumo.margem.faltaPagar} className="font-bold text-text-muted" />
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Conciliação Everest ────────────────────────────────────────────── */}
      <div className="card flex items-center gap-3">
        <div className="rounded-inner p-2 bg-primary/10 shrink-0">
          <Database size={16} className="text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-text-main">Conciliação com o Everest</h3>
          <p className="text-text-muted text-xs mt-0.5">
            Essa comparação era manual e podia ficar desatualizada. Agora é automática — veja a aba <strong className="text-text-main">Financeiro Everest</strong>, que puxa o dado real direto do ERP.
          </p>
        </div>
      </div>
    </div>
  )
}
