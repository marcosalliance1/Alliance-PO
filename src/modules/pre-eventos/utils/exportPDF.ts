import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Orcamento, ItemOrcamento } from '../types'
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

  const y = (doc as any).lastAutoTable?.finalY ?? 40

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

export async function exportarPDF(orc: Orcamento) {
  const logoImg = await new Promise<HTMLImageElement>((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(img)
    img.src = allianceLogo
  })
  const hasLogo  = logoImg.naturalWidth > 0
  const logoRatio = hasLogo ? logoImg.naturalWidth / logoImg.naturalHeight : 4
  const logoH    = 11                        // mm — cabeçalho (~40px)
  const logoW    = logoH * logoRatio
  const logoHF   = 4.5                       // mm — rodapé (~20px)
  const logoWF   = logoHF * logoRatio

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, 297, 210, 'F')

  // Cabeçalho
  doc.setFillColor(...ACC)
  doc.rect(0, 0, 297, 16, 'F')
  if (hasLogo) doc.addImage(logoImg, 'PNG', 10, 2.5, logoW, logoH)
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

  // Resumo financeiro
  const finalY = (doc as any).lastAutoTable?.finalY ?? 140
  const sy = finalY + 6

  if (sy < 165) {
    const totalSympla   = orc.receitasSympla.reduce((s, l) => s + l.total, 0)
    const totalReceitas = orc.bolsaFolia + totalSympla
    const allItems      = [...orc.operacaoEstrutura, ...orc.equipe, ...orc.atracao, ...orc.abBebidas, ...orc.extras]
    const totalOrcado   = allItems.reduce((s, i) => s + i.totalOrcado, 0)
    const totalPago     = allItems.reduce((s, i) => s + i.totalPagoReal, 0)
    const saldo         = totalReceitas - totalPago

    doc.setFillColor(...HDR_BG)
    doc.rect(10, sy, 120, 7, 'F')
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...HDR_TEXT)
    doc.text('RESUMO FINANCEIRO', 13, sy + 5.5)

    const linhas: [string, number][] = [
      ['Bolsa Folia',      orc.bolsaFolia],
      ['Total Sympla',     totalSympla],
      ['Total Receitas',   totalReceitas],
      ['Total Orçado',     totalOrcado],
      ['Total Pago',       totalPago],
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

  const filename = `orcamento_${orc.instituicao}_${orc.turma}_${orc.tipo}`.replace(/[\s/]/g, '_').toLowerCase()
  doc.save(`${filename}.pdf`)
}
