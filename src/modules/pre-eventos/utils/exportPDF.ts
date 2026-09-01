import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Orcamento, ItemOrcamento } from '../types'
import { statusFornecedor, lineupView } from '../types'
import { EVENT_TYPE_LABELS } from '../data/defaults'
import { formatBRL, formatDate } from './formatters'
import allianceLogo from '../../../assets/alliance-logo.png'

const HDR_BG   = [26, 26, 46]   as [number,number,number]
const HDR_TEXT = [255,255,255]  as [number,number,number]
const ACC      = [233, 69, 96]  as [number,number,number]
const ROW_EVEN = [248,248,250]  as [number,number,number]
const ROW_ODD  = [255,255,255]  as [number,number,number]
const TEXT     = [30, 30, 30]   as [number,number,number]
const TEXT_MUT = [100,100,120]  as [number,number,number]
const SUB_BG   = [240,240,248]  as [number,number,number]
const GREEN    = [0, 150, 100]  as [number,number,number]
const RED      = [200, 60, 60]  as [number,number,number]

function temDados(i: ItemOrcamento): boolean {
  return i.custoUnitario > 0 || i.fornecedor.trim() !== '' || i.totalPagoReal > 0 || i.item.trim() !== ''
}


function secaoTable(doc: jsPDF, titulo: string, items: ItemOrcamento[]) {
  const filtered = items.filter(temDados)
  if (filtered.length === 0) return

  let y = (doc as any).lastAutoTable?.finalY ?? 40
  const estimatedH = 20 + (filtered.length + 1) * 7
  if (200 - y < Math.min(estimatedH, 45)) {
    doc.addPage()
    y = 8
    ;(doc as any).lastAutoTable = { finalY: 8 }
  }

  doc.setFillColor(...HDR_BG)
  doc.rect(10, y + 3, 277, 7, 'F')
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...HDR_TEXT)
  doc.text(titulo, 13, y + 8.5)

  const rows = filtered.map(i => {
    const fornDisplay = i.fornecedor
      ? i.fornecedor.split('||').map(s => s.trim()).filter(Boolean).join(', ')
      : '—'
    return [
      i.item,
      fornDisplay,
      String(i.qtde),
      formatBRL(i.custoUnitario),
      formatBRL(i.totalOrcado),
      formatBRL(i.valorPassadoCliente),
      i.dataPagamento ? formatDate(i.dataPagamento) : '—',
    ]
  })

  const subtotalRow = [
    'SUBTOTAL', '', '', '',
    formatBRL(filtered.reduce((s, i) => s + i.totalOrcado, 0)),
    formatBRL(filtered.reduce((s, i) => s + i.valorPassadoCliente, 0)),
    '',
  ]

  autoTable(doc, {
    startY: y + 12,
    head: [['Item', 'Fornecedor', 'Qtde', 'Custo Unitário', 'Total Orçado', 'V. Pago', 'Data Pgto.']],
    body: rows,
    foot: [subtotalRow],
    theme: 'grid',
    headStyles: {
      fillColor: [60, 60, 90] as [number,number,number],
      textColor: HDR_TEXT,
      fontSize: 9,
      fontStyle: 'bold',
    },
    bodyStyles: {
      textColor: TEXT,
      fontSize: 9,
      fillColor: ROW_ODD,
    },
    alternateRowStyles: {
      fillColor: ROW_EVEN,
    },
    footStyles: {
      fillColor: SUB_BG,
      textColor: TEXT,
      fontStyle: 'bold',
      fontSize: 9,
    },
    styles: {
      lineColor: [220, 220, 230] as [number,number,number],
      lineWidth: 0.1,
    },
    margin: { left: 10, right: 10 },
    columnStyles: {
      0: { cellWidth: 47 },
      1: { cellWidth: 47 },
      2: { cellWidth: 18, halign: 'right' },
      3: { cellWidth: 38, halign: 'right' },
      4: { cellWidth: 38, halign: 'right' },
      5: { cellWidth: 38, halign: 'right' },
      6: { cellWidth: 27, halign: 'center' },
    },
  })
}

