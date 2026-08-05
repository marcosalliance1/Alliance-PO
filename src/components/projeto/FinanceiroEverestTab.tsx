import { useMemo, useState } from 'react'
import type { Projeto } from '../../types'
import { useFinanceiro } from '../../hooks/useFinanceiro'
import { calcResumoProjeto } from '../../utils/calculos'
import { formatBRL } from '../../utils/formatters'
import { fmtCompact } from '../../utils/parseFinanceiro'
import { KPICard } from '../dashboard/KPICard'
import { DollarSign, TrendingDown, TrendingUp, Search, Loader, AlertTriangle } from 'lucide-react'

export function FinanceiroEverestTab({ projeto }: { projeto: Projeto }) {
  const { boletim, cap, carregando } = useFinanceiro()
  const [filtro, setFiltro] = useState(projeto.tap.turma || '')

  const fp = filtro.toLowerCase().trim()
  const boletimF = useMemo(() => fp ? boletim.filter(r => r.desc_centro_custo.toLowerCase().includes(fp)) : [], [boletim, fp])
  const capF = useMemo(() => fp ? cap.filter(r => r.desc_centro_custo.toLowerCase().includes(fp)) : [], [cap, fp])

  const centrosEncontrados = useMemo(() => {
    const set = new Set<string>()
    for (const r of boletimF) set.add(r.desc_centro_custo)
    for (const r of capF) set.add(r.desc_centro_custo)
    return [...set].sort()
  }, [boletimF, capF])

  const totais = useMemo(() => {
    const receitas = boletimF.filter(r => r.tipo === 'RECEITA')
    const rendimentos = boletimF.filter(r => r.tipo === 'RENDIMENTO')
    const tarifas = boletimF.filter(r => (r.desc_conta_gerencial ?? '').toUpperCase() === 'TARIFAS BANCARIAS')
    const totalReceita = receitas.reduce((s, r) => s + (r.v_lancamento ?? 0), 0)
    const totalRendimento = rendimentos.reduce((s, r) => s + (r.v_lancamento ?? 0), 0)
    const totalCAP = capF.reduce((s, r) => s + (r.v_titulo ?? 0), 0)
    const totalTarifas = tarifas.reduce((s, r) => s + (r.v_lancamento ?? 0), 0)
    const despesaTotal = totalCAP + totalTarifas
    const resultado = totalReceita - despesaTotal
    const margem = totalReceita > 0 ? (resultado / totalReceita) * 100 : 0
    return { totalReceita, totalRendimento, totalCAP, totalTarifas, despesaTotal, resultado, margem }
  }, [boletimF, capF])

  const fornecedores = useMemo(() => {
    const map = new Map<string, { total: number; titulos: number }>()
    for (const i of capF) {
      const nome = i.fantasia_fornecedor?.trim() || '(sem fornecedor)'
      const prev = map.get(nome) ?? { total: 0, titulos: 0 }
      map.set(nome, { total: prev.total + (i.v_titulo ?? 0), titulos: prev.titulos + 1 })
    }
    return [...map.entries()].map(([nome, v]) => ({ nome, ...v })).sort((a, b) => b.total - a.total).slice(0, 10)
  }, [capF])

  const resumoPO = useMemo(() => calcResumoProjeto(projeto), [projeto])

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-48 gap-3 text-text-muted">
        <Loader size={18} className="animate-spin" />
        <span className="text-sm">Carregando dados do Everest...</span>
      </div>
    )
  }

  return (
    <div>
      <div className="card mb-5">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
          <div>
            <h3 className="text-sm font-semibold text-text-main">Centro de Custo (Everest)</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Busca por aproximação do nome da turma — ajuste se não encontrar os lançamentos certos.
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={filtro}
              onChange={e => setFiltro(e.target.value)}
              placeholder="Nome do centro de custo..."
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary/40"
            />
          </div>
        </div>
        {fp && (
          centrosEncontrados.length > 0 ? (
            <p className="text-xs text-text-muted">
              Encontrado{centrosEncontrados.length > 1 ? 's' : ''}: <span className="text-text-main font-medium">{centrosEncontrados.join(', ')}</span>
            </p>
          ) : (
            <p className="text-xs flex items-center gap-1.5" style={{ color: '#F59E0B' }}>
              <AlertTriangle size={13} /> Nenhum centro de custo encontrado no Everest com esse nome.
            </p>
          )
        )}
      </div>

      {fp && (centrosEncontrados.length > 0) && (
        <>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <KPICard title="Receita Real (Boletim)" value={formatBRL(totais.totalReceita)} icon={DollarSign} color="#00b894" />
            <KPICard title="Despesa Real (CAP + Tarifas)" value={formatBRL(totais.despesaTotal)} icon={TrendingDown} color="#e94560" />
            <KPICard title="Resultado Real" value={formatBRL(totais.resultado)} icon={TrendingUp} color={totais.resultado >= 0 ? '#00b894' : '#e94560'} subtitle={`Margem ${totais.margem.toFixed(1)}%`} />
            <KPICard title="Rendimentos" value={formatBRL(totais.totalRendimento)} icon={DollarSign} color="#74b9ff" />
          </div>

          <div className="card mb-6">
            <h3 className="text-sm font-semibold text-text-main mb-1">P.O. (itens) vs Everest (real)</h3>
            <p className="text-xs text-text-muted mb-4">Comparação entre o que está lançado nos itens do orçamento e o que de fato foi pago no Everest.</p>
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-inner border border-white/10 p-3">
                <p className="text-[11px] text-text-muted uppercase tracking-wide mb-1">Custo Contratado (P.O.)</p>
                <p className="text-lg font-semibold text-text-main">{formatBRL(resumoPO.custoTotal.contratado)}</p>
              </div>
              <div className="rounded-inner border border-white/10 p-3">
                <p className="text-[11px] text-text-muted uppercase tracking-wide mb-1">Pago (itens do P.O.)</p>
                <p className="text-lg font-semibold text-text-main">{formatBRL(resumoPO.custoTotal.pago)}</p>
              </div>
              <div className="rounded-inner border border-primary/30 bg-primary/5 p-3">
                <p className="text-[11px] text-text-muted uppercase tracking-wide mb-1">Pago (Everest — CAP real)</p>
                <p className="text-lg font-semibold text-primary">{formatBRL(totais.totalCAP)}</p>
              </div>
            </div>
            {Math.abs(resumoPO.custoTotal.pago - totais.totalCAP) > 0.01 && (
              <p className="text-xs mt-3 flex items-center gap-1.5" style={{ color: '#F59E0B' }}>
                <AlertTriangle size={13} /> Diferença de {formatBRL(Math.abs(resumoPO.custoTotal.pago - totais.totalCAP))} entre o "pago" registrado nos itens do P.O. e o total pago no Everest.
              </p>
            )}
          </div>

          <div className="card">
            <h3 className="text-sm font-semibold text-text-main mb-4">Fornecedores (CAP) <span className="text-xs text-text-muted font-normal">Top 10 por valor</span></h3>
            {fornecedores.length === 0 ? (
              <p className="text-xs text-text-muted">Nenhum título de CAP encontrado para este centro de custo.</p>
            ) : (
              <div className="space-y-2.5">
                {fornecedores.map((f, i) => {
                  const max = fornecedores[0].total || 1
                  return (
                    <div key={f.nome}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] text-text-muted w-5 text-right shrink-0">{i + 1}</span>
                        <span className="text-xs text-text-main truncate flex-1" title={f.nome}>{f.nome}</span>
                        <span className="text-[10px] text-text-muted shrink-0">{f.titulos} título{f.titulos !== 1 ? 's' : ''}</span>
                        <span className="text-xs font-semibold text-text-main shrink-0 w-24 text-right">{fmtCompact(f.total)}</span>
                      </div>
                      <div className="ml-7 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <div className="h-full rounded-full" style={{ width: `${(f.total / max) * 100}%`, background: 'rgba(0,184,148,0.7)' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      {!fp && (
        <p className="text-sm text-text-muted">Digite o nome do centro de custo para ver os dados do Everest.</p>
      )}
    </div>
  )
}
