import * as XLSX from 'xlsx'
import { padronizarCaixa } from '../utils/caixa'
import {
  ROTULO_ENSINO, agruparPorEnsino, agruparPorLocal, somarResultados,
  type MetasPct, type ResultadoProjeto, type Totais,
} from './economiaFechados'

// Export no formato da planilha de referência (analise_metas_margem_por_local_v2): duas abas,
// "Metas de margem" e "Economia dos fechados", cada uma com RESUMO POR LOCAL e um bloco por local.

type Cel = string | number | null
const MONEY = '#,##0.00;[Red]-#,##0.00'
const PCT = '0.0%'

class Folha {
  rows: Cel[][] = []
  fmts: (string | undefined)[][] = []
  merges: XLSX.Range[] = []
  add(row: Cel[], fmt: (string | undefined)[] = []) { this.rows.push(row); this.fmts.push(fmt); return this.rows.length - 1 }
  mesclar(linha: number, ateColuna: number) { this.merges.push({ s: { r: linha, c: 0 }, e: { r: linha, c: ateColuna } }) }
  vazia() { this.add([]) }
  toSheet(larguras: number[]): XLSX.WorkSheet {
    const ws = XLSX.utils.aoa_to_sheet(this.rows)
    this.fmts.forEach((fr, r) => fr.forEach((z, c) => {
      if (!z) return
      const cell = ws[XLSX.utils.encode_cell({ r, c })]
      if (cell && cell.t === 'n') cell.z = z
    }))
    ws['!merges'] = this.merges
    ws['!cols'] = larguras.map((wch) => ({ wch }))
    return ws
  }
}

const nome = (r: ResultadoProjeto) => padronizarCaixa(r.turma)
const ens = (r: ResultadoProjeto) => (r.ensino ? ROTULO_ENSINO[r.ensino] : '—')
const brlTxt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
const brl2 = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const frac = (n: number | null) => (n === null ? null : n / 100)
const metaPonderada = (rs: ResultadoProjeto[]) => {
  const rec = rs.reduce((s, r) => s + (r.margemNaMeta !== null ? (r.receita ?? 0) : 0), 0)
  const nm = rs.reduce((s, r) => s + (r.margemNaMeta ?? 0), 0)
  return rec > 0 ? nm / rec : null
}

function situacaoMeta(r: ResultadoProjeto): string {
  if (r.receita === null || r.margemNaMeta === null) return 'sem dados'
  return r.falta > 0 ? 'abaixo da meta' : 'META ATINGIDA'
}
function situacaoEconomia(falta: number, ainda: number): string {
  if (falta <= 0) return 'meta já atingida'
  return ainda <= 0 ? 'META COBERTA' : 'ainda falta'
}

const CAB_METAS = ['Projeto', 'Ensino', 'Receita orçada (R$)', 'Custo orçado (R$)', 'Margem (R$)', 'Margem %', 'Meta %', 'Margem na meta (R$)', 'FALTA p/ meta (R$)', 'EXCEDENTE (R$)', 'Situação']
const FMT_METAS = [undefined, undefined, MONEY, MONEY, MONEY, PCT, PCT, MONEY, MONEY, MONEY]
const CAB_ECON = ['Projeto', 'Ensino', 'FALTA p/ meta (R$)', 'Orçado dos fechados (R$)', 'Contratado dos fechados (R$)', 'Economias (R$)', 'Estouros (R$)', 'ECONOMIA LÍQUIDA (R$)', 'dos quais fechados a zero (R$)', '% da falta coberta', 'AINDA FALTA (R$)', 'AINDA FALTA sem os fechados a zero (R$)', 'Situação']
const FMT_ECON = [undefined, undefined, MONEY, MONEY, MONEY, MONEY, MONEY, MONEY, MONEY, PCT, MONEY, MONEY]