function receitasTable(doc: jsPDF, orc: Orcamento) {
  const totalSympla   = orc.receitasSympla.reduce((s, l) => s + l.total, 0)
  const totalReceitas = orc.bolsaFolia + totalSympla

  const rows = [
    ['Bolsa Folia', '1', formatBRL(orc.bolsaFolia), formatBRL(orc.bolsaFolia)],
    ...orc.receitasSympla.map(l => [l.nome, String(l.qtde), formatBRL(l.valorUnitario), formatBRL(l.total)]),
  ]

  let y = (doc as any).lastAutoTable?.finalY ?? 40
  const estimatedH = 20 + (rows.length + 2) * 8
  if (200 - y < estimatedH && estimatedH <= 165) {
    doc.addPage()
    y = 8
    ;(doc as any).lastAutoTable = { finalY: 8 }
  }

  doc.setFillColor(...HDR_BG)
  doc.rect(10, y + 3, 277, 7, 'F')
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...HDR_TEXT)
  doc.text('RECEITAS', 13, y + 8.5)

  autoTable(doc, {
    startY: y + 12,
    head: [['Lote / Descrição', 'Qtde', 'Valor Unitário', 'Total']],
    body: rows,
    foot: [['TOTAL', '', '', formatBRL(totalReceitas)]],
    theme: 'grid',
    headStyles: { fillColor: [60, 60, 90] as [number,number,number], textColor: HDR_TEXT, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { textColor: TEXT, fontSize: 9, fillColor: ROW_ODD },
    alternateRowStyles: { fillColor: ROW_EVEN },
    footStyles: { fillColor: SUB_BG, textColor: TEXT, fontStyle: 'bold', fontSize: 9 },
    styles: { lineColor: [220, 220, 230] as [number,number,number], lineWidth: 0.1 },
    margin: { left: 10, right: 10 },
    columnStyles: {
      0: { cellWidth: 120 },
      1: { cellWidth: 25, halign: 'right' },
      2: { cellWidth: 56, halign: 'right' },
      3: { cellWidth: 56, halign: 'right' },
    },
  })
}

function secaoTablePendentes(doc: jsPDF, titulo: string, items: ItemOrcamento[]) {
  const pendentes = items.filter(i => i.status === 'PENDENTE' && temDados(i))
  if (pendentes.length === 0) return

  let y = (doc as any).lastAutoTable?.finalY ?? 40
  const estimatedH = 20 + (pendentes.length + 1) * 7
  if (200 - y < Math.min(estimatedH, 45)) {
    doc.addPage()
    y = 8
    ;(doc as any).lastAutoTable = { finalY: 8 }
  }

  doc.setFillColor(...RED)
  doc.rect(10, y + 3, 277, 7, 'F')
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...HDR_TEXT)
  doc.text(titulo, 13, y + 8.5)

  const rows = pendentes.map(i => {
    const fornDisplay = i.fornecedor
      ? i.fornecedor.split('||').map(s => s.trim()).filter(Boolean).join(', ')
      : '—'
    return [i.item, fornDisplay, String(i.qtde), formatBRL(i.custoUnitario), formatBRL(i.totalOrcado), i.notas || '—']
  })

  autoTable(doc, {
    startY: y + 12,
    head: [['Item', 'Fornecedor', 'Qtde', 'Custo Unitário', 'Total Orçado', 'Notas']],
    body: rows,
    theme: 'grid',
    headStyles: {
      fillColor: [60, 60, 90] as [number,number,number],
      textColor: HDR_TEXT,
      fontSize: 9,
      fontStyle: 'bold',
    },
    bodyStyles: {
      textColor: TEXT,
      fontSize: 9,
      fillColor: ROW_ODD,
    },
    alternateRowStyles: {
      fillColor: ROW_EVEN,
    },
    styles: {
      lineColor: [220, 220, 230] as [number,number,number],
      lineWidth: 0.1,
    },
    margin: { left: 10, right: 10 },
    columnStyles: {
      0: { cellWidth: 55 },
      1: { cellWidth: 55 },
      2: { cellWidth: 18, halign: 'right' },
      3: { cellWidth: 40, halign: 'right' },
      4: { cellWidth: 40, halign: 'right' },
      5: { cellWidth: 69 },
    },
  })
}

