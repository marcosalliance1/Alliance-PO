// Espelho da aba "ACOMP. ATENDIMENTO": o layout dessa aba muda de P.O. pra P.O. (nomes e posições
// dos blocos diferem), então não dá pra ler por célula fixa. Em vez disso, achamos os blocos pela
// FORMATAÇÃO: toda barra de título é célula de fundo colorido + texto branco em negrito. A barra
// abre um bloco, que desce até a próxima barra (nas mesmas colunas) ou até uma linha vazia.
// Tudo que sobra fora de bloco vai pra "outros" — nada some em silêncio.

import { padronizarCaixa } from './caixa'

export interface CelulaGrade { v: string; bg?: string; fg?: string; b?: 1; al?: string; nf?: string }
export interface GradeAcomp { rows: CelulaGrade[][]; merges: number[][]; gid: number; sheetId: string; nome?: string }

export interface EspelhoCelula { texto: string; num: boolean; neg: boolean; negrito: boolean; tint?: string }
export interface EspelhoLinha { linha: number; celulas: EspelhoCelula[]; total: boolean }
export interface EspelhoBloco {
  id: string
  titulo: string
  cabecalhos: string[] | null
  linhas: EspelhoLinha[]
  banner: boolean
  top: number
  left: number
  right: number
  ncols: number
  ancora: string
}
export interface EspelhoOutro { linha: number; ref: string; textos: string[] }
export interface Espelho {
  titulo: string | null
  pilhas: EspelhoBloco[][]
  outros: EspelhoOutro[]
  destaques: { rotulo: string; bloco: string; valor: string; neg: boolean }[]
  avisos: string[]
}

