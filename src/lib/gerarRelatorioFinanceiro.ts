import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { BoletimRecord, CAPRecord, DimensaoProjetoRecord } from '../hooks/useFinanceiro'

export type AbaFinanceiro = 'resultado' | 'fluxo' | 'despesas' | 'dados'

const TITULOS: Record<AbaFinanceiro, string> = {
  resultado: 'Resultado por Projeto',
  fluxo:     'Fluxo de Caixa',
  despesas:  'Controle de Despesas',
  dados:     'Dados do Boletim',
}

const ORDEM_ENSINO = ['Superior', 'Médio', 'Fundamental', 'Outros']

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function normEnsino(raw: string): string {
  const n = (raw ?? '').toUpperCase().trim()
  if (n === 'SUPERIOR')                    return 'Superior'
  if (n === 'MÉDIO' || n === 'MEDIO')      return 'Médio'
  if (n === 'FUNDAMENTAL')                 return 'Fundamental'
  return raw?.trim() || 'Outros'
}

function buildDimMap(dim: DimensaoProjetoRecord[]) {
  const m: Record<string, { ensino: string; instituicao: string }> = {}
  for (const d of dim) {
    if (d.nome_projeto) m[d.nome_projeto.trim()] = { ensino: normEnsino(d.ensino), instituicao: d.instituicao.trim() }
  }
  return m
}

function fmtData(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR')
}

// ─── Entrada pública ───────────────────────────────────────────────