function logoParaBranco(img: HTMLImageElement): string {
  const canvas = document.createElement('canvas')
  canvas.width  = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  ctx.globalCompositeOperation = 'source-in'
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/png')
}

export async function exportarPDF(orc: Orcamento) {
  const logoImg = await new Promise<HTMLImageElement>((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(img)
    img.src = allianceLogo
  })
  const hasLogo   = logoImg.naturalWidth > 0
  const logoRatio = hasLogo ? logoImg.naturalWidth / logoImg.naturalHeight : 4
  const logoBranco = hasLogo ? logoParaBranco(logoImg) : ''
  const logoH     = 11                        // mm — cabeçalho (~40px)
  const logoW     = logoH * logoRatio
  const logoHF    = 4.5                       // mm — rodapé (~20px)
  const logoWF    = logoHF * logoRatio

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, 297, 210, 'F')

  // Cabeçalho
  doc.setFillColor(...ACC)
  doc.rect(0, 0, 297, 16, 'F')
  if (hasLogo) doc.addImage(logoBranco, 'PNG', 10, 2.5, logoW, logoH)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...HDR_TEXT)
  doc.text('ALLIANCE FORMATURAS', hasLogo ? 10 + logoW + 3 : 10, 11)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('Orçamento de Pré-Evento — Documento Confidencial', 287, 11, { align: 'right' })

  // Info evento
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...TEXT)
  doc.text(`${orc.instituicao || '—'} — ${orc.turma || '—'}`, 10, 24)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...TEXT_MUT)
  doc.text(
    `${EVENT_TYPE_LABELS[orc.tipo]}  |  Data: ${formatDate(orc.data)}  |  Convidados: ${orc.quantidadeConvidados}  |  Status: ${orc.status.replace('_', ' ')}`,
    10, 30,
  )

  doc.setDrawColor(220, 220, 230)
  doc.setLineWidth(0.3)
  doc.line(10, 33, 287, 33)
  ;(doc as any).lastAutoTable = { finalY: 33 }

  // Seções
  secaoTable(doc, 'OPERAÇÃO / ESTRUTURA',       orc.operacaoEstrutura)
  secaoTable(doc, 'EQUIPE',                      orc.equipe)
  secaoTable(doc, 'ATRAÇÃO',                     orc.atracao)
  secaoTable(doc, 'A&B — ALIMENTOS E BEBIDAS',   orc.abBebidas)
  secaoTable(doc, 'EXTRAS',                      orc.extras)
  receitasTable(doc, orc)

  // Resumo financeiro
  const finalY = (doc as any).lastAutoTable?.finalY ?? 140
  let sy = finalY + 6
  if (sy > 133) { doc.addPage(); sy = 12 } // sempre renderiza o resumo — nova página se faltar espaço (bloco tem 9 linhas)

  const totalSympla   = orc.receitasSympla.reduce((s, l) => s + l.total, 0)
  const totalReceitas = orc.bolsaFolia + totalSympla
  const allItems      = [...orc.operacaoEstrutura, ...orc.equipe, ...orc.atracao, ...orc.abBebidas, ...orc.extras]
  const totalOrcado   = allItems.reduce((s, i) => s + i.totalOrcado, 0)
  const totalPago     = allItems.reduce((s, i) => s + i.totalPagoReal, 0)
  const totalCliente  = allItems.reduce((s, i) => s + i.valorPassadoCliente, 0)
  const totalPagoComissao = allItems.reduce((s, i) => s + (i.status === 'PAGO_COMISSAO' ? i.valorPassadoCliente : 0), 0)
  const totalBV       = allItems.reduce((s, i) => s + (i.status === 'PAGO_COMISSAO' ? 0 : i.valorPassadoCliente - i.totalPagoReal), 0)
  const saldo         = totalReceitas - totalCliente // Saldo da Turma = Receitas − Passado ao Cliente

  doc.setFillColor(...HDR_BG)
  doc.rect(10, sy, 120, 7, 'F')
  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...HDR_TEXT)
  doc.text('RESUMO FINANCEIRO', 13, sy + 5.5)

  const linhas: [string, number][] = [
    ['Bolsa Folia',      orc.bolsaFolia],
    ['Total Ingressos',  totalSympla],
    ['Total Receitas',   totalReceitas],
    ['Total Orçado',     totalOrcado],
    ['Pago Alliance',    totalPago],
    ['Pago Comissão',    totalPagoComissao],
    ['Passado ao Cliente', totalCliente],
    ['Resultado Alliance (BV)', totalBV],
    ['Saldo da Turma',   saldo],
  ]

  doc.setFontSize(9); doc.setFont('helvetica', 'normal')
  linhas.forEach(([k, v], i) => {
    const ry = sy + 13 + i * 6
    doc.setTextColor(...TEXT_MUT); doc.text(k, 13, ry)
    const isColor = k.startsWith('Saldo') || k.startsWith('Total Receitas')
    doc.setTextColor(...(isColor ? (v >= 0 ? GREEN : RED) : TEXT))
    doc.text(formatBRL(v), 128, ry, { align: 'right' })
  })

  // Rodapé
  const total = doc.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    doc.setFillColor(245, 245, 248)
    doc.rect(0, 203, 297, 7, 'F')
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...TEXT_MUT)
    if (hasLogo) doc.addImage(logoImg, 'PNG', 10, 204, logoWF, logoHF)
    doc.text('Alliance Formaturas — Documento Confidencial', hasLogo ? 10 + logoWF + 2 : 10, 207.5)
    doc.text(`Página ${p} de ${total}`, 287, 207.5, { align: 'right' })
  }

  const filename = `orcamento_${orc.instituicao}_${orc.turma}_${orc.tipo}`.replace(/[\s/]/g, '_').toLowerCase()
  doc.save(`${filename}.pdf`)
}

