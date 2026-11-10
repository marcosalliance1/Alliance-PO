// Lê o PDF da Ordem de Serviço (OS) gerada pelo app/skill "alliance-os" e devolve os dados do evento.
// Esta parte é PURA (sem pdf.js): recebe os trechos de texto com posição (x, y) e interpreta.
// A leitura do PDF em si está em lerOsPdfNavegador.ts (e nos testes, via build "legacy" do pdf.js em Node).
//
// A OS tem layout fixo (mesmo modelo para todos os eventos), então lemos por POSIÇÃO e não por texto corrido:
// tabelas (fornecedores, lineup) saem em colunas e o texto corrido embaralharia as colunas.
// Nunca inventa: o que não for encontrado fica vazio e vira aviso.

export interface ItemTexto { s: string; x: number; y: number; w: number }

export interface OsFornecedor { nome: string; servico: string; contato: string; telefone: string; chegada: string }
export interface OsLineup { atracao: string; inicio: string; fim: string } // HH:MM

export interface OsLida {
  numeroOs: string
  versao: number | null
  nomeEvento: string
  tematica: string
  data: string // dd/mm/aaaa
  diaSemana: string
  horario: string
  local: string
  formandos: number | null
  convidados: number | null
  mesas: number | null
  fornecedores: OsFornecedor[]
  lineup: OsLineup[]
  avisos: string[]
}

export class OsInvalidaErro extends Error {}

// ───────── utilidades ─────────

/** Remove espaços (a OS tem rótulos "F O R M A N D O S"), acentos e caixa — só para comparar rótulos. */
export function norm(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, '').toLowerCase()
}

interface Linha { y: number; itens: ItemTexto[] }

const TOL_Y = 3

function agruparLinhas(itens: ItemTexto[]): Linha[] {
  const ord = itens.filter((i) => i.s.trim()).sort((a, b) => b.y - a.y || a.x - b.x)
  const linhas: Linha[] = []
  for (const it of ord) {
    const atual = linhas[linhas.length - 1]
    if (atual && Math.abs(atual.y - it.y) <= TOL_Y) atual.itens.push(it)
    else linhas.push({ y: it.y, itens: [it] })
  }
  for (const l of linhas) l.itens.sort((a, b) => a.x - b.x)
  return linhas
}

/** Junta pedaços colados (ex.: "Silvânia" + "(brigada)") em células; um novo pedaço só abre célula nova se houver espaço grande. */
function celulas(l: Linha): { x: number; t: string }[] {
  const out: { x: number; t: string; fim: number }[] = []
  for (const it of l.itens) {
    const ult = out[out.length - 1]
    if (ult && it.x - ult.fim < 4) { ult.t = `${ult.t} ${it.s.trim()}`; ult.fim = it.x + it.w }
    else out.push({ x: it.x, t: it.s.trim(), fim: it.x + it.w })
  }
  return out.map(({ x, t }) => ({ x, t }))
}

const textoLinha = (l: Linha) => celulas(l).map((c) => c.t).join(' ')
const normLinha = (l: Linha) => norm(textoLinha(l))

function colunaDe(x: number, inicios: number[]): number {
  let col = -1
  for (let i = 0; i < inicios.length; i++) if (x + 2 >= inicios[i]) col = i
  return col
}

const vazio = (s: string) => (/^(—|–|-|--)$/.test(s.trim()) ? '' : s.trim())

const DIAS: Record<string, string> = {
  seg: 'Segunda-feira', ter: 'Terça-feira', qua: 'Quarta-feira', qui: 'Quinta-feira', sex: 'Sexta-feira', sab: 'Sábado', dom: 'Domingo',
}

function hhmm(h: string, m: string): string { return `${h.padStart(2, '0')}:${m}` }

// ───────── página 1: cabeçalho, local/evento e fornecedores ─────────

interface Pagina1 {
  formandos: number | null; convidados: number | null
  titulo: string; tema: string; numeroOs: string; versao: number | null
  data: string; diaSemana: string; horario: string; localMaiusculo: string
  fornecedores: OsFornecedor[]; totalDeclarado: number | null
}

