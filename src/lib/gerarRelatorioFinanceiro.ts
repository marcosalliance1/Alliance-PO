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

type RGB = [number, number, number]

// Paleta de níveis hierárquicos
const NIVEIS = {
  ensino: { fill: [17, 24, 39]  as RGB, text: [255, 255, 255] as RGB, fontStyle: 'bold' as const, size: 9,   indent: 4  },
  inst:   { fill: [30, 41, 59]  as RGB, text: [203, 213, 225] as RGB, fontStyle: 'bold' as const, size: 8.5, indent: 10 },
  proj:   { fill: [51, 65, 85]  as RGB, text: [186, 200, 220] as RGB, fontStyle: 'bold' as const, size: 8,   indent: 18 },
  conta:  { fill: [248, 250, 252] as RGB, text: [30,  41,  59]  as RGB, fontStyle: 'normal' as const, size: 7.5, indent: 28 },
  forn:   { fill: [255, 255, 255] as RGB, text: [100, 116, 139] as RGB, fontStyle: 'normal' as const, size: 7,   indent: 38 },
} as const
type NivelKey = keyof typeof NIVEIS

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtData(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR')
}
function normEnsino(raw: string): string {
  const n = (raw ?? '').toUpperCase().trim()
  if (n === 'SUPERIOR')                return 'Superior'
  if (n === 'MÉDIO' || n === 'MEDIO') return 'Médio'
  if (n === 'FUNDAMENTAL')             return 'Fundamental'
  return raw?.trim() || 'Outros'
}
function buildDimMap(dim: DimensaoProjetoRecord[]) {
  const m: Record<string, { ensino: string; instituicao: string }> = {}
  for (const d of dim) {
    if (d.nome_projeto) m[d.nome_projeto.trim()] = { ensino: normEnsino(d.ensino), instituicao: d.instituicao.trim() }
  }
  return m
}
function sortByTotal<T extends { total: number }>(map: Record<string, T>): [string, T][] {
  return Object.entries(map).sort((a, b) => b[1].total - a[1].total)
}

// ─── Captura de gráficos do DOM ────────────────────────────────────

export async function capturarGraficos(container: HTMLElement): Promise<{ titulo: string; dataUrl: string }[]> {
  const wrappers = container.querySelectorAll<HTMLElement>('.recharts-wrapper')
  const result: { titulo: string; dataUrl: string }[] = []
  for (const wrapper of wrappers) {
    const svg = wrapper.querySelector<SVGElement>('svg')
    if (!svg) continue
    const titulo = wrapper.closest('.card')?.querySelector('h3')?.textContent?.trim() ?? 'Gráfico'
    const dataUrl = await _svgParaPng(svg)
    if (dataUrl) result.push({ titulo, dataUrl })
  }
  return result
}

async function _svgParaPng(svgEl: SVGElement): Promise<string | null> {
  return new Promise((resolve) => {
    const rect = svgEl.getBoundingClientRect()
    const w = Math.round(rect.width)
    const h = Math.round(rect.height)
    if (!w || !h) { resolve(null); return }

    const clone = svgEl.cloneNode(true) as SVGElement
    clone.setAttribute('width', String(w))
    clone.setAttribute('height', String(h))
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

    const canvas = document.createElement('canvas')
    canvas.width  = w * 2
    canvas.height = h * 2
    const ctx = canvas.getContext('2d')!
    ctx.scale(2, 2)
    ctx.fillStyle = '#111827'
    ctx.fillRect(0, 0, w, h)

    const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const img  = new Image()
    img.onload  = () => { ctx.drawImage(img, 0, 0); URL.revokeObjectURL(url); resolve(canvas.toDataURL('image/png', 0.92)) }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
    img.src = url
  })
}

// ─── Entrada pública ───────────────────────────────────────────────

