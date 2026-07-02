import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Projeto, StatusItem } from '../types'
import { formatBRL } from '../utils/formatters'

const HDR_BG: [number, number, number] = [10, 10, 10]
const STATUS_PENDENTE: StatusItem[] = ['estimado', 'orçando']
const STATUS_COR: Record<string, [number, number, number]> = {
  estimado: [180, 130, 0],
  orçando: [200, 60, 60],
}

function cabecalho(doc: jsPDF, pw: number, subtitulo: string) {
  doc.setFillColor(...HDR_BG)
  doc.rect(0, 0, pw, 20, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Alliance — Itens Pendentes de Fechamento', 12, 9)
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.text(subtitulo, 12, 16)
  doc.setTextColor(160, 160, 160)
  doc.text(`Emitido em ${new Date().toLocaleDateString('pt-BR')}`, pw - 10, 13, { align: 'right' })
  doc.setTextColor(0, 0, 0)
}

export function gerarRelatorioPendencias(projeto: Projeto) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pw = doc.internal.pageSize.getWidth()
  const titulo = projeto.tap.turma || projeto.tap.instituicao || 'Projeto'

  cabecalho(doc, pw, `${titulo} — ${projeto.tap.instituicao} ${projeto.tap.anoRealizacao}`)

  let y = 26
  let algumItem = false

  for (const secao of projeto.secoes) {
    const pendentes = secao.itens.filter((i) => STATUS_PENDENTE.includes(i.status))
    if (pendentes.length === 0) continue
    algumItem = true

    const estimatedH = 12 + (pendentes.length + 1) * 6
    if (doc.internal.pageSize.getHeight() - y < Math.min(estimatedH, 40)) {
      doc.addPage()
      y = 26
      cabecalho(doc, pw, `${titulo} — ${projeto.tap.instituicao} ${projeto.tap.anoRealizacao} (cont.)`)
    }

    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 30, 30)
    doc.text(`${secao.numero} ${secao.nome}`, 12, y + 4)

    autoTable(doc, {
      startY: y + 7,
      head: [['Cód.', 'Área', 'Item', 'Fornecedor', 'Qtde', 'Valor Unit.', 'Valor Orç.', 'Status']],
      body: pendentes.map((i) => [
        i.codigo, i.area, i.item, i.fornecedor || '—',
        i.qtdeOrcada ? String(i.qtdeOrcada) : '—',
        formatBRL(i.valorUnitarioOrcado), formatBRL(i.valorOrcado), i.status,
      ]),
      theme: 'grid',
      margin: { left: 12, right: 12 },
      headStyles: { fillColor: [60, 60, 90], textColor: [255, 255, 255], fontSize: 8.5, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8.5, textColor: [30, 30, 30] },
      alternateRowStyles: { fillColor: [248, 248, 250] },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 7) {
          const cor = STATUS_COR[String(data.cell.raw)]
          if (cor) { data.cell.styles.textColor = cor; data.cell.styles.fontStyle = 'bold' }
        }
      },
    })

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
  }

  if (!algumItem) {
    doc.setFontSize(11)
    doc.setTextColor(100, 100, 100)
    doc.text('Nenhum item pendente (estimado/orçando) neste projeto.', 12, y + 4)
  }

  doc.save(`Alliance_Pendencias_${titulo.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`)
}