function lerPagina1(linhas: Linha[]): Pagina1 | null {
  const iForn = linhas.findIndex((l) => normLinha(l).includes('fornecedores,servicosecontatos'))
  if (iForn < 0) return null
  const r: Pagina1 = { formandos: null, convidados: null, titulo: '', tema: '', numeroOs: '', versao: null, data: '', diaSemana: '', horario: '', localMaiusculo: '', fornecedores: [], totalDeclarado: null }

  for (const l of linhas) {
    const n = normLinha(l)
    const m = n.match(/^(\d+)formandos(\d+)convidados$/)
    if (m) { r.formandos = Number(m[1]); r.convidados = Number(m[2]) }
  }
  const iOs = linhas.findIndex((l) => normLinha(l) === 'ordemdeservico')
  if (iOs >= 0 && linhas[iOs + 1]) r.titulo = textoLinha(linhas[iOs + 1])
  for (const l of linhas) {
    const m = textoLinha(l).match(/^Tema\s+(.+?)\s*·\s*OS\s+(\S+)\s*·\s*v(\d+)/i)
    if (m) { r.tema = m[1].trim(); r.numeroOs = m[2]; r.versao = Number(m[3]); break }
  }

  // cartões LOCAL / EVENTO / MONTAGEM / DESMONTAGEM: valores nas linhas abaixo, alinhados pelo x do rótulo
  const iRot = linhas.findIndex((l) => { const c = celulas(l).map((x) => norm(x.t)); return c.includes('local') && c.includes('evento') && c.includes('montagem') })
  if (iRot >= 0) {
    const cel = celulas(linhas[iRot])
    const xs = cel.map((c) => c.x)
    const iEvento = cel.findIndex((c) => norm(c.t) === 'evento')
    const iLocal = cel.findIndex((c) => norm(c.t) === 'local')
    const fim = linhas.findIndex((l, i) => i > iRot && normLinha(l).includes('contatosdodia'))
    const corpo = linhas.slice(iRot + 1, fim > 0 ? fim : iRot + 8)
    const doCartao = (idx: number) => corpo.flatMap((l) => celulas(l).filter((c) => colunaDe(c.x, xs) === idx).map((c) => c.t))
    const ev = doCartao(iEvento)
    const dm = (ev[0] ?? '').match(/^([A-Za-zÀ-ú]{3})\w*\s*·\s*(\d{2}\/\d{2}\/\d{4})/)
    if (dm) { r.diaSemana = DIAS[norm(dm[1])] ?? ''; r.data = dm[2] }
    r.horario = ev.slice(1).find((t) => /\d{1,2}h/.test(t)) ?? ''
    r.localMaiusculo = doCartao(iLocal)[0] ?? ''
  }

  // tabela de fornecedores: colunas pelo x do cabeçalho
  const totalM = linhas.map(normLinha).map((n) => n.match(/(\d+)fornecedores$/)).find(Boolean)
  if (totalM) r.totalDeclarado = Number(totalM[1])
  const iCab = linhas.findIndex((l, i) => i > iForn && normLinha(l).startsWith('#fornecedorservico'))
  if (iCab >= 0) {
    const cab = celulas(linhas[iCab])
    const xs = cab.map((c) => c.x)
    if (cab.length >= 6) {
      let atual: string[] | null = null
      const fecha = () => {
        if (!atual) return
        const [, nome, servico, contato, telefone, chegada] = atual
        if (nome) r.fornecedores.push({ nome, servico, contato: vazio(contato), telefone: vazio(telefone), chegada })
        atual = null
      }
      for (const l of linhas.slice(iCab + 1)) {
        if (norm(textoLinha(l)).startsWith('alliancecerimonial')) break
        const cols: string[] = ['', '', '', '', '', '']
        for (const c of celulas(l)) {
          const k = colunaDe(c.x, xs)
          if (k >= 0 && k < 6) cols[k] = cols[k] ? `${cols[k]} ${c.t}` : c.t
        }
        if (/^\d{1,3}$/.test(cols[0])) { fecha(); atual = cols } // linha numerada = fornecedor novo
        else if (atual) cols.forEach((t, k) => { if (t && k > 0) atual![k] = atual![k] ? `${atual![k]} ${t}` : t }) // continuação (texto quebrado)
      }
      fecha()
    }
  }
  return r
}

// ───────── página 2: operação, formandos/convidados/mesas e lineup ─────────

interface Pagina2 {
  formandos: number | null; convidados: number | null; mesas: number | null
  localSub: string; data: string; horarioSub: string; temaSub: string
  lineup: OsLineup[]; achouLineup: boolean
}