function linhaMetasProjeto(r: ResultadoProjeto): Cel[] {
  return [nome(r), ens(r), r.receita, r.custo, r.margem, frac(r.margemPct), frac(r.metaPct), r.margemNaMeta, r.falta, r.excedente, situacaoMeta(r)]
}
function linhaMetasTotal(rotulo: string, rs: ResultadoProjeto[], t: Totais): Cel[] {
  const rec = rs.reduce((s, r) => s + (r.receita ?? 0), 0)
  const cus = rs.reduce((s, r) => s + (r.custo ?? 0), 0)
  const mar = rs.reduce((s, r) => s + (r.margem ?? 0), 0)
  const nm = rs.reduce((s, r) => s + (r.margemNaMeta ?? 0), 0)
  return [rotulo, '', rec, cus, mar, rec > 0 ? mar / rec : null, metaPonderada(rs), nm, t.falta, t.excedente, t.falta > 0 ? `FALTA ${brlTxt(t.falta)}` : 'META ATINGIDA']
}
function linhaEconProjeto(r: ResultadoProjeto): Cel[] {
  return [nome(r), ens(r), r.falta, r.orcadoFechados, r.contratadoFechados, r.economias, r.estouros, r.liquida, r.fechadosZero,
    r.cobertura, r.aindaFalta, r.aindaFaltaConservador, situacaoEconomia(r.falta, r.aindaFalta)]
}
function linhaEconTotal(rotulo: string, rs: ResultadoProjeto[], t: Totais): Cel[] {
  const of = rs.reduce((s, r) => s + r.orcadoFechados, 0)
  const cf = rs.reduce((s, r) => s + r.contratadoFechados, 0)
  return [rotulo, '', t.falta, of, cf, t.economias, t.estouros, t.liquida, t.fechadosZero, t.cobertura, t.aindaFalta, t.aindaFaltaConservador, situacaoEconomia(t.falta, t.aindaFalta)]
}

function abaMetas(rs: ResultadoProjeto[], metas: MetasPct, geradoEm: string): XLSX.WorkSheet {
  const f = new Folha()
  const grupos = agruparPorLocal(rs)
  const tot = somarResultados(rs)
  f.mesclar(f.add(['METAS DE MARGEM por local — quanto falta (usando o ORÇADO)']), 10)
  f.mesclar(f.add([`Metas: Ensino Médio ${metas.MEDIO}% · Ensino Superior ${metas.SUPERIOR}% · Ensino Fundamental ${metas.FUNDAMENTAL}%. Margem = margem de contribuição ORÇADA ÷ receita orçada (Resumo Geral de cada P.O.). FALTA = quanto o custo orçado precisa cair (R$) para a margem chegar na meta; EXCEDENTE = quanto o projeto já passa da meta. Dados lidos em ${geradoEm}.`]), 10)
  f.vazia()
  f.add(['RESUMO POR LOCAL'])
  f.add(CAB_METAS)
  for (const g of grupos) f.add(linhaMetasTotal(`${g.local.toUpperCase()}  (${g.projetos.length})`, g.projetos, g.totais), FMT_METAS)
  f.add(linhaMetasTotal('TOTAL GERAL', rs, tot), FMT_METAS)
  f.vazia()
  f.add(['RESUMO POR ENSINO'])
  f.add(['Ensino', 'Projetos', 'Receita orçada (R$)', '', 'Margem (R$)', 'Margem %', 'Meta %', '', 'FALTA (R$)', 'EXCEDENTE (R$)', ''])
  for (const e of agruparPorEnsino(rs)) {
    const sub = rs.filter((r) => r.ensino === e.ensino)
    const mar = sub.reduce((s, r) => s + (r.margem ?? 0), 0)
    const rec = sub.reduce((s, r) => s + (r.receita ?? 0), 0)
    f.add([e.ensino ? ROTULO_ENSINO[e.ensino] : 'Sem ensino', sub.length, rec, '', mar, rec > 0 ? mar / rec : null, metaPonderada(sub), '', e.totais.falta, e.totais.excedente, ''],
      [undefined, undefined, MONEY, undefined, MONEY, PCT, PCT, undefined, MONEY, MONEY])
  }
  f.vazia()
  for (const g of grupos) {
    f.vazia()
    f.add([`${g.local.toUpperCase()}   ·   ${g.projetos.length} ${g.projetos.length === 1 ? 'projeto' : 'projetos'}`])
    f.add(CAB_METAS)
    for (const r of g.projetos) f.add(linhaMetasProjeto(r), FMT_METAS)
    f.add(linhaMetasTotal(`TOTAL ${g.local.toUpperCase()}`, g.projetos, g.totais), FMT_METAS)
    const saldo = g.totais.falta - g.totais.excedente
    f.mesclar(f.add([`Saldo líquido de ${g.local.toUpperCase()} (compensando quem passou da meta): ${saldo > 0 ? `faltam R$ ${brl2(saldo)}` : `sobram R$ ${brl2(-saldo)}`}`]), 10)
  }
  return f.toSheet([34, 13, 18, 18, 16, 11, 9, 18, 18, 16, 18])
}