export async function exportarPendenciasPDF(orc: Orcamento) {
  const logoImg = await new Promise<HTMLImageElement>((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(img)
    img.src = allianceLogo
  })
  const hasLogo   = logoImg.naturalWidth > 0
  const logoRatio = hasLogo ? logoImg.naturalWidth / logoImg.naturalHeight : 4
  const logoBranco = hasLogo ? logoParaBranco(logoImg) : ''
  const logoH     = 11
  const logoW     = logoH * logoRatio
  const logoHF    = 4.5
  const logoWF    = logoHF * logoRatio

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, 297, 210, 'F')

  // Cabeçalho
  doc.setFillColor(...RED)
  doc.rect(0, 0, 297, 16, 'F')
  if (hasLogo) doc.addImage(logoBranco, 'PNG', 10, 2.5, logoW, logoH)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...HDR_TEXT)
  doc.text('ALLIANCE FORMATURAS', hasLogo ? 10 + logoW + 3 : 10, 11)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('Itens Pendentes de Fechamento — Para Produção', 287, 11, { align: 'right' })

  // Info evento
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...TEXT)
  doc.text(`${orc.instituicao || '—'} — ${orc.turma || '—'}`, 10, 24)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...TEXT_MUT)
  doc.text(
    `${EVENT_TYPE_LABELS[orc.tipo]}  |  Data: ${formatDate(orc.data)}  |  Emitido em ${new Date().toLocaleDateString('pt-BR')}`,
    10, 30,
  )

  doc.setDrawColor(220, 220, 230)
  doc.setLineWidth(0.3)
  doc.line(10, 33, 287, 33)
  ;(doc as any).lastAutoTable = { finalY: 33 }

  // Seções — só itens com status PENDENTE
  secaoTablePendentes(doc, 'OPERAÇÃO / ESTRUTURA',       orc.operacaoEstrutura)
  secaoTablePendentes(doc, 'EQUIPE',                      orc.equipe)
  secaoTablePendentes(doc, 'ATRAÇÃO',                     orc.atracao)
  secaoTablePendentes(doc, 'A&B — ALIMENTOS E BEBIDAS',   orc.abBebidas)
  secaoTablePendentes(doc, 'EXTRAS',                      orc.extras)

  const allItems = [...orc.operacaoEstrutura, ...orc.equipe, ...orc.atracao, ...orc.abBebidas, ...orc.extras]
  if (!allItems.some(i => i.status === 'PENDENTE' && temDados(i))) {
    const y = ((doc as any).lastAutoTable?.finalY ?? 33) + 10
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...TEXT_MUT)
    doc.text('Nenhum item pendente — tudo contratado ou pago.', 10, y)
  }

  // Rodapé
  const total = doc.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    doc.setFillColor(245, 245, 248)
    doc.rect(0, 203, 297, 7, 'F')
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...TEXT_MUT)
    if (hasLogo) doc.addImage(logoImg, 'PNG', 10, 204, logoWF, logoHF)
    doc.text('Alliance Formaturas — Documento Confidencial', hasLogo ? 10 + logoWF + 2 : 10, 207.5)
    doc.text(`Página ${p} de ${total}`, 287, 207.5, { align: 'right' })
  }

  const filename = `pendencias_${orc.instituicao}_${orc.turma}`.replace(/[\s/]/g, '_').toLowerCase()
  doc.save(`${filename}.pdf`)
}