export function gerarRelatorioFinanceiro(
  aba: AbaFinanceiro,
  boletim: BoletimRecord[],
  cap: CAPRecord[],
  dimensaoProjetos: DimensaoProjetoRecord[],
  filtroProj: string,
  graficos: { titulo: string; dataUrl: string }[] = [],
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pw  = doc.internal.pageSize.getWidth()
  const fp  = filtroProj.toLowerCase().trim()

  _cabecalho(doc, pw, TITULOS[aba], filtroProj)

  const boletimF = fp ? boletim.filter(r => r.desc_centro_custo.toLowerCase().includes(fp)) : boletim
  const capF     = fp ? cap.filter(r => r.desc_centro_custo.toLowerCase().includes(fp))     : cap
  const dimMap   = buildDimMap(dimensaoProjetos)

  if      (aba === 'resultado') _resultado(doc, boletimF, capF, dimMap)
  else if (aba === 'despesas')  _despesas(doc, boletimF, capF, dimMap)
  else if (aba === 'fluxo')     _fluxo(doc, capF)
  else                          _dados(doc, boletimF)

  if (graficos.length > 0) _paginaGraficos(doc, pw, graficos, TITULOS[aba])

  doc.save(`Alliance_${TITULOS[aba].replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`)
}

// ─── Cabeçalho padrão ─────────────────────────────────────────────

