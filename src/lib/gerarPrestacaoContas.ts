import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Projeto, SecaoCusto, ItemCusto, CustoAdicional } from '../types'
import { calcResumoProjeto, projetoVisaoCliente, filtrarItensCalculo } from '../utils/calculos'

// Prestação de Contas Pós-Evento (visão do cliente) — modelo baseado na
// prestação real UNIFENAS 45. Usa só dados do P.O. (visão do cliente, sem
// "Despesa Fee"). NÃO inventa dados que vivem no Everest (Data de pagamento por
// item, anexo iFormando, cenários de saldo com alocação manual ficam de fora).

type RGB = [number, number, number]
const M = 14                       // margem lateral (mm)
const COR_ESCURA: RGB = [10, 10, 10]
const COR_GRUPO: RGB = [17, 24, 39]
const COR_SUB: RGB = [241, 245, 249]
const COR_TOTAL: RGB = [226, 51, 41]   // vermelho Alliance

function fmt(v: number): string {
  return (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtData(iso?: string): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return d && m && y ? `${d}/${m}/${y}` : '—'
}
function finalY(doc: jsPDF): number {
  return (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 26
}

// Itens de uma seção que valem pro cliente: sem N/A/agrupadoras/vazias e só com valor real.
function itensReais(secao: SecaoCusto): ItemCusto[] {
  return filtrarItensCalculo(secao.itens)
    .filter(i => i.valorOrcado > 0 || i.valorPago > 0 || i.valorContratado > 0)
    .sort((a, b) => Math.max(b.valorPago, b.valorOrcado) - Math.max(a.valorPago, a.valorOrcado))
}
function ehAdministrativa(secao: SecaoCusto): boolean {
  return `${secao.numero} ${secao.nome}`.toLowerCase().includes('administrativ')
}

// ─── Cabeçalho (barra escura, repetida em cada página) ───────────────
function desenharCabecalho(doc: jsPDF, pw: number) {
  doc.setFillColor(...COR_ESCURA)
  doc.rect(0, 0, pw, 18, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12)
  doc.text('Alliance Produções', M, 8)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
  doc.text('Produção de Formaturas', M, 13.5)
  doc.setFontSize(9); doc.setFont('helvetica', 'bold')
  doc.text('Prestação de Contas Pós-Evento', pw - M, 8, { align: 'right' })
  doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(180, 180, 180)
  doc.text('Documento Confidencial', pw - M, 13.5, { align: 'right' })
  doc.setTextColor(0, 0, 0)
}

// ─── Bloco de informações do projeto ─────────────────────────────────
function desenharInfo(doc: jsPDF, pw: number, p: Projeto): number {
  const t = p.tap
  const status = p.status === 'realizado' ? 'CONCLUÍDO' : 'EM ANDAMENTO'
  const convidados = t.qtdConvidadosBaile || t.qtdFormandos || 0
  const projetoNome = [t.instituicao, t.turma].filter(Boolean).join(' — ') || '—'

  let y = 26
  doc.setFontSize(9); doc.setTextColor(0, 0, 0)
  const linha = (labelL: string, valL: string, labelR: string, valR: string) => {
    doc.setFont('helvetica', 'bold'); doc.text(labelL, M, y)
    doc.setFont('helvetica', 'normal'); doc.text(valL, M + 32, y)
    if (labelR) {
      doc.setFont('helvetica', 'bold'); doc.text(labelR, pw / 2 + 6, y)
      doc.setFont('helvetica', 'normal'); doc.text(valR, pw / 2 + 30, y)
    }
    y += 6
  }
  linha('Projeto:', projetoNome, 'Convidados:', String(convidados))
  linha('Data do Evento:', fmtData(t.dataEvento), 'Status:', status)
  linha('Local:', t.local || '—', '', '')

  doc.setDrawColor(...COR_TOTAL); doc.setLineWidth(0.6)
  doc.line(M, y - 1, pw - M, y - 1)
  return y + 4
}

// ─── Título de bloco (SEÇÃO A / B / RESUMO) ──────────────────────────
function tituloBloco(doc: jsPDF, pw: number, titulo: string, subtitulo: string, y: number): number {
  const ph = doc.internal.pageSize.getHeight()
  if (y > ph - 40) { doc.addPage(); desenharCabecalho(doc, pw); y = 26 }
  doc.setFillColor(...COR_ESCURA)
  doc.rect(M, y, pw - 2 * M, 7, 'F')
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5)
  doc.text(titulo, M + 3, y + 4.8)
  doc.setTextColor(0, 0, 0)
  y += 10
  if (subtitulo) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(90, 90, 90)
    doc.text(subtitulo, M, y)
    doc.setTextColor(0, 0, 0)
    y += 5
  }
  return y
}

type LinhaTabela = (string | { content: string; colSpan?: number; styles?: Record<string, unknown> })[]

