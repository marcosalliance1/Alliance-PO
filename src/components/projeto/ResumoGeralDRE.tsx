import { useMemo } from 'react'
import type { Projeto } from '../../types'
import { calcResumoProjeto, filtrarItensCalculo } from '../../utils/calculos'
import { padronizarCaixa } from '../../utils/caixa'

// Resumo Geral no formato da planilha ("1. RESUMO GERAL"): receitas → receita total → custos por
// seção/área (uma linha em branco entre blocos) → custo total → margem de contribuição.
// Colunas como na planilha: vendido (comercial = valor projetado) | cenário atual | orçado | contratado
// (os três com % da receita) | pago | falta pagar. Falta pagar só existe em custo — receita não tem.
// Somente leitura: o dado vem do sync da planilha.

interface Vals { vendido: number; atual: number; orcado: number; contratado: number; pago: number; faltar: number }
const zero = (): Vals => ({ vendido: 0, atual: 0, orcado: 0, contratado: 0, pago: 0, faltar: 0 })
const vazio = (v: Vals) => !v.vendido && !v.atual && !v.orcado && !v.contratado && !v.pago && !v.faltar

const brl = (n: number) => {
  if (!n || Math.abs(n) < 0.005) return '—'
  const s = Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n < 0 ? `R$ (${s})` : `R$ ${s}`
}
const pct = (parte: number, total: number) => {
  if (!total || !parte) return '—'
  return `${((parte / total) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
}

// ordem das receitas como na planilha: adesões, rescisões, extras, eventos/pré-eventos, outros por último
const ordemReceita = (nome: string) => {
  const n = nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (n.includes('adesao') || n.includes('adesoes')) return 0
  if (n.includes('rescis')) return 1
  if (n.includes('convite') || n.includes('mesa') || n.includes('extra') || n.includes('arrecad') || n.includes('baile')) return 2
  if (n.includes('evento')) return 3
  return 4
}

type Linha =
  | { tipo: 'espaco' }
  | { tipo: 'secao'; nome: string; v: Vals }
  | { tipo: 'item'; nome: string; v: Vals; receita?: boolean }
  | { tipo: 'total'; nome: string; v: Vals; cor?: 'margem' | 'receita' | 'custo'; semFaltar?: boolean }

export function ResumoGeralDRE({ projeto, mostrarFee = false }: { projeto: Projeto; mostrarFee?: boolean }) {
  const { linhas, receitaTotal } = useMemo(() => {
    const resumo = calcResumoProjeto(projeto)
    const out: Linha[] = []

    // ── Receitas ──
    const rec = Object.entries(projeto.receitas)
      .filter(([, l]) => l.vendido || l.orcado || l.contratado || l.pago)
      .sort((a, b) => ordemReceita(a[0]) - ordemReceita(b[0]))
    for (const [nome, l] of rec) {
      out.push({ tipo: 'item', nome: padronizarCaixa(nome), receita: true, v: { vendido: l.vendido, atual: 0, orcado: l.orcado, contratado: l.contratado, pago: l.pago, faltar: 0 } })
    }
    const rt = resumo.receitaBaile
    const receitaTotal: Vals = { vendido: rt.vendido, atual: rt.vendido, orcado: rt.orcado, contratado: rt.contratado, pago: rt.pago, faltar: 0 }
    out.push({ tipo: 'total', nome: 'Receita total', v: receitaTotal, cor: 'receita', semFaltar: true })
    out.push({ tipo: 'espaco' })

    // ── Custos: uma seção por bloco, áreas dentro ──
    const custoTot = zero()
    for (const secao of projeto.secoes) {
      const itens = filtrarItensCalculo(secao.itens)
      if (!itens.length) continue
      const porArea = new Map<string, Vals>()
      const tot = zero()
      for (const i of itens) {
        const k = (i.area || '').trim() || '(sem área)'
        const v = porArea.get(k) ?? zero()
        const add = (x: Vals) => {
          x.vendido += i.totalProjetado ?? 0
          x.atual += i.totalAtual ?? 0
          x.orcado += i.valorOrcado ?? 0
          x.contratado += i.valorContratado ?? 0
          x.pago += i.valorPago ?? 0
          x.faltar += i.faltaPagar ?? 0
        }
        add(v); add(tot)
        porArea.set(k, v)
      }
      const areas = [...porArea.entries()].filter(([, v]) => !vazio(v))
      if (!areas.length) continue
      for (const k of Object.keys(custoTot) as (keyof Vals)[]) custoTot[k] += tot[k]
      out.push({ tipo: 'secao', nome: padronizarCaixa(`${secao.numero} ${secao.nome}`), v: tot })
      for (const [nome, v] of areas) out.push({ tipo: 'item', nome: padronizarCaixa(nome), v })
      out.push({ tipo: 'espaco' })
    }

    // ── Custos adicionais (lançados à mão no app) ──
    const ca = projeto.custosAdicionais ?? []
    if (ca.length) {
      const tot = zero()
      for (const c of ca) {
        tot.vendido += c.vendido; tot.orcado += c.orcado; tot.contratado += c.contratado; tot.pago += c.pago; tot.faltar += c.contratado - c.pago
      }
      for (const k of Object.keys(custoTot) as (keyof Vals)[]) custoTot[k] += tot[k]
      out.push({ tipo: 'secao', nome: 'Custos adicionais', v: tot })
      for (const c of ca) {
        out.push({ tipo: 'item', nome: padronizarCaixa(c.descricao || '(sem descrição)'), v: { vendido: c.vendido, atual: 0, orcado: c.orcado, contratado: c.contratado, pago: c.pago, faltar: c.contratado - c.pago } })
      }
      out.push({ tipo: 'espaco' })
    }

    out.push({ tipo: 'total', nome: 'Custo total', cor: 'custo', v: custoTot })
    const margem: Vals = {
      vendido: receitaTotal.vendido - custoTot.vendido,
      atual: receitaTotal.vendido - custoTot.atual,
      orcado: receitaTotal.orcado - custoTot.orcado,
      contratado: receitaTotal.contratado - custoTot.contratado,
      pago: receitaTotal.pago - custoTot.pago,
      faltar: 0,
    }
    out.push({ tipo: 'total', nome: 'Margem contribuição', cor: 'margem', semFaltar: true, v: margem })
    return { linhas: out, receitaTotal }
  }, [projeto])

  const fee = (projeto.resumoComercial ?? []).filter(l => l.valorComercial || l.valorProducao || l.percentual || l.valorReal)

  const TH = 'px-3 py-2 text-center text-[11px] font-bold uppercase tracking-wide whitespace-nowrap'
  const TD = 'px-3 py-1.5 text-left whitespace-nowrap text-[11px]'
  const TDL = 'px-3 py-1.5 text-left whitespace-nowrap text-[12.5px]'
  const numero = (n: number, neg = false) => (
    <span className={neg && n < 0 ? 'text-[#c0392b]' : n === 0 ? 'text-[#9aa3b0]' : ''}>{brl(n)}</span>
  )
  const mut = 'text-[#64707f]'

  return (
    <div className="space-y-6" style={{ fontFamily: "'Montserrat', ui-sans-serif, system-ui, sans-serif", color: '#1e2430' }}>
      <div className="overflow-x-auto rounded-md border border-[#e2e6ec] bg-white">
        <table className="dre-planilha w-full border-collapse text-[12.5px] tabular-nums">
          <thead>
            {/* Grupos separados por uma coluna vazia, como na planilha: vendido | orçado | contratado | conciliação Everest */}
            <tr className="text-[#ffffff]">
              <th rowSpan={2} className={`${TH} min-w-[240px]`} style={{ textAlign: 'left' }}>Resumo geral</th>
              <th colSpan={2} className={`${TH} dre-grupo`}>Vendido</th>
              <th className="dre-gap" />
              <th colSpan={2} className={`${TH} dre-grupo`}>Orçado</th>
              <th className="dre-gap" />
              <th colSpan={2} className={`${TH} dre-grupo`}>Contratado</th>
              <th className="dre-gap" />
              <th colSpan={2} className={`${TH} dre-grupo dre-azul`}>Conciliação Everest</th>
            </tr>
            <tr className="text-[#ffffff]">
              <th className={`${TH} dre-sub`}>Valor</th><th className={`${TH} dre-sub`}>% rec</th>
              <th className="dre-gap" />
              <th className={`${TH} dre-sub`}>Valor</th><th className={`${TH} dre-sub`}>% rec</th>
              <th className="dre-gap" />
              <th className={`${TH} dre-sub`}>Valor</th><th className={`${TH} dre-sub`}>% rec</th>
              <th className="dre-gap" />
              <th className={`${TH} dre-sub dre-azul`}>Pago</th><th className={`${TH} dre-sub dre-azul`}>Falta pagar</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, n) => {
              if (l.tipo === 'espaco') return <tr key={n}><td colSpan={12} className="h-8 bg-[#eceff3] p-0" /></tr>
              const v = l.v
              const ehReceita = l.tipo === 'item' && l.receita
              const faltar = (l.tipo === 'total' && l.semFaltar) || ehReceita ? null : v.faltar
              const destaque = l.tipo === 'total'
              const negativo = l.tipo === 'total' && l.cor === 'margem'
              const linhaCls = l.tipo === 'secao'
                ? 'bg-[#e4e9f1] font-bold'
                : destaque ? 'font-bold bg-[#ebeff1] border-t border-[#e2e6ec]' : `border-t border-[#e2e6ec] ${n % 2 ? 'bg-white' : 'bg-[#fafbfc]'}`
              const labelCls = l.tipo === 'total'
                ? 'bg-[#ef3935] text-[#ffffff] font-bold uppercase'
                : l.tipo === 'secao' ? 'bg-[#e4e9f1]' : 'bg-[#f5f7fa] font-medium pl-6'
              return (
                <tr key={n} className={linhaCls}>
                  <td className={`${TDL} ${labelCls} sticky left-0 z-[1]`} style={l.tipo === 'secao' ? { fontSize: 14, borderLeft: '4px solid #ef3935' } : undefined}>{l.nome}</td>
                  <td className={TD}>{numero(v.vendido, negativo)}</td>
                  <td className={`${TD} ${mut}`}>{pct(v.vendido, receitaTotal.vendido)}</td>
                  <td className="dre-gap" />
                  <td className={TD}>{numero(v.orcado, negativo)}</td>
                  <td className={`${TD} ${mut}`}>{pct(v.orcado, receitaTotal.orcado)}</td>
                  <td className="dre-gap" />
                  <td className={TD}>{numero(v.contratado, negativo)}</td>
                  <td className={`${TD} ${mut}`}>{pct(v.contratado, receitaTotal.contratado)}</td>
                  <td className="dre-gap" />
                  <td className={TD}>{numero(v.pago, negativo)}</td>
                  <td className={TD}>{faltar === null ? '' : numero(faltar)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {mostrarFee && fee.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-[#e2e6ec] bg-white">
          <table className="w-full border-collapse text-[12.5px] tabular-nums">
            <thead>
              <tr className="bg-[#ef3935] text-[#ffffff]">
                <th className={TH} style={{ textAlign: 'left' }}>Fee / comercial</th>
                <th className={TH}>Prev. comercial</th><th className={TH}>Prev. produção</th><th className={TH}>%</th><th className={TH}>Valor real</th>
              </tr>
            </thead>
            <tbody>
              {fee.map((l, i) => (
                <tr key={i} className={`border-t border-[#e2e6ec] ${i % 2 ? 'bg-white' : 'bg-[#fafbfc]'}`}>
                  <td className={`${TDL} bg-[#f5f7fa] font-medium`}>{padronizarCaixa(l.descricao)}</td>
                  <td className={TD}>{numero(l.valorComercial)}</td>
                  <td className={TD}>{numero(l.valorProducao)}</td>
                  <td className={`${TD} ${mut}`}>{l.percentual ? `${l.percentual.toFixed(2).replace('.', ',')}%` : '—'}</td>
                  <td className={TD}>{numero(l.valorReal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