function _cabecalho(doc: jsPDF, pw: number, titulo: string, filtro: string) {
  doc.setFillColor(10, 10, 10)
  doc.rect(0, 0, pw, 20, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Alliance — Relatório Financeiro', 12, 9)
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.text(titulo + (filtro ? `  ·  Filtro: "${filtro}"` : ''), 12, 16)
  doc.setTextColor(160, 160, 160)
  doc.text(`Emitido em ${new Date().toLocaleDateString('pt-BR')}`, pw - 10, 13, { align: 'right' })
  doc.setTextColor(0, 0, 0)
}

// ─── Resultado por Projeto (hierárquico) ───────────────────────────

function _resultado(
  doc: jsPDF,
  boletim: BoletimRecord[],
  cap: CAPRecord[],
  dimMap: Record<string, { ensino: string; instituicao: string }>,
) {
  // Agregar receitas (boletim) e despesas (CAP + TARIFAS boletim)
  type ProjRes = { receita: number; despesa: number }
  const porProj: Record<string, ProjRes> = {}

  for (const i of boletim) {
    if (i.tipo !== 'RECEITA' && i.tipo !== 'DESPESA') continue
    const p = i.desc_centro_custo || '(sem projeto)'
    porProj[p] ??= { receita: 0, despesa: 0 }
    if (i.tipo === 'RECEITA') porProj[p].receita += i.v_lancamento ?? 0
    else if (i.desc_conta_gerencial.toUpperCase() === 'TARIFAS BANCARIAS') porProj[p].despesa += i.v_lancamento ?? 0
  }
  for (const i of cap) {
    const p = i.desc_centro_custo || '(sem projeto)'
    porProj[p] ??= { receita: 0, despesa: 0 }
    porProj[p].despesa += i.v_titulo ?? 0
  }

  // Agrupar por ensino > inst > proj
  type Tree = Record<string, { receita: number; despesa: number; inst: Record<string, { receita: number; despesa: number; projs: Record<string, ProjRes> }> }>
  const tree: Tree = {}

  for (const [proj, vals] of Object.entries(porProj)) {
    const dim    = dimMap[proj]
    const ensino = dim?.ensino       || 'Outros'
    const inst   = dim?.instituicao  || 'Outros'
    tree[ensino] ??= { receita: 0, despesa: 0, inst: {} }
    tree[ensino].receita  += vals.receita
    tree[ensino].despesa  += vals.despesa
    tree[ensino].inst[inst] ??= { receita: 0, despesa: 0, projs: {} }
    tree[ensino].inst[inst].receita += vals.receita
    tree[ensino].inst[inst].despesa += vals.despesa
    tree[ensino].inst[inst].projs[proj] = vals
  }

  type Row = { nivel: 'ensino' | 'inst' | 'proj'; label: string; receita: number; despesa: number }
  const rows: Row[] = []

  const ensinoOrdem = [...ORDEM_ENSINO.filter(e => tree[e]), ...Object.keys(tree).filter(e => !ORDEM_ENSINO.includes(e))]
  for (const ensino of ensinoOrdem) {
    const eData = tree[ensino]
    rows.push({ nivel: 'ensino', label: ensino.toUpperCase(), receita: eData.receita, despesa: eData.despesa })
    for (const [inst, iData] of Object.entries(eData.inst).sort((a, b) => b[1].receita - a[1].receita)) {
      rows.push({ nivel: 'inst', label: inst.toUpperCase(), receita: iData.receita, despesa: iData.despesa })
      for (const [proj, pData] of Object.entries(iData.projs).sort((a, b) => b[1].receita - a[1].receita)) {
        rows.push({ nivel: 'proj', label: proj, receita: pData.receita, despesa: pData.despesa })
      }
    }
  }

  const totRec  = Object.values(porProj).reduce((s, r) => s + r.receita, 0)
  const totDesp = Object.values(porProj).reduce((s, r) => s + r.despesa, 0)
  const totRes  = totRec - totDesp
  const totMarg = totRec > 0 ? (totRes / totRec * 100) : 0

  const NIVEL_ESTILOS = {
    ensino: NIVEIS.ensino,
    inst:   NIVEIS.inst,
    proj:   NIVEIS.proj,
  }

  autoTable(doc, {
    startY: 26,
    head: [['Projeto / Instituição / Nível', 'Receita', 'Despesa Total', 'Resultado', 'Margem %']],
    body: rows.map(r => {
      const s   = NIVEL_ESTILOS[r.nivel]
      const res = r.receita - r.despesa
      const marg = r.receita > 0 ? (res / r.receita * 100).toFixed(1) + '%' : '—'
      const corRes: RGB = res >= 0 ? [0, 140, 90] : [200, 50, 50]
      return [
        { content: r.label,      styles: { fillColor: s.fill, textColor: s.text, fontStyle: s.fontStyle, fontSize: s.size, cellPadding: { top: 2.5, right: 2.5, bottom: 2.5, left: s.indent } } },
        { content: fmt(r.receita), styles: { fillColor: s.fill, textColor: s.text, fontStyle: s.fontStyle, fontSize: s.size, halign: 'right' as const } },
        { content: fmt(r.despesa), styles: { fillColor: s.fill, textColor: s.text, fontStyle: s.fontStyle, fontSize: s.size, halign: 'right' as const } },
        { content: fmt(res),       styles: { fillColor: s.fill, textColor: corRes,  fontStyle: 'bold' as const, fontSize: s.size, halign: 'right' as const } },
        { content: marg,           styles: { fillColor: s.fill, textColor: corRes,  fontStyle: r.nivel === 'proj' ? 'bold' as const : s.fontStyle, fontSize: s.size, halign: 'right' as const } },
      ]
    }),
    foot: [['TOTAL GERAL', fmt(totRec), fmt(totDesp), fmt(totRes), totMarg.toFixed(1) + '%']],
    styles:     { cellPadding: 2.5, fontSize: 8 },
    headStyles: { fillColor: [10, 10, 10], textColor: [255, 255, 255], fontStyle: 'bold' },
    footStyles: { fillColor: [230, 230, 230], fontStyle: 'bold', fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'right', cellWidth: 38 },
      2: { halign: 'right', cellWidth: 38 },
      3: { halign: 'right', cellWidth: 38 },
      4: { halign: 'right', cellWidth: 24 },
    },
  })
}

// ─── Controle de Despesas (hierárquico com fornecedores) ───────────