export function gerarRelatorioFinanceiro(
  aba: AbaFinanceiro,
  boletim: BoletimRecord[],
  cap: CAPRecord[],
  dimensaoProjetos: DimensaoProjetoRecord[],
  filtroProj: string,
) {
  const doc  = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pw   = doc.internal.pageSize.getWidth()
  const fp   = filtroProj.toLowerCase().trim()
  const hoje = new Date().toLocaleDateString('pt-BR')

  // Cabeçalho escuro
  doc.setFillColor(10, 10, 10)
  doc.rect(0, 0, pw, 20, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Alliance — Relatório Financeiro', 12, 9)
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.text(TITULOS[aba] + (fp ? `  ·  Filtro: "${filtroProj}"` : ''), 12, 16)
  doc.setTextColor(160, 160, 160)
  doc.text(`Emitido em ${hoje}`, pw - 10, 13, { align: 'right' })
  doc.setTextColor(0, 0, 0)

  const boletimF = fp ? boletim.filter(r => r.desc_centro_custo.toLowerCase().includes(fp)) : boletim
  const capF     = fp ? cap.filter(r => r.desc_centro_custo.toLowerCase().includes(fp))     : cap
  const dimMap   = buildDimMap(dimensaoProjetos)

  if      (aba === 'resultado') _resultado(doc, boletimF, capF, dimMap)
  else if (aba === 'despesas')  _despesas(doc, boletimF, capF, dimMap)
  else if (aba === 'fluxo')     _fluxo(doc, capF)
  else                          _dados(doc, boletimF)

  const nome = `Alliance_${TITULOS[aba].replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(nome)
}

// ─── Resultado por Projeto ─────────────────────────────────────────

function _resultado(
  doc: jsPDF,
  boletim: BoletimRecord[],
  cap: CAPRecord[],
  dimMap: Record<string, { ensino: string; instituicao: string }>,
) {
  const porProj: Record<string, { receita: number; despesa: number }> = {}

  for (const i of boletim) {
    if (i.tipo !== 'RECEITA' && i.tipo !== 'DESPESA') continue
    const proj = i.desc_centro_custo || '(sem projeto)'
    porProj[proj] ??= { receita: 0, despesa: 0 }
    if (i.tipo === 'RECEITA') {
      porProj[proj].receita += i.v_lancamento ?? 0
    } else if (i.desc_conta_gerencial.toUpperCase() === 'TARIFAS BANCARIAS') {
      porProj[proj].despesa += i.v_lancamento ?? 0
    }
  }
  for (const i of cap) {
    const proj = i.desc_centro_custo || '(sem projeto)'
    porProj[proj] ??= { receita: 0, despesa: 0 }
    porProj[proj].despesa += i.v_titulo ?? 0
  }

  const linhas = Object.entries(porProj).map(([proj, { receita, despesa }]) => {
    const dim = dimMap[proj]
    return { ensino: dim?.ensino || 'Outros', inst: dim?.instituicao || 'Outros', proj, receita, despesa }
  })
  linhas.sort((a, b) => {
    const ei = ORDEM_ENSINO.indexOf(a.ensino) - ORDEM_ENSINO.indexOf(b.ensino)
    if (ei !== 0) return ei
    if (a.inst !== b.inst) return a.inst.localeCompare(b.inst)
    return b.receita - a.receita
  })

  const totRec  = linhas.reduce((s, r) => s + r.receita, 0)
  const totDesp = linhas.reduce((s, r) => s + r.despesa, 0)
  const totRes  = totRec - totDesp
  const totMarg = totRec > 0 ? (totRes / totRec * 100) : 0

  autoTable(doc, {
    startY: 26,
    head: [['Nível', 'Instituição', 'Projeto', 'Receita', 'Despesa Total', 'Resultado', 'Margem %']],
    body: linhas.map(r => {
      const res  = r.receita - r.despesa
      const marg = r.receita > 0 ? (res / r.receita * 100).toFixed(1) + '%' : '—'
      const corRes: [number, number, number] = res >= 0 ? [0, 140, 90] : [210, 50, 50]
      return [
        r.ensino, r.inst, r.proj,
        fmt(r.receita),
        fmt(r.despesa),
        { content: fmt(res), styles: { textColor: corRes, fontStyle: 'bold' as const } },
        { content: marg,     styles: { textColor: corRes } },
      ]
    }),
    foot: [['', '', 'TOTAL GERAL', fmt(totRec), fmt(totDesp), fmt(totRes), totMarg.toFixed(1) + '%']],
    styles:             { fontSize: 7.5, cellPadding: 2.5 },
    headStyles:         { fillColor: [10, 10, 10], textColor: [255, 255, 255], fontStyle: 'bold' },
    footStyles:         { fillColor: [230, 230, 230], fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [249, 249, 249] },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 32 },
      2: { cellWidth: 'auto' },
      3: { halign: 'right', cellWidth: 36 },
      4: { halign: 'right', cellWidth: 36 },
      5: { halign: 'right', cellWidth: 36 },
      6: { halign: 'right', cellWidth: 22 },
    },
  })
}

// ─── Controle de Despesas ──────────────────────────────────────────

function _despesas(
  doc: jsPDF,
  boletim: BoletimRecord[],
  cap: CAPRecord[],
  dimMap: Record<string, { ensino: string; instituicao: string }>,
) {
  // Agrupa CAP + TARIFAS Boletim por ensino > inst > proj > conta
  const agg: Record<string, { ensino: string; inst: string; proj: string; conta: string; total: number }> = {}

  const add = (proj: string, conta: string, valor: number) => {
    const dim = dimMap[proj]
    const k   = `${dim?.ensino || 'Outros'}||${dim?.instituicao || 'Outros'}||${proj}||${conta}`
    agg[k] ??= { ensino: dim?.ensino || 'Outros', inst: dim?.instituicao || 'Outros', proj, conta, total: 0 }
    agg[k].total += valor
  }

  for (const i of cap) add(i.desc_centro_custo || '(sem projeto)', i.desc_conta_gerencial || '(sem categoria)', i.v_titulo ?? 0)
  for (const i of boletim) {
    if (i.tipo !== 'DESPESA' || i.desc_conta_gerencial.toUpperCase() !== 'TARIFAS BANCARIAS') continue
    add(i.desc_centro_custo || '(sem projeto)', i.desc_conta_gerencial, i.v_lancamento ?? 0)
  }

  const linhas = Object.values(agg).sort((a, b) => {
    const ei = ORDEM_ENSINO.indexOf(a.ensino) - ORDEM_ENSINO.indexOf(b.ensino)
    if (ei !== 0) return ei
    if (a.inst  !== b.inst)  return a.inst.localeCompare(b.inst)
    if (a.proj  !== b.proj)  return a.proj.localeCompare(b.proj)
    return b.total - a.total
  })

  const total = linhas.reduce((s, r) => s + r.total, 0)

  autoTable(doc, {
    startY: 26,
    head: [['Nível', 'Instituição', 'Projeto', 'Conta Gerencial', 'Total']],
    body: linhas.map(r => [r.ensino, r.inst, r.proj, r.conta, fmt(r.total)]),
    foot: [['', '', '', 'TOTAL GERAL', fmt(total)]],
    styles:             { fontSize: 7.5, cellPadding: 2.5 },
    headStyles:         { fillColor: [10, 10, 10], textColor: [255, 255, 255], fontStyle: 'bold' },
    footStyles:         { fillColor: [230, 230, 230], fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [249, 249, 249] },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 32 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 58 },
      4: { halign: 'right', cellWidth: 36 },
    },
  })
}

// ─── Fluxo de Caixa ───────────────────────────────────────────────

function _fluxo(doc: jsPDF, cap: CAPRecord[]) {
  const linhas = [...cap].sort((a, b) => (a.d_vencimento ?? '').localeCompare(b.d_vencimento ?? ''))
  const total  = cap.reduce((s, i) => s + (i.v_titulo ?? 0), 0)

  autoTable(doc, {
    startY: 26,
    head: [['Vencimento', 'Projeto', 'Conta Gerencial', 'Fornecedor', 'Valor', 'Situação']],
    body: linhas.map(i => [
      fmtData(i.d_vencimento),
      i.desc_centro_custo     || '—',
      i.desc_conta_gerencial  || '—',
      i.fantasia_fornecedor   || '—',
      fmt(i.v_titulo ?? 0),
      { content: i.situacao, styles: { textColor: i.situacao === 'ATIVO' ? [0, 140, 90] : [100, 100, 100] as [number, number, number] } },
    ]),
    foot: [['', '', '', 'TOTAL', fmt(total), '']],
    styles:             { fontSize: 7, cellPadding: 2 },
    headStyles:         { fillColor: [10, 10, 10], textColor: [255, 255, 255], fontStyle: 'bold' },
    footStyles:         { fillColor: [230, 230, 230], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 249, 249] },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 48 },
      3: { cellWidth: 48 },
      4: { halign: 'right', cellWidth: 32 },
      5: { cellWidth: 20, halign: 'center' },
    },
  })
}

// ─── Dados do Boletim ─────────────────────────────────────────────

const LIMITE_DADOS = 2000

function _dados(doc: jsPDF, boletim: BoletimRecord[]) {
  const linhas = boletim.slice(0, LIMITE_DADOS)

  if (boletim.length > LIMITE_DADOS) {
    doc.setFontSize(8)
    doc.setTextColor(180, 80, 0)
    doc.text(`Exibindo ${LIMITE_DADOS.toLocaleString('pt-BR')} de ${boletim.length.toLocaleString('pt-BR')} registros.`, 12, 24)
    doc.setTextColor(0, 0, 0)
  }

  autoTable(doc, {
    startY: boletim.length > LIMITE_DADOS ? 30 : 26,
    head: [['Competência', 'Projeto', 'Conta Gerencial', 'Fornecedor/Cliente', 'Tipo', 'Valor', 'Situação']],
    body: linhas.map(i => [
      fmtData(i.d_competencia),
      i.desc_centro_custo              || '—',
      i.desc_conta_gerencial           || '—',
      i.fantasia_cliente_fornecedor    || '—',
      i.tipo,
      fmt(i.v_lancamento ?? 0),
      i.situacao,
    ]),
    styles:             { fontSize: 6.5, cellPadding: 1.8 },
    headStyles:         { fillColor: [10, 10, 10], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 249, 249] },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 42 },
      3: { cellWidth: 42 },
      4: { cellWidth: 18, halign: 'center' },
      5: { halign: 'right', cellWidth: 30 },
      6: { cellWidth: 18, halign: 'center' },
    },
  })
}