export function nomeColuna(i: number): string {
  let s = ''
  let n = i + 1
  while (n > 0) {
    const m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

export function linkPlanilha(g: Pick<GradeAcomp, 'sheetId' | 'gid'>, ancora?: string): string {
  return `https://docs.google.com/spreadsheets/d/${g.sheetId}/edit#gid=${g.gid}${ancora ? `&range=${ancora}` : ''}`
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

function limparTexto(raw: string): string {
  const t = raw.replace(/\s+/g, ' ').trim()
  if (/^R\$\s*-$/.test(t) || t === '-') return '—'
  return t
}
const reNum = /^[\s(−-]*(R\$)?\s*[(−-]?\s*\d[\d.]*(,\d+)?\s*\)?\s*%?$/
function ehNumero(t: string): boolean { return t === '—' || reNum.test(t) }
function ehNegativo(t: string): boolean { return /^(-|\(|R\$\s*-\s*\d|R\$\s*\(|-\s*R\$)/.test(t) }

const ehCinza = (hex: string) => {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16)
  return Math.max(r, g, b) - Math.min(r, g, b) < 24
}

export function montarEspelho(grade: GradeAcomp): Espelho {
  const rows = grade.rows
  const H = rows.length
  const W = Math.max(0, ...rows.map(r => r.length))
  const cel = (r: number, c: number): CelulaGrade | undefined => rows[r]?.[c]
  const txt = (r: number, c: number) => (cel(r, c)?.v ?? '').toString().trim()
  const ehBarra = (c?: CelulaGrade) => !!c && !!c.bg && c.fg === '#ffffff' && !!c.b

  // barra[r][c]: célula é (ou está mesclada em) uma barra de título
  const barra: boolean[][] = Array.from({ length: H }, () => Array(W).fill(false))
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (ehBarra(cel(r, c))) barra[r][c] = true
  for (const [r0, r1, c0, c1] of grade.merges) {
    if (ehBarra(cel(r0, c0))) for (let r = r0; r < r1 && r < H; r++) for (let c = c0; c < c1 && c < W; c++) barra[r][c] = true
  }

  const coberto: boolean[][] = Array.from({ length: H }, () => Array(W).fill(false))
  const blocos: EspelhoBloco[] = []
  const avisos: string[] = []

  for (let r = 0; r < H; r++) {
    let c = 0
    while (c < W) {
      if (!barra[r][c]) { c++; continue }
      const c0 = c
      while (c < W && barra[r][c]) c++
      const c1 = c - 1
      const textos: { c: number; t: string }[] = []
      for (let k = c0; k <= c1; k++) { const t = txt(r, k); if (t) textos.push({ c: k, t }) }
      if (!textos.length) continue
      const titulo = padronizarCaixa(textos[0].t)
      const cabecalhos = textos.length > 1 ? textos.slice(1).map(x => padronizarCaixa(x.t)) : null
      const colsCabec = textos.slice(1).map(x => x.c)
      for (let k = c0; k <= c1; k++) coberto[r][k] = true

      // corpo: desce até outra barra nessas colunas ou até linha vazia/sem sombreamento
      const corpo: { r: number; cells: (CelulaGrade | undefined)[] }[] = []
      let rr = r + 1
      while (rr < H) {
        let temBarra = false, temTexto = false, temSombra = false
        for (let k = c0; k <= c1; k++) {
          if (barra[rr][k]) temBarra = true
          if (txt(rr, k)) temTexto = true
          if (cel(rr, k)?.bg) temSombra = true
        }
        if (temBarra) break
        if (!temTexto && !temSombra) break
        for (let k = c0; k <= c1; k++) coberto[rr][k] = true
        if (temTexto) corpo.push({ r: rr, cells: Array.from({ length: c1 - c0 + 1 }, (_, i) => cel(rr, c0 + i)) })
        rr++
      }

      // colunas realmente usadas (descarta as vazias no bloco inteiro)
      const usadas: number[] = []
      for (let k = c0; k <= c1; k++) {
        if (colsCabec.includes(k) || k === c0 || corpo.some(l => (l.cells[k - c0]?.v ?? '').toString().trim() !== '')) usadas.push(k)
      }
      const linhas: EspelhoLinha[] = corpo.map(l => {
        const celulas: EspelhoCelula[] = usadas.map(k => {
          const cc = l.cells[k - c0]
          const bruto = limparTexto((cc?.v ?? '').toString())
          const texto = ehNumero(bruto) ? bruto : padronizarCaixa(bruto)
          const tint = cc?.bg && cc.bg !== '#ffffff' && !ehCinza(cc.bg) ? cc.bg : undefined
          const num = texto !== '' && ehNumero(texto) && k !== c0
          return { texto, num, neg: num && ehNegativo(texto), negrito: !!cc?.b, tint }
        })
        const primeiro = celulas.find(x => x.texto)?.texto ?? ''
        return { linha: l.r + 1, celulas, total: /^total\b/.test(norm(primeiro)) }
      })
        // linha sem rótulo e sem nenhum valor real (só "—") é molde em branco da planilha
        .filter(l => l.celulas.some(x => x.texto && x.texto !== '—') || l.celulas[0]?.texto)
      const cabAlinhados = cabecalhos
        ? usadas.map(k => { const i = colsCabec.indexOf(k); return i >= 0 ? cabecalhos[i] : '' })
        : null

      blocos.push({
        id: `${nomeColuna(c0)}${r + 1}`,
        titulo,
        cabecalhos: cabAlinhados,
        linhas,
        banner: !cabecalhos && linhas.length === 0,
        top: r + 1,
        left: c0,
        right: c1,
        ncols: usadas.length,
        ancora: `${nomeColuna(c0)}${r + 1}`,
      })
    }
  }

  // título da página = 1ª faixa sem corpo que vem antes de qualquer bloco com conteúdo
  let titulo: string | null = null
  const comConteudo = blocos.filter(b => !b.banner)
  const primeiroConteudo = comConteudo.length ? Math.min(...comConteudo.map(b => b.top)) : Infinity
  let lista = blocos
  const cand = blocos.filter(b => b.banner && b.top < primeiroConteudo).sort((a, b) => a.top - b.top)[0]
  if (cand) { titulo = cand.titulo; lista = blocos.filter(b => b !== cand) }

  // pilhas: blocos que se sobrepõem em colunas ficam na mesma coluna visual
  const pilhas: { c0: number; c1: number; itens: EspelhoBloco[] }[] = []
  for (const b of [...lista].sort((a, z) => a.top - z.top || a.left - z.left)) {
    const alvo = pilhas.find(p => b.left <= p.c1 && b.right >= p.c0)
    if (alvo) { alvo.itens.push(b); alvo.c0 = Math.min(alvo.c0, b.left); alvo.c1 = Math.max(alvo.c1, b.right) }
    else pilhas.push({ c0: b.left, c1: b.right, itens: [b] })
  }
  pilhas.sort((a, z) => a.c0 - z.c0)

  // sobras: texto fora de qualquer bloco
  const outros: EspelhoOutro[] = []
  for (let r = 0; r < H; r++) {
    const partes: { c: number; t: string }[] = []
    for (let c = 0; c < W; c++) { if (!coberto[r][c]) { const t = limparTexto(txt(r, c)); if (t && t !== '—') partes.push({ c, t }) } }
    if (partes.length) outros.push({ linha: r + 1, ref: `${nomeColuna(partes[0].c)}${r + 1}`, textos: partes.map(p => (ehNumero(p.t) ? p.t : padronizarCaixa(p.t))) })
  }
  if (!lista.length) avisos.push('Nenhuma barra de título encontrada — a formatação desta aba é diferente do padrão.')

  // destaques: linhas de total conhecidas (rótulo vem da própria planilha)
  const prioridade = ['total adesoes', 'total formandos', 'cenario atual', 'total convites', 'total comissao', 'total atual', 'total projetado']
  const destaques: Espelho['destaques'] = []
  for (const p of prioridade) {
    for (const b of lista) {
      const l = b.linhas.find(x => norm(x.celulas[0]?.texto ?? '') === p)
      if (!l) continue
      const v = [...l.celulas].reverse().find(x => x.num && x.texto !== '—')
      if (!v || /^(R\$\s*)?0([.,]0+)?$/.test(v.texto)) continue
      destaques.push({ rotulo: l.celulas[0].texto, bloco: b.titulo, valor: v.texto, neg: v.neg })
      break
    }
    if (destaques.length >= 5) break
  }

  return { titulo, pilhas: pilhas.map(p => p.itens), outros, destaques, avisos }
}
