import * as XLSX from 'xlsx'
import type { MetasPct } from './economiaFechados'
import { REGRAS, type LinhaRadar } from './radarMargem'
import { padronizarCaixa } from '../utils/caixa'

// Exporta o Radar de margem (o que está na tela) para Excel: aba "Radar" (um projeto por linha),
// aba "O que fazer" (uma ação por linha) e aba "Regras" (parâmetros usados e datas das fontes).

type Cel = string | number | null
const MONEY = '#,##0;[Red]-#,##0'
const PCT = '0.0%'
const ROTULO_COR: Record<LinhaRadar['cor'], string> = { vermelho: 'Vermelho', amarelo: 'Amarelo', verde: 'Verde', cinza: 'Sem dado' }
const ROTULO_NIVEL = { alta: 'Alta', media: 'Média', baixa: 'Baixa' } as const

const nz = (v: number | null | undefined): number | null => (v == null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100)
const frac = (v: number | null | undefined): number | null => (v == null || !Number.isFinite(v) ? null : Math.round(v * 100) / 10000) // % → fração
const dataBR = (iso: string | null): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '')
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

const CAB = [
  'Semáforo', 'Projeto', 'Local', 'Ensino', 'Evento', 'Dias', 'Receita orçada', 'Custo orçado', 'Margem orçada', '% orçada',
  'Economia líquida', 'Margem projetada', '% projetada', 'Pessimista %', 'Meta %', 'Falta p/ meta', 'Sem fechar (orçado)', '% do custo',
  'Contratado', 'Pago', 'SGE previsto', 'SGE recebido', 'SGE vencido', 'Caixa (rec−pago)', 'Motivo', 'Conferir dado',
]
const LARG = [11, 26, 18, 13, 11, 6, 15, 15, 15, 9, 15, 16, 11, 11, 8, 15, 17, 10, 15, 15, 15, 15, 14, 16, 50, 60]
const COL_MONEY = [6, 7, 8, 10, 11, 15, 16, 18, 19, 20, 21, 22, 23]
const COL_PCT = [9, 12, 13, 14, 17]

function abaRadar(linhas: LinhaRadar[]): XLSX.WorkSheet {
  const rows: Cel[][] = [CAB]
  for (const l of linhas) {
    rows.push([
      ROTULO_COR[l.cor], padronizarCaixa(l.turma), l.local, l.ensino ?? '', dataBR(l.dataEvento), l.dias,
      nz(l.receita), nz(l.custo), nz(l.margem), frac(l.margemPct),
      nz(l.liquida), nz(l.projetada), frac(l.projPct), frac(l.pessPct), frac(l.meta),
      nz(Math.max(0, l.aindaFalta || 0)), nz(l.exposicao), frac(l.expPct),
      nz(l.contratado), nz(l.pago), nz(l.sge?.previsto), nz(l.sge?.recebido), nz(l.sge?.vencido), nz(l.caixa),
      l.motivo, l.alertas.join(' | '),
    ])
  }
  const ws = XLSX.utils.aoa_to_sheet(rows)
  for (let r = 1; r < rows.length; r++) {
    for (const c of COL_MONEY) { const cel = ws[XLSX.utils.encode_cell({ r, c })]; if (cel && cel.t === 'n') cel.z = MONEY }
    for (const c of COL_PCT) { const cel = ws[XLSX.utils.encode_cell({ r, c })]; if (cel && cel.t === 'n') cel.z = PCT }
  }
  ws['!cols'] = LARG.map((wch) => ({ wch }))
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: CAB.length - 1 } }) }
  return ws
}

function abaAcoes(linhas: LinhaRadar[]): XLSX.WorkSheet {
  const rows: Cel[][] = [['Projeto', 'Semáforo', 'Prioridade', 'Ação']]
  for (const l of linhas) for (const a of l.acoes) rows.push([padronizarCaixa(l.turma), ROTULO_COR[l.cor], ROTULO_NIVEL[a.nivel], a.texto])
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 26 }, { wch: 11 }, { wch: 11 }, { wch: 140 }]
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(rows.length - 1, 0), c: 3 } }) }
  return ws
}

function abaRegras(taxa: number, metas: MetasPct, sgeEm: Date | null): XLSX.WorkSheet {
  const pctTxt = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
  const rows: Cel[][] = [
    ['Regra', 'Valor'],
    ['Tolerância do amarelo (p.p. abaixo da meta)', REGRAS.toleranciaAmarelo],
    ['Atraso no SGE que vira alerta (% do previsto)', REGRAS.vencidoAlertaPct],
    ['Exposição que vira alerta (% do custo sem fechar)', REGRAS.exposicaoAlertaPct],
    ['Evento "urgente" (dias)', REGRAS.diasUrgente],
    ['Receita da P.O. acima do SGE que vira alerta (%)', REGRAS.receitaSemSgePct],
    ['Taxa de estouro da carteira (cenário pessimista)', pctTxt(taxa * 100)],
    ['Metas de margem', `Médio ${pctTxt(metas.MEDIO)} · Superior ${pctTxt(metas.SUPERIOR)} · Fundamental ${pctTxt(metas.FUNDAMENTAL)}`],
    ['Gerado em', new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })],
    ['SGE de', sgeEm ? sgeEm.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'],
  ]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 52 }, { wch: 52 }]
  return ws
}

export function montarPlanilhaRadar(linhas: LinhaRadar[], taxa: number, metas: MetasPct, sgeEm: Date | null): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, abaRadar(linhas), 'Radar')
  XLSX.utils.book_append_sheet(wb, abaAcoes(linhas), 'O que fazer')
  XLSX.utils.book_append_sheet(wb, abaRegras(taxa, metas, sgeEm), 'Regras')
  return wb
}

export function exportarRadarXlsx(linhas: LinhaRadar[], taxa: number, metas: MetasPct, sgeEm: Date | null) {
  XLSX.writeFile(montarPlanilhaRadar(linhas, taxa, metas, sgeEm), `radar_margem_${new Date().toISOString().slice(0, 10)}.xlsx`)
}