// ─── Relatório Cliente ────────────────────────────────────────────────────────
// Visão da TURMA: só o que o cliente paga (V. Cliente). Esconde o orçado interno,
// o custo real (Total Pago) e a margem (BV) — evita a dúvida "orçou 30k, pagou 46.7k".
function secaoTableCliente(doc: jsPDF, titulo: string, items: ItemOrcamento[]) {
  const filtered = items.filter(i => i.valorPassadoCliente > 0)
  if (filtered.length === 0) return

  let y = (doc as any).lastAutoTable?.finalY ?? 40
  // Altura estimada da seção inteira (cabeçalho + linhas + subtotal).
  const estimatedH = 20 + (filtered.length + 2) * 8
  // Mantém a seção inteira na MESMA página: se não couber no que resta e couber
  // numa página nova, começa numa nova. Só divide se for maior que uma página.
  if (200 - y < estimatedH && estimatedH <= 165) {
    doc.addPage(); y = 8; (doc as any).lastAutoTable = { finalY: 8 }
  }

  doc.setFillColor(...HDR_BG)
  doc.rect(10, y + 3, 277, 7, 'F')
  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...HDR_TEXT)
  doc.text(titulo, 13, y + 8.5)

  const rows = filtered.map(i => [
    i.item,
    formatBRL(i.valorPassadoCliente),
  ])
  const subtotal = ['SUBTOTAL', formatBRL(filtered.reduce((s, i) => s + i.valorPassadoCliente, 0))]

  autoTable(doc, {
    startY: y + 12,
    head: [['Item', 'Valor']],
    body: rows,
    foot: [subtotal],
    theme: 'grid',
    rowPageBreak: 'avoid',
    headStyles: { fillColor: [60, 60, 90] as [number,number,number], textColor: HDR_TEXT, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { textColor: TEXT, fontSize: 9, fillColor: ROW_ODD },
    alternateRowStyles: { fillColor: ROW_EVEN },
    footStyles: { fillColor: SUB_BG, textColor: TEXT, fontStyle: 'bold', fontSize: 9 },
    styles: { lineColor: [220, 220, 230] as [number,number,number], lineWidth: 0.1 },
    margin: { left: 10, right: 10 },
    columnStyles: {
      0: { cellWidth: 225 },
      1: { cellWidth: 52, halign: 'right' },
    },
  })
}

// Faixa de título (barra escura), mesmo estilo do cabeçalho de RECEITAS.
function faixaTitulo(doc: jsPDF, titulo: string, y: number) {
  doc.setFillColor(...HDR_BG)
  doc.rect(10, y + 3, 277, 7, 'F')
  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...HDR_TEXT)
  doc.text(titulo, 13, y + 8.5)
}