// ─── Tabela de despesas (Seção A ou B): grupos + itens + subtotais ───
function tabelaDespesas(doc: jsPDF, pw: number, secoes: SecaoCusto[], custosExtras: CustoAdicional[], y: number, tituloTotal: string): { finalY: number; totContratado: number; totPago: number } {
  const body: LinhaTabela[] = []
  let totContratado = 0, totPago = 0

  for (const secao of secoes) {
    const itens = itensReais(secao)
    if (itens.length === 0) continue
    const nome = `${secao.numero} ${secao.nome}`.trim().toUpperCase()
    body.push([{ content: nome, colSpan: 6, styles: { fillColor: COR_GRUPO, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left', fontSize: 8 } }])

    let subCont = 0, subPago = 0
    for (const it of itens) {
      subCont += it.valorContratado; subPago += it.valorPago
      body.push([
        it.item || it.subcategoria || '—',
        it.fornecedor || '—',
        it.qtdeContratada || it.qtdeOrcada ? String(it.qtdeContratada || it.qtdeOrcada) : '',
        fmt(it.valorUnitarioContratado),
        fmt(it.valorContratado),
        fmt(it.valorPago),
      ])
    }
    totContratado += subCont; totPago += subPago
    body.push([
      { content: 'Subtotal', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold', fillColor: COR_SUB } },
      { content: fmt(subCont), styles: { halign: 'right', fontStyle: 'bold', fillColor: COR_SUB } },
      { content: fmt(subPago), styles: { halign: 'right', fontStyle: 'bold', fillColor: COR_SUB } },
    ])
  }

  // Verbas extras (custos sem seção própria) — pra o total bater com o resumo/app.
  const extras = (custosExtras ?? []).filter(c => c.contratado > 0 || c.pago > 0)
  if (extras.length > 0) {
    body.push([{ content: 'VERBAS EXTRAS', colSpan: 6, styles: { fillColor: COR_GRUPO, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left', fontSize: 8 } }])
    let subCont = 0, subPago = 0
    for (const c of extras) {
      subCont += c.contratado; subPago += c.pago
      body.push([c.descricao || 'Verba extra', '—', '', '', fmt(c.contratado), fmt(c.pago)])
    }
    totContratado += subCont; totPago += subPago
    body.push([
      { content: 'Subtotal', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold', fillColor: COR_SUB } },
      { content: fmt(subCont), styles: { halign: 'right', fontStyle: 'bold', fillColor: COR_SUB } },
      { content: fmt(subPago), styles: { halign: 'right', fontStyle: 'bold', fillColor: COR_SUB } },
    ])
  }

  autoTable(doc, {
    startY: y,
    margin: { top: 24, bottom: 16, left: M, right: M },
    head: [['Item', 'Fornecedor', 'Qtde', 'Custo Unit.', 'Total Contratado', 'Total Pago']],
    body,
    foot: [[
      { content: tituloTotal, colSpan: 4, styles: { halign: 'right' } },
      { content: fmt(totContratado), styles: { halign: 'right' } },
      { content: fmt(totPago), styles: { halign: 'right' } },
    ]],
    styles: { fontSize: 7.5, cellPadding: 1.8, overflow: 'linebreak' },
    headStyles: { fillColor: COR_ESCURA, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    footStyles: { fillColor: COR_TOTAL, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 46 },
      1: { cellWidth: 42 },
      2: { cellWidth: 14, halign: 'center' },
      3: { cellWidth: 26, halign: 'right' },
      4: { cellWidth: 27, halign: 'right' },
      5: { cellWidth: 27, halign: 'right' },
    },
    didDrawPage: () => desenharCabecalho(doc, pw),
  })

  return { finalY: finalY(doc), totContratado, totPago }
}

// ─── Resumo consolidado ──────────────────────────────────────────────
// % do "(CC) Custo Cerimonial" do projeto (o fee que a turma paga), do resumoComercial.
function feeCerimonialPctPdf(p: Projeto): number {
  const l = (p.resumoComercial ?? []).find(x => /custo cerimonial|\(cc\)/i.test(x.descricao ?? ''))
  return l?.percentual ?? 0
}

function tabelaResumo(
  doc: jsPDF, pw: number, p: Projeto, y: number,
  totA: { totContratado: number; totPago: number }, totB: { totContratado: number; totPago: number },
) {
  const r = calcResumoProjeto(p)
  const recebidas = r.receitas.filter(l => l.pago > 0)
  const recRecebida = r.receitaBaile.pago
  const ccPct = feeCerimonialPctPdf(p)
  const fee = recRecebida * (ccPct / 100)
  const arrecadadoLiq = recRecebida - fee
  const custoContratado = totA.totContratado + totB.totContratado
  const custoPago = totA.totPago + totB.totPago
  const saldoLiquido = arrecadadoLiq - custoPago

  // Receitas recebidas (por origem)
  autoTable(doc, {
    startY: y,
    margin: { top: 24, bottom: 16, left: M, right: M },
    head: [['Receita recebida', 'Valor (Everest)']],
    body: recebidas.length > 0 ? recebidas.map(l => [l.descricao, fmt(l.pago)]) : [['(nenhuma receita recebida até agora)', fmt(0)]],
    foot: [[
      { content: 'RECEITA RECEBIDA', styles: { halign: 'right' } },
      { content: fmt(recRecebida), styles: { halign: 'right' } },
    ]],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: COR_ESCURA, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    footStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 50, halign: 'right' } },
    didDrawPage: () => desenharCabecalho(doc, pw),
  })

  // Consolidado — mesma lógica da tela: fee descontado, custo contratado, saldo líquido.
  const linha = (label: string, valor: number, styles?: Record<string, unknown>): LinhaTabela => [
    { content: label, styles: { halign: 'left', ...styles } },
    { content: fmt(valor), styles: { halign: 'right', ...styles } },
  ]

  autoTable(doc, {
    startY: finalY(doc) + 4,
    margin: { top: 24, bottom: 16, left: M, right: M },
    head: [['Consolidado', 'Valor']],
    body: [
      linha('(+) Receita recebida', recRecebida),
      linha(`(−) Fee Alliance (${ccPct.toFixed(ccPct % 1 === 0 ? 0 : 2)}%)`, -fee),
      linha('(=) Arrecadado da turma', arrecadadoLiq, { fontStyle: 'bold', fillColor: COR_SUB }),
      linha('Custo do evento (contratado)', custoContratado),
      linha('(−) Já pago aos fornecedores', -custoPago),
      linha('Falta pagar', custoContratado - custoPago),
    ],
    foot: [linha('SALDO LÍQUIDO  (arrecadado − pago)', saldoLiquido, { fontStyle: 'bold' })],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: COR_ESCURA, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    footStyles: { fillColor: COR_TOTAL, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
    columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 50, halign: 'right' } },
    didDrawPage: () => desenharCabecalho(doc, pw),
  })
}

// ─── Rodapé (numeração), carimbado no fim em todas as páginas ────────
function carimbarRodape(doc: jsPDF, pw: number) {
  const ph = doc.internal.pageSize.getHeight()
  const total = doc.getNumberOfPages()
  const emitido = new Date().toLocaleDateString('pt-BR')
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setFontSize(7); doc.setTextColor(130, 130, 130); doc.setFont('helvetica', 'normal')
    doc.text('Alliance Produções — Documento Confidencial', M, ph - 8)
    doc.text(`Emitido em ${emitido}`, pw / 2, ph - 8, { align: 'center' })
    doc.text(`Página ${i} de ${total}`, pw - M, ph - 8, { align: 'right' })
  }
  doc.setTextColor(0, 0, 0)
}

// ─── Construção (retorna o doc, testável) ────────────────────────────
export function construirPrestacaoContas(projetoRaw: Projeto): jsPDF {
  const p = projetoVisaoCliente(projetoRaw)   // remove "Despesa Fee"
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pw = doc.internal.pageSize.getWidth()

  desenharCabecalho(doc, pw)
  let y = desenharInfo(doc, pw, p)

  const secoesA = p.secoes.filter(s => !ehAdministrativa(s))
  const secoesB = p.secoes.filter(s => ehAdministrativa(s))

  y = tituloBloco(doc, pw, 'SEÇÃO A — DESPESAS OPERACIONAIS DA FESTA', 'Custos diretos vinculados à execução do evento, por categoria.', y)
  const totA = tabelaDespesas(doc, pw, secoesA, p.custosAdicionais ?? [], y, 'TOTAL — DESPESAS OPERACIONAIS')
  y = totA.finalY + 8

  let totB = { finalY: y, totContratado: 0, totPago: 0 }
  const temB = secoesB.some(s => itensReais(s).length > 0)
  if (temB) {
    y = tituloBloco(doc, pw, 'SEÇÃO B — DESPESAS ADMINISTRATIVAS DO PROJETO', 'Despesas administrativas do projeto, não atreladas à execução da festa.', y)
    totB = tabelaDespesas(doc, pw, secoesB, [], y, 'TOTAL — DESPESAS ADMINISTRATIVAS')
    y = totB.finalY + 8
  }

  y = tituloBloco(doc, pw, 'RESUMO FINANCEIRO CONSOLIDADO', '', y)
  tabelaResumo(doc, pw, p, y, totA, totB)

  carimbarRodape(doc, pw)
  return doc
}

export function gerarPrestacaoContas(projeto: Projeto) {
  const doc = construirPrestacaoContas(projeto)
  const turma = (projeto.tap.turma || projeto.tap.instituicao || 'projeto').replace(/\s+/g, '_')
  doc.save(`Prestacao_de_Contas_${turma}_${new Date().toISOString().slice(0, 10)}.pdf`)
}