function lerPagina2(linhas: Linha[]): Pagina2 | null {
  if (!linhas.some((l) => normLinha(l).includes('operacaodoevento'))) return null
  const r: Pagina2 = { formandos: null, convidados: null, mesas: null, localSub: '', data: '', horarioSub: '', temaSub: '', lineup: [], achouLineup: false }

  for (const l of linhas) {
    const m = textoLinha(l).match(/^(.+?)\s·\s[A-Za-zÀ-ú]{3},\s(\d{2}\/\d{2}\/\d{4})\s·\s(.+?)\s·\s(.+)$/)
    if (m) { r.localSub = m[1]; r.data = m[2]; r.horarioSub = m[3]; r.temaSub = m[4]; break }
  }

  const iRot = linhas.findIndex((l) => { const c = celulas(l).map((x) => norm(x.t)); return c.includes('formandos') && c.includes('convidados') && c.includes('mesas') })
  if (iRot >= 0 && linhas[iRot + 1]) {
    const cel = celulas(linhas[iRot])
    const xs = cel.map((c) => c.x)
    const nums = celulas(linhas[iRot + 1])
    const valor = (rotulo: string) => {
      const k = cel.findIndex((c) => norm(c.t) === rotulo)
      const c = nums.find((n) => colunaDe(n.x, xs) === k)
      return c && /^\d+$/.test(c.t) ? Number(c.t) : null
    }
    r.formandos = valor('formandos'); r.convidados = valor('convidados'); r.mesas = valor('mesas')
  }

  const iL = linhas.findIndex((l) => { const c = celulas(l).map((x) => norm(x.t)); return c.includes('horario') && c.includes('atracao') })
  if (iL >= 0) {
    r.achouLineup = true
    const cab = celulas(linhas[iL])
    const xs = cab.map((c) => c.x)
    for (const l of linhas.slice(iL + 1)) {
      if (normLinha(l).startsWith('observacoes')) break
      const cs = celulas(l)
      const hor = cs.find((c) => colunaDe(c.x, xs) === 0)
      const atr = cs.find((c) => colunaDe(c.x, xs) === 1)
      const m = hor?.t.match(/(\d{1,2})h(\d{2})\s*[–—-]\s*(\d{1,2})h(\d{2})/)
      if (m && atr) r.lineup.push({ atracao: atr.t, inicio: hhmm(m[1], m[2]), fim: hhmm(m[3], m[4]) })
    }
  }
  return r
}

// ───────── interpretação ─────────

export function interpretarOs(paginas: ItemTexto[][]): OsLida {
  const ls = paginas.map(agruparLinhas)
  const p1 = ls.map(lerPagina1).find(Boolean) ?? null
  const p2 = ls.map(lerPagina2).find(Boolean) ?? null
  if (!p1 && !p2) throw new OsInvalidaErro('Este PDF não parece uma Ordem de Serviço da Alliance (não achei "Fornecedores, serviços e contatos" nem "Operação do evento").')

  const avisos: string[] = []
  const titulo = p1?.titulo ?? ''
  const local = p2?.localSub || p1?.localMaiusculo || ''
  const fornecedores = p1?.fornecedores ?? []
  const lineup = p2?.lineup ?? []

  if (!p1) avisos.push('Não achei a página 1 (cabeçalho e fornecedores).')
  if (!p2) avisos.push('Não achei a página "Operação do evento" (lineup, mesas).')
  if (p1) {
    if (fornecedores.length === 0) avisos.push('Não consegui ler a tabela de fornecedores.')
    else if (p1.totalDeclarado != null && p1.totalDeclarado !== fornecedores.length) avisos.push(`A OS declara ${p1.totalDeclarado} fornecedores, mas li ${fornecedores.length}. Confira a lista.`)
    if (!p1.data) avisos.push('Não consegui ler a data do evento.')
  }
  if (p2 && !p2.achouLineup) avisos.push('Não achei o quadro de lineup.')
  else if (p2 && lineup.length === 0) avisos.push('O quadro de lineup está vazio.')

  const formandos = p2?.formandos ?? p1?.formandos ?? null
  const convidados = p2?.convidados ?? p1?.convidados ?? null
  if (p1 && p2 && p1.convidados != null && p2.convidados != null && p1.convidados !== p2.convidados) avisos.push(`A OS tem convidados diferentes entre as páginas (${p1.convidados} e ${p2.convidados}).`)
  if (p1 && p2 && p1.formandos != null && p2.formandos != null && p1.formandos !== p2.formandos) avisos.push(`A OS tem formandos diferentes entre as páginas (${p1.formandos} e ${p2.formandos}).`)

  return {
    numeroOs: p1?.numeroOs ?? '',
    versao: p1?.versao ?? null,
    nomeEvento: titulo,
    tematica: p1?.tema || p2?.temaSub || '',
    data: p1?.data || p2?.data || '',
    diaSemana: p1?.diaSemana ?? '',
    horario: p1?.horario || p2?.horarioSub || '',
    local,
    formandos, convidados, mesas: p2?.mesas ?? null,
    fornecedores, lineup, avisos,
  }
}

// ───────── extração de texto (estrutural: funciona com o pdf.js do navegador e com o build legacy em Node) ─────────

interface PdfPaginaLike { getTextContent(): Promise<{ items: unknown[] }> }
interface PdfDocLike { numPages: number; getPage(n: number): Promise<PdfPaginaLike> }

export async function paginasDoDoc(doc: PdfDocLike): Promise<ItemTexto[][]> {
  const out: ItemTexto[][] = []
  for (let n = 1; n <= doc.numPages; n++) {
    const tc = await (await doc.getPage(n)).getTextContent()
    const itens: ItemTexto[] = []
    for (const raw of tc.items) {
      const i = raw as { str?: string; transform?: number[]; width?: number }
      if (typeof i.str === 'string' && i.str.trim() && Array.isArray(i.transform)) itens.push({ s: i.str, x: i.transform[4], y: i.transform[5], w: i.width ?? 0 })
    }
    out.push(itens)
  }
  return out
}