export async function exportarRelatorioCliente(orc: Orcamento) {
  const logoImg = await new Promise<HTMLImageElement>((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(img)
    img.src = allianceLogo
  })
  const hasLogo    = logoImg.naturalWidth > 0
  const logoRatio  = hasLogo ? logoImg.naturalWidth / logoImg.naturalHeight : 4
  const logoBranco = hasLogo ? logoParaBranco(logoImg) : ''
  const logoH = 11, logoW = logoH * logoRatio, logoHF = 4.5, logoWF = logoHF * logoRatio

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  doc.setFillColor(255, 255, 255); doc.rect(0, 0, 297, 210, 'F')

  // Cabeçalho (voltado ao cliente — sem "Confidencial")
  doc.setFillColor(...ACC); doc.rect(0, 0, 297, 16, 'F')
  if (hasLogo) doc.addImage(logoBranco, 'PNG', 10, 2.5, logoW, logoH)
  doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(...HDR_TEXT)
  doc.text('ALLIANCE FORMATURAS', hasLogo ? 10 + logoW + 3 : 10, 11)
  doc.setFontSize(9); doc.setFont('helvetica', 'normal')
  doc.text('Relatório da Turma — Valores do Evento', 287, 11, { align: 'right' })

  // Info evento
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(...TEXT)
  doc.text(`${orc.instituicao || '—'} — ${orc.turma || '—'}`, 10, 24)
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...TEXT_MUT)
  doc.text(
    `${EVENT_TYPE_LABELS[orc.tipo]}  |  Data: ${formatDate(orc.data)}  |  Convidados: ${orc.quantidadeConvidados}  |  Emitido em ${new Date().toLocaleDateString('pt-BR')}`,
    10, 30,
  )
  doc.setDrawColor(220, 220, 230); doc.setLineWidth(0.3); doc.line(10, 33, 287, 33)
  ;(doc as any).lastAutoTable = { finalY: 33 }

  // Seções — só o valor do cliente. Receitas na 1ª página; despesas começam
  // em página nova, sob um cabeçalho DESPESAS (mesmo estilo do RECEITAS).
  receitasTable(doc, orc)

  doc.addPage()
  faixaTitulo(doc, 'DESPESAS', 8)
  ;(doc as any).lastAutoTable = { finalY: 18 }

  secaoTableCliente(doc, 'OPERAÇÃO / ESTRUTURA',     orc.operacaoEstrutura)
  secaoTableCliente(doc, 'EQUIPE',                    orc.equipe)
  secaoTableCliente(doc, 'ATRAÇÃO',                   orc.atracao)
  secaoTableCliente(doc, 'A&B — ALIMENTOS E BEBIDAS', orc.abBebidas)
  secaoTableCliente(doc, 'EXTRAS',                    orc.extras)

  // Resumo da turma (sem orçado, sem custo real, sem margem) — SEMPRE renderiza
  // (é o "resultado da festa": Receita − V. Cliente = Saldo). Nova página se faltar espaço.
  const finalY = (doc as any).lastAutoTable?.finalY ?? 140
  let sy = finalY + 6
  if (sy > 165) { doc.addPage(); sy = 12 }
  const totalReceitas = orc.bolsaFolia + orc.receitasSympla.reduce((s, l) => s + l.total, 0)
  const allItems      = [...orc.operacaoEstrutura, ...orc.equipe, ...orc.atracao, ...orc.abBebidas, ...orc.extras]
  const totalCliente  = allItems.reduce((s, i) => s + i.valorPassadoCliente, 0)
  const saldo         = totalReceitas - totalCliente

  doc.setFillColor(...HDR_BG); doc.rect(10, sy, 120, 7, 'F')
  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...HDR_TEXT)
  doc.text('RESUMO DA TURMA', 13, sy + 5.5)

  const linhas: [string, number][] = [
    ['Total Arrecadado (Receitas)', totalReceitas],
    ['Total Investido no Evento',   totalCliente],
    ['Saldo da Turma',              saldo],
  ]
  doc.setFontSize(9); doc.setFont('helvetica', 'normal')
  linhas.forEach(([k, v], i) => {
    const ry = sy + 13 + i * 6
    doc.setTextColor(...TEXT_MUT); doc.text(k, 13, ry)
    const isColor = k.startsWith('Saldo') || k.startsWith('Total Arrecadado')
    doc.setTextColor(...(isColor ? (v >= 0 ? GREEN : RED) : TEXT))
    doc.text(formatBRL(v), 128, ry, { align: 'right' })
  })

  // Rodapé (sem "Confidencial")
  const total = doc.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    doc.setFillColor(245, 245, 248); doc.rect(0, 203, 297, 7, 'F')
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...TEXT_MUT)
    if (hasLogo) doc.addImage(logoImg, 'PNG', 10, 204, logoWF, logoHF)
    doc.text('Alliance Formaturas', hasLogo ? 10 + logoWF + 2 : 10, 207.5)
    doc.text(`Página ${p} de ${total}`, 287, 207.5, { align: 'right' })
  }

  // Nome do arquivo: TipoDeEvento_Turma (ex: FestaMeioCurso_UNIFENAS42).
  const tipoSlug = (EVENT_TYPE_LABELS[orc.tipo] || orc.tipo)
    .split(/\s+/)
    .filter(w => !['de', 'da', 'do', 'das', 'dos', 'e'].includes(w.toLowerCase()))
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join('')
  const turmaSlug = (orc.turma || '').replace(/\s+/g, '')
  const filename = `${tipoSlug}_${turmaSlug}`.replace(/[/\\:*?"<>|]/g, '') || 'relatorio_cliente'
  doc.save(`${filename}.pdf`)
}

// ─── Ordem de Serviço (OS) ────────────────────────────────────────────────────
// Documento operacional: fornecedores e atrações do evento com responsável e
// contato. Responsável/Contato ficam em branco por enquanto — serão preenchidos
// automaticamente pelo Catálogo quando a integração for ligada.
const SIT_LABEL_OS: Record<string, string> = {
  aberto: 'Em aberto', aguardando: 'Aguardando assinatura', fechado: 'Fechado',
}

// Faixa de título (barra escura) em página retrato (largura 190). Quebra de página
// se estiver muito perto do rodapé, pra não deixar o título órfão.
function faixaOS(doc: jsPDF, titulo: string) {
  let y = (doc as any).lastAutoTable?.finalY ?? 40
  if (y > 255) { doc.addPage(); y = 8 }
  doc.setFillColor(...HDR_BG)
  doc.rect(10, y + 4, 190, 7, 'F')
  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...HDR_TEXT)
  doc.text(titulo, 13, y + 9)
  ;(doc as any).lastAutoTable = { finalY: y + 11 }
}

