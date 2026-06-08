import * as XLSX from 'xlsx'
import type { Orcamento, ItemOrcamento } from '../types'
import { formatDate } from './formatters'
import { EVENT_TYPE_LABELS } from '../data/defaults'

function temDados(i: ItemOrcamento): boolean {
  return i.custoUnitario > 0 || i.fornecedor.trim() !== '' || i.totalPagoReal > 0 || i.item.trim() !== ''
}

function itemsParaRows(items: ItemOrcamento[]) {
  const filtered = items.filter(temDados)
  const header = ['Item', 'Fornecedor', 'Qtde', 'Custo Unitário', 'Total Orçado', 'V. Pago']
  const rows = filtered.map(i => [
    i.item,
    i.fornecedor,
    i.qtde,
    i.custoUnitario,
    i.totalOrcado,
    i.valorPassadoCliente,
  ])
  const sub = [
    'SUBTOTAL', '', '',
    '',
    filtered.reduce((s, i) => s + i.totalOrcado, 0),
    filtered.reduce((s, i) => s + i.valorPassadoCliente, 0),
  ]
  return [header, ...rows, sub]
}

export function exportarExcel(orc: Orcamento) {
  const wb = XLSX.utils.book_new()

  const allItems      = [...orc.operacaoEstrutura, ...orc.equipe, ...orc.atracao, ...orc.abBebidas, ...orc.extras]
  const totalSympla   = orc.receitasSympla.reduce((s, l) => s + l.total, 0)
  const totalReceitas = orc.bolsaFolia + totalSympla
  const totalOrcado   = allItems.reduce((s, i) => s + i.totalOrcado, 0)
  const totalPago     = allItems.reduce((s, i) => s + i.totalPagoReal, 0)
  const saldo         = totalReceitas - totalPago

  // Aba Resumo
  const resumo = [
    ['ALLIANCE FORMATURAS — ORÇAMENTO DE PRÉ-EVENTO'],
    [],
    ['Tipo',           EVENT_TYPE_LABELS[orc.tipo]],
    ['Instituição',    orc.instituicao],
    ['Turma',          orc.turma],
    ['Data',           formatDate(orc.data)],
    ['Convidados',     orc.quantidadeConvidados],
    ['Status',         orc.status.replace('_', ' ')],
    [],
    ['RESUMO FINANCEIRO'],
    ['Bolsa Folia',    orc.bolsaFolia],
    ['Total Sympla',   totalSympla],
    ['Total Receitas', totalReceitas],
    ['Total Orçado',   totalOrcado],
    ['Total Pago',     totalPago],
    ['Saldo da Turma', saldo],
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumo), 'Resumo')

  // Abas por seção
  const secoes: [string, ItemOrcamento[]][] = [
    ['Operação-Estrutura', orc.operacaoEstrutura],
    ['Equipe',             orc.equipe],
    ['Atração',            orc.atracao],
    ['A&B',                orc.abBebidas],
    ['Extras',             orc.extras],
  ]
  for (const [nome, items] of secoes) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(itemsParaRows(items)), nome)
  }

  // Aba Receitas
  const receitasRows = [
    ['Lote', 'Qtde', 'Valor Unitário', 'Total'],
    ['Bolsa Folia', 1, orc.bolsaFolia, orc.bolsaFolia],
    ...orc.receitasSympla.map(l => [l.nome, l.qtde, l.valorUnitario, l.total]),
    ['TOTAL', '', '', totalReceitas],
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(receitasRows), 'Receitas')

  const filename = `orcamento_${orc.instituicao}_${orc.turma}_${orc.tipo}`.replace(/[\s/]/g, '_').toLowerCase()
  XLSX.writeFile(wb, `${filename}.xlsx`)
}