function abaEconomia(rs: ResultadoProjeto[], geradoEm: string, descontaZero: boolean): XLSX.WorkSheet {
  const f = new Folha()
  const grupos = agruparPorLocal(rs)
  const tot = somarResultados(rs)
  f.mesclar(f.add(['QUANTO JÁ FIZEMOS dos itens FECHADOS para a margem — contra o que falta p/ a meta']), 12)
  f.mesclar(f.add([`Economia = orçado − contratado dos itens com status FECHADO (todas as abas de custo). Líquido = economias − estouros. "Fechados a zero" = parte da economia que vem de itens fechados com contratado R$ 0. AINDA FALTA = falta − economia líquida. Dados lidos em ${geradoEm}.${descontaZero ? ' (Tela com "Descontar fechados a zero" ligado.)' : ''}`]), 12)
  f.vazia()
  f.add(['RESUMO POR LOCAL'])
  f.add(CAB_ECON)
  for (const g of grupos) f.add(linhaEconTotal(`${g.local.toUpperCase()}  (${g.projetos.length})`, g.projetos, g.totais), FMT_ECON)
  f.add(linhaEconTotal('TOTAL GERAL', rs, tot), FMT_ECON)
  for (const g of grupos) {
    f.vazia()
    f.add([`${g.local.toUpperCase()}   ·   ${g.projetos.length} ${g.projetos.length === 1 ? 'projeto' : 'projetos'}`])
    f.add(CAB_ECON)
    for (const r of g.projetos) f.add(linhaEconProjeto(r), FMT_ECON)
    f.add(linhaEconTotal(`TOTAL ${g.local.toUpperCase()}`, g.projetos, g.totais), FMT_ECON)
  }
  return f.toSheet([34, 13, 18, 18, 18, 16, 16, 18, 18, 12, 16, 20, 18])
}

function baixar(blob: Blob, arquivo: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = arquivo
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const hoje = () => new Date().toISOString().slice(0, 10)
const dataBR = () => new Date().toLocaleDateString('pt-BR')

export function exportarMetasMargemXlsx(rs: ResultadoProjeto[], metas: MetasPct, descontaZero: boolean) {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, abaMetas(rs, metas, dataBR()), 'Metas de margem')
  XLSX.utils.book_append_sheet(wb, abaEconomia(rs, dataBR(), descontaZero), 'Economia dos fechados')
  XLSX.writeFile(wb, `metas_margem_${hoje()}.xlsx`)
}

/** CSV plano (um projeto por linha, ponto e vírgula, com BOM para o Excel brasileiro abrir os acentos). */
export function exportarMetasMargemCsv(rs: ResultadoProjeto[]) {
  const cab = ['Local', ...CAB_METAS.slice(0, 10), ...CAB_ECON.slice(3, 12), 'Fonte dos valores']
  const linhas: Cel[][] = [cab]
  for (const g of agruparPorLocal(rs)) {
    for (const r of g.projetos) {
      linhas.push([
        g.local, nome(r), ens(r), r.receita, r.custo, r.margem, frac(r.margemPct), frac(r.metaPct), r.margemNaMeta, r.falta, r.excedente,
        r.orcadoFechados, r.contratadoFechados, r.economias, r.estouros, r.liquida, r.fechadosZero, r.cobertura, r.aindaFalta, r.aindaFaltaConservador,
        r.fonte === 'planilha' ? 'Resumo Geral da planilha' : r.fonte === 'itens' ? 'Soma dos itens' : 'Sem dados',
      ])
    }
  }
  // número com vírgula decimal: o Excel em português lê "1234,56" como número (e não como texto/data)
  const textoPtBr = linhas.map((l, i) => (i === 0 ? l : l.map((c) => (typeof c === 'number' ? String(Math.round(c * 10000) / 10000).replace('.', ',') : c))))
  const ws = XLSX.utils.aoa_to_sheet(textoPtBr)
  const csv = XLSX.utils.sheet_to_csv(ws, { FS: ';' })
  baixar(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), `metas_margem_${hoje()}.csv`)
}