export async function exportarOS(orc: Orcamento) {
  const logoImg = await new Promise<HTMLImageElement>((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(img)
    img.src = allianceLogo
  })
  const hasLogo    = logoImg.naturalWidth > 0
  const logoRatio  = hasLogo ? logoImg.naturalWidth / logoImg.naturalHeight : 4
  const logoBranco = hasLogo ? logoParaBranco(logoImg) : ''
  const logoH = 11, logoW = logoH * logoRatio, logoHF = 4.5, logoWF = logoHF * logoRatio

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  doc.setFillColor(255, 255, 255); doc.rect(0, 0, 210, 297, 'F')

  // Cabeçalho
  doc.setFillColor(...ACC); doc.rect(0, 0, 210, 16, 'F')
  if (hasLogo) doc.addImage(logoBranco, 'PNG', 10, 2.5, logoW, logoH)
  doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(...HDR_TEXT)
  doc.text('ALLIANCE FORMATURAS', hasLogo ? 10 + logoW + 3 : 10, 11)
  doc.setFontSize(10); doc.setFont('helvetica', 'normal')
  doc.text('Ordem de Serviço', 200, 11, { align: 'right' })

  // Info do evento
  const info = orc.infoEvento
  doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(...TEXT)
  doc.text(`${orc.instituicao || '—'} — ${orc.turma || '—'}`, 10, 25)
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...TEXT_MUT)
  doc.text(`${EVENT_TYPE_LABELS[orc.tipo]}  |  Data: ${formatDate(orc.data)}  |  Convidados: ${orc.quantidadeConvidados}`, 10, 31)
  const local = info?.local?.trim() || ''
  const horario = info?.horario?.trim() || ''
  if (local || horario) {
    doc.text([local && `Local: ${local}`, horario && `Horário: ${horario}`].filter(Boolean).join('  |  '), 10, 36)
  }
  doc.setDrawColor(220, 220, 230); doc.setLineWidth(0.3); doc.line(10, 39, 200, 39)
  ;(doc as any).lastAutoTable = { finalY: 39 }

  const tabelaStyle = {
    theme: 'grid' as const,
    headStyles: { fillColor: [60, 60, 90] as [number,number,number], textColor: HDR_TEXT, fontSize: 9, fontStyle: 'bold' as const },
    bodyStyles: { textColor: TEXT, fontSize: 9, fillColor: ROW_ODD },
    alternateRowStyles: { fillColor: ROW_EVEN },
    styles: { lineColor: [220, 220, 230] as [number,number,number], lineWidth: 0.1 },
    margin: { left: 10, right: 10 },
  }

  // Fornecedores
  const forn = info?.fornecedores ?? []
  const fornRows = forn.map(f => [f.categoria || '—', f.fornecedor || '—', SIT_LABEL_OS[statusFornecedor(f)] || '', '', ''])
  faixaOS(doc, 'FORNECEDORES')
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 2,
    head: [['Categoria', 'Fornecedor', 'Situação', 'Responsável', 'Contato']],
    body: fornRows.length ? fornRows : [['—', 'Nenhum fornecedor cadastrado', '', '', '']],
    ...tabelaStyle,
    columnStyles: { 0: { cellWidth: 35 }, 1: { cellWidth: 55 }, 2: { cellWidth: 35 }, 3: { cellWidth: 35 }, 4: { cellWidth: 30 } },
  })

  // Line-up / Atrações
  const lineup = info?.lineup ?? []
  if (lineup.length) {
    const luRows = lineup.map(l => {
      const v = lineupView(l)
      const hor = (v.inicio || v.termino) ? `${v.inicio || '—'} - ${v.termino || '—'}` : ''
      return [v.atracao || '—', hor, SIT_LABEL_OS[v.status] || '', '', '']
    })
    faixaOS(doc, 'LINE-UP / ATRAÇÕES')
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 2,
      head: [['Atração', 'Horário', 'Situação', 'Responsável', 'Contato']],
      body: luRows,
      ...tabelaStyle,
      columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: 30 }, 2: { cellWidth: 35 }, 3: { cellWidth: 35 }, 4: { cellWidth: 35 } },
    })
  }

  // Nota sobre o preenchimento pendente (Catálogo)
  {
    const y = (doc as any).lastAutoTable?.finalY ?? 40
    doc.setFontSize(7.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(...TEXT_MUT)
    doc.text('Responsável e Contato serão preenchidos automaticamente pelo Catálogo (integração em andamento).', 10, y + 6)
  }

  // Rodapé
  const total = doc.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    doc.setFillColor(245, 245, 248); doc.rect(0, 290, 210, 7, 'F')
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...TEXT_MUT)
    if (hasLogo) doc.addImage(logoImg, 'PNG', 10, 291, logoWF, logoHF)
    doc.text('Alliance Formaturas — Ordem de Serviço', hasLogo ? 10 + logoWF + 2 : 10, 294.5)
    doc.text(`Página ${p} de ${total}`, 200, 294.5, { align: 'right' })
  }

  const tipoSlug = (EVENT_TYPE_LABELS[orc.tipo] || orc.tipo)
    .split(/\s+/)
    .filter(w => !['de', 'da', 'do', 'das', 'dos', 'e'].includes(w.toLowerCase()))
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join('')
  const turmaSlug = (orc.turma || '').replace(/\s+/g, '')
  const filename = `OS_${tipoSlug}_${turmaSlug}`.replace(/[/\\:*?"<>|]/g, '') || 'OS'
  doc.save(`${filename}.pdf`)
}
