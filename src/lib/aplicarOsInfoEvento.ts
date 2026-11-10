// Regras para aplicar a OS lida (lerOsPdf.ts) na aba "Info do Evento".
// Princípio: nada é sobrescrito sem o usuário escolher; fornecedores/lineup são mesclados por nome.

import type { InfoEvento, InfoEventoFornecedor, InfoEventoLineup } from '../types'
import { norm, type OsLida, type OsFornecedor, type OsLineup } from './lerOsPdf'

export type CampoOs = 'nomeEvento' | 'diaSemana' | 'local' | 'horario' | 'tematica' | 'formandos'

export interface PropostaCampo {
  campo: CampoOs
  rotulo: string
  atual: string
  novo: string
  /** sugestão inicial: marcado só quando o campo está vazio (nunca sobrescreve sem escolha) */
  aplicarPadrao: boolean
}

const ROTULOS: [CampoOs, string][] = [
  ['nomeEvento', 'Nome do evento'], ['diaSemana', 'Dia da semana'], ['local', 'Local'],
  ['horario', 'Horário'], ['tematica', 'Temática'], ['formandos', 'Formandos'],
]

/** Campos escalares da OS que diferem do que já está na aba. Campos iguais não entram. */
export function propostaCampos(info: InfoEvento, os: OsLida): PropostaCampo[] {
  const novos: Record<CampoOs, string> = {
    nomeEvento: os.nomeEvento, diaSemana: os.diaSemana, local: os.local, horario: os.horario,
    tematica: os.tematica, formandos: os.formandos != null ? String(os.formandos) : '',
  }
  const out: PropostaCampo[] = []
  for (const [campo, rotulo] of ROTULOS) {
    const novo = novos[campo].trim()
    const atual = String(info[campo] ?? '').trim()
    if (!novo || novo === atual) continue
    out.push({ campo, rotulo, atual, novo, aplicarPadrao: atual === '' })
  }
  return out
}

// ───────── fornecedores ─────────

const chave = (s: string) => norm(s).replace(/[^a-z0-9]/g, '')
const parecidos = (a: string, b: string) => { const x = chave(a), y = chave(b); return x.length >= 3 && y.length >= 3 && (x === y || x.includes(y) || y.includes(x)) }

export interface ResumoMescla { novos: number; atualizados: number }

/** 'mesclar' mantém o que já existe e só acrescenta/corrige; 'substituir' troca tudo pela OS. */
export function mesclarFornecedores(atuais: InfoEventoFornecedor[], os: OsFornecedor[], modo: 'mesclar' | 'substituir'): { lista: InfoEventoFornecedor[]; resumo: ResumoMescla } {
  const novoDaOs = (f: OsFornecedor): InfoEventoFornecedor => ({ categoria: f.servico, fornecedor: f.nome, status: 'fechado' })
  if (modo === 'substituir') return { lista: os.map(novoDaOs), resumo: { novos: os.length, atualizados: 0 } }

  const lista = atuais.map((f) => ({ ...f }))
  const usados = new Set<number>()
  let novos = 0, atualizados = 0
  for (const f of os) {
    const i = lista.findIndex((a, k) => !usados.has(k) && (parecidos(a.fornecedor, f.nome) || (!a.fornecedor && parecidos(a.categoria, f.nome))))
    if (i < 0) { lista.push(novoDaOs(f)); usados.add(lista.length - 1); novos++; continue }
    usados.add(i)
    const a = lista[i]
    if (!a.fornecedor) { // nome foi digitado no campo "categoria": move para o lugar certo
      lista[i] = { ...a, categoria: f.servico, fornecedor: f.nome }
      atualizados++
    } else if (!a.categoria) { lista[i] = { ...a, categoria: f.servico }; atualizados++ }
  }
  return { lista, resumo: { novos, atualizados } }
}

// ───────── lineup ─────────

const nomeAtracao = (s: string) => chave(s).replace(/^dj/, '')
const minutos = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return (h < 12 ? h + 24 : h) * 60 + m } // madrugada vem depois da noite

export function mesclarLineup(atuais: InfoEventoLineup[], os: OsLineup[], modo: 'mesclar' | 'substituir'): { lista: InfoEventoLineup[]; resumo: ResumoMescla } {
  const novoDaOs = (l: OsLineup): InfoEventoLineup => ({ atracao: l.atracao, horarioInicio: l.inicio, horarioTermino: l.fim, status: 'fechado' })
  const ordenar = (l: InfoEventoLineup[]) => [...l].sort((a, b) => minutos(a.horarioInicio || '12:00') - minutos(b.horarioInicio || '12:00'))
  if (modo === 'substituir') return { lista: ordenar(os.map(novoDaOs)), resumo: { novos: os.length, atualizados: 0 } }

  const lista = atuais.map((l) => ({ ...l }))
  const usados = new Set<number>()
  let novos = 0, atualizados = 0
  for (const l of os) {
    // prefere o mesmo nome com o mesmo horário de início (ex.: "DJ Alliance" aparece 2x)
    const mesmoNome = (a: InfoEventoLineup, k: number) => !usados.has(k) && parecidos(nomeAtracao(a.atracao || a.artista || ''), nomeAtracao(l.atracao))
    let i = lista.findIndex((a, k) => mesmoNome(a, k) && a.horarioInicio === l.inicio)
    if (i < 0) i = lista.findIndex(mesmoNome)
    if (i < 0) { lista.push(novoDaOs(l)); usados.add(lista.length - 1); novos++; continue }
    usados.add(i)
    const a = lista[i]
    if (a.horarioInicio !== l.inicio || a.horarioTermino !== l.fim) { lista[i] = { ...a, horarioInicio: l.inicio, horarioTermino: l.fim }; atualizados++ }
  }
  return { lista: ordenar(lista), resumo: { novos, atualizados } }
}

// ───────── divergências com o que o sistema já sabe (só avisa; não altera) ─────────

export function divergencias(os: OsLida, ref: { convidadosSistema?: number | null; dataEventoIso?: string | null }): string[] {
  const out: string[] = []
  if (os.convidados != null && ref.convidadosSistema && os.convidados !== ref.convidadosSistema)
    out.push(`Convidados: a OS diz ${os.convidados.toLocaleString('pt-BR')}, o sistema (P.O.) tem ${ref.convidadosSistema.toLocaleString('pt-BR')}. O total do cabeçalho não é alterado por esta importação.`)
  if (os.data && ref.dataEventoIso) {
    const [a, m, d] = ref.dataEventoIso.slice(0, 10).split('-')
    if (`${d}/${m}/${a}` !== os.data) out.push(`Data: a OS diz ${os.data}, o cabeçalho do projeto tem ${d}/${m}/${a}.`)
  }
  return out
}