function _despesas(
  doc: jsPDF,
  boletim: BoletimRecord[],
  cap: CAPRecord[],
  dimMap: Record<string, { ensino: string; instituicao: string }>,
) {
  type FornMap = Record<string, number>
  type ContaMap = Record<string, { total: number; fornecedores: FornMap }>
  type ProjMap  = Record<string, { total: number; contas: ContaMap }>
  type InstMap  = Record<string, { total: number; projetos: ProjMap }>
  type EnsinoMap = Record<string, { total: number; instituicoes: InstMap }>

  const tree: EnsinoMap = {}

  const add = (proj: string, conta: string, forn: string, valor: number) => {
    const dim    = dimMap[proj]
    const ensino = dim?.ensino      || 'Outros'
    const inst   = dim?.instituicao || 'Outros'
    tree[ensino] ??= { total: 0, instituicoes: {} }
    tree[ensino].total += valor
    tree[ensino].instituicoes[inst] ??= { total: 0, projetos: {} }
    tree[ensino].instituicoes[inst].total += valor
    tree[ensino].instituicoes[inst].projetos[proj] ??= { total: 0, contas: {} }
    tree[ensino].instituicoes[inst].projetos[proj].total += valor
    tree[ensino].instituicoes[inst].projetos[proj].contas[conta] ??= { total: 0, fornecedores: {} }
    tree[ensino].instituicoes[inst].projetos[proj].contas[conta].total += valor
    tree[ensino].instituicoes[inst].projetos[proj].contas[conta].fornecedores[forn] =
      (tree[ensino].instituicoes[inst].projetos[proj].contas[conta].fornecedores[forn] ?? 0) + valor
  }

  for (const i of cap) add(
    i.desc_centro_custo    || '(sem projeto)',
    i.desc_conta_gerencial || '(sem categoria)',
    i.fantasia_fornecedor  || '(sem fornecedor)',
    i.v_titulo ?? 0,
  )
  for (const i of boletim) {
    if (i.tipo !== 'DESPESA' || i.desc_conta_gerencial.toUpperCase() !== 'TARIFAS BANCARIAS') continue
    add(i.desc_centro_custo || '(sem projeto)', i.desc_conta_gerencial, i.fantasia_cliente_fornecedor || '(sem fornecedor)', i.v_lancamento ?? 0)
  }

  type DrillRow = { nivel: NivelKey; label: string; total: number }
  const rows: DrillRow[] = []

  const ensinoOrdem = [...ORDEM_ENSINO.filter(e => tree[e]), ...Object.keys(tree).filter(e => !ORDEM_ENSINO.includes(e))]
  for (const ensino of ensinoOrdem) {
    const eData = tree[ensino]
    rows.push({ nivel: 'ensino', label: ensino.toUpperCase(), total: eData.total })
    for (const [inst, iData] of sortByTotal(eData.instituicoes)) {
      rows.push({ nivel: 'inst', label: inst.toUpperCase(), total: iData.total })
      for (const [proj, pData] of sortByTotal(iData.projetos)) {
        rows.push({ nivel: 'proj', label: proj, total: pData.total })
        for (const [conta, cData] of sortByTotal(pData.contas)) {
          rows.push({ nivel: 'conta', label: conta, total: cData.total })
          for (const [forn, fVal] of Object.entries(cData.fornecedores).sort((a, b) => b[1] - a[1])) {
            rows.push({ nivel: 'forn', label: forn, total: fVal })
          }
        }
      }
    }
  }

  const totalGeral = ensinoOrdem.reduce((s, e) => s + tree[e].total, 0)

  autoTable(doc, {
    startY: 26,
    head: [['Despesa / Fornecedor', 'Total']],
    body: rows.map(r => {
      const s = NIVEIS[r.nivel]
      return [
        { content: r.label,   styles: { fillColor: s.fill, textColor: s.text, fontStyle: s.fontStyle, fontSize: s.size, cellPadding: { top: 2.5, right: 2.5, bottom: 2.5, left: s.indent } } },
        { content: fmt(r.total), styles: { fillColor: s.fill, textColor: s.text, fontStyle: s.fontStyle, fontSize: s.size, halign: 'right' as const } },
      ]
    }),
    foot: [['TOTAL GERAL', fmt(totalGeral)]],
    styles:     { cellPadding: 2.5, fontSize: 8 },
    headStyles: { fillColor: [10, 10, 10], textColor: [255, 255, 255], fontStyle: 'bold' },
    footStyles: { fillColor: [230, 230, 230], fontStyle: 'bold', fontSize: 8.5 },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'right', cellWidth: 40 },
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
      i.desc_centro_custo    || '—',
      i.desc_conta_gerencial || '—',
      i.fantasia_fornecedor  || '—',
      fmt(i.v_titulo ?? 0),
      { content: i.situacao, styles: { textColor: (i.situacao === 'ATIVO' ? [0, 140, 90] : [130, 130, 130]) as RGB, fontStyle: 'bold' as const } },
    ]),
    foot: [['', '', '', 'TOTAL', fmt(total), '']],
    styles:             { fontSize: 7, cellPadding: 2 },
    headStyles:         { fillColor: [10, 10, 10], textColor: [255, 255, 255], fontStyle: 'bold' },
    footStyles:         { fillColor: [230, 230, 230], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
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
  if (boletim.length > LIMITE_DADOS) {
    doc.setFontSize(8); doc.setTextColor(180, 80, 0)
    doc.text(`Exibindo ${LIMITE_DADOS.toLocaleString('pt-BR')} de ${boletim.length.toLocaleString('pt-BR')} registros.`, 12, 24)
    doc.setTextColor(0, 0, 0)
  }
  autoTable(doc, {
    startY: boletim.length > LIMITE_DADOS ? 30 : 26,
    head: [['Competência', 'Projeto', 'Conta Gerencial', 'Fornecedor/Cliente', 'Tipo', 'Valor', 'Situação']],
    body: boletim.slice(0, LIMITE_DADOS).map(i => [
      fmtData(i.d_competencia),
      i.desc_centro_custo           || '—',
      i.desc_conta_gerencial        || '—',
      i.fantasia_cliente_fornecedor || '—',
      i.tipo,
      fmt(i.v_lancamento ?? 0),
      i.situacao,
    ]),
    styles:             { fontSize: 6.5, cellPadding: 1.8 },
    headStyles:         { fillColor: [10, 10, 10], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
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

// ─── Página de gráficos ────────────────────────────────────────────

function _paginaGraficos(
  doc: jsPDF,
  pw: number,
  graficos: { titulo: string; dataUrl: string }[],
  nomeAba: string,
) {
  doc.addPage()
  doc.setFillColor(10, 10, 10)
  doc.rect(0, 0, pw, 18, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(11); doc.setFont('helvetica', 'bold')
  doc.text('Gráficos', 12, 11)
  doc.setFontSize(8); doc.setFont('helvetica', 'normal')
  doc.text(nomeAba, pw - 10, 11, { align: 'right' })
  doc.setTextColor(0, 0, 0)

  const ph      = doc.internal.pageSize.getHeight()
  const cols    = 2
  const pad     = 8
  const gap     = 6
  const colW    = (pw - pad * 2 - gap * (cols - 1)) / cols
  const chartH  = (ph - 22 - pad - gap) / 2   // até 4 gráficos em 2×2

  let col = 0, row = 0

  for (const { titulo, dataUrl } of graficos) {
    const x = pad + col * (colW + gap)
    const y = 22 + row * (chartH + gap)

    // Caixa escura de fundo
    doc.setFillColor(17, 24, 39)
    doc.roundedRect(x, y, colW, chartH, 2, 2, 'F')

    // Título do gráfico
    doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(203, 213, 225)
    doc.text(titulo, x + 4, y + 6)
    doc.setTextColor(0, 0, 0)

    // Imagem do gráfico
    try {
      doc.addImage(dataUrl, 'PNG', x + 2, y + 9, colW - 4, chartH - 11)
    } catch { /* ignora se a imagem falhar */ }

    col++
    if (col >= cols) { col = 0; row++ }
    if (row >= 2 && col === 0) {
      doc.addPage()
      doc.setFillColor(10, 10, 10); doc.rect(0, 0, pw, 18, 'F')
      doc.setTextColor(255, 255, 255); doc.setFontSize(11); doc.setFont('helvetica', 'bold')
      doc.text('Gráficos (cont.)', 12, 11)
      doc.setTextColor(0, 0, 0)
      row = 0
    }
  }
}
