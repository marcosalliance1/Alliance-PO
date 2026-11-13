import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import type { Categoria } from './config'

export type Dados = Record<string, unknown>

export interface Registro {
  id: string
  categoria: string
  projeto_id: string | null
  turma_nome: string | null
  status: string | null
  dados: Dados
  extras: Dados
  fixado: boolean
  criado_em: string
  atualizado_em: string
  concluido_em: string | null
}

export interface ProjetoOpcao {
  id: string
  nome: string
}

export const BUCKET_ANEXOS = 'atendimento-anexos'
const TURMA_GERAL = 'Geral'

// ── P.O.s (turmas) ────────────────────────────────────────────────────────────
export function useProjetosOpcoes() {
  const [projetos, setProjetos] = useState<ProjetoOpcao[]>([])
  useEffect(() => {
    let vivo = true
    supabase.from('projetos').select('id, tap').then(({ data }) => {
      if (!vivo || !data) return
      const lista = data.map(p => {
        const tap = (p.tap ?? {}) as { turma?: string; instituicao?: string; curso?: string }
        return { id: p.id as string, nome: tap.turma || `${tap.instituicao ?? ''} ${tap.curso ?? ''}`.trim() || String(p.id).slice(0, 8) }
      }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      setProjetos(lista)
    })
    return () => { vivo = false }
  }, [])
  return projetos
}

export function nomeTurma(r: Registro, projetos: ProjetoOpcao[]): string {
  if (r.projeto_id) return projetos.find(p => p.id === r.projeto_id)?.nome ?? r.turma_nome ?? '—'
  return r.turma_nome ?? ''
}

// valor do select de turma: id da P.O., "Geral" ou "" (vazio)
export function valorTurma(r: Pick<Registro, 'projeto_id' | 'turma_nome'>): string {
  return r.projeto_id ?? (r.turma_nome === TURMA_GERAL ? TURMA_GERAL : '')
}

function separarTurma(valor: string): { projeto_id: string | null; turma_nome: string | null } {
  if (!valor) return { projeto_id: null, turma_nome: null }
  if (valor === TURMA_GERAL) return { projeto_id: null, turma_nome: TURMA_GERAL }
  return { projeto_id: valor, turma_nome: null }
}

// ── Registros de uma categoria ────────────────────────────────────────────────
function consultar(categoria: string) {
  return supabase
    .from('atendimento_registros')
    .select('*')
    .eq('categoria', categoria)
    .order('criado_em', { ascending: false })
}

export function useRegistros(cat: Categoria) {
  const [registros, setRegistros] = useState<Registro[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const aplicar = useCallback((res: Awaited<ReturnType<typeof consultar>>) => {
    if (res.error) {
      // Nunca zera a lista já carregada por causa de uma falha de leitura.
      setErro(`Não foi possível carregar: ${res.error.message}`)
    } else {
      setErro(null)
      setRegistros((res.data ?? []) as Registro[])
    }
    setCarregando(false)
  }, [])

  useEffect(() => {
    let vivo = true
    consultar(cat.id).then(res => { if (vivo) aplicar(res) })
    return () => { vivo = false }
  }, [cat.id, aplicar])

  const recarregar = useCallback(async () => {
    setCarregando(true)
    aplicar(await consultar(cat.id))
  }, [cat.id, aplicar])

  // Salva (cria ou atualiza). `turma` vem do select (id da P.O. / "Geral" / "").
  const salvar = useCallback(async (id: string | null, dados: Dados, turma: string, fixado = false): Promise<Registro> => {
    const status = cat.campoStatus ? String(dados[cat.campoStatus] ?? '') || null : null
    const finalizado = !!status && !!cat.finalizados?.includes(status)
    const anterior = id ? registros.find(r => r.id === id) : undefined
    const linha = {
      categoria: cat.id,
      ...separarTurma(turma),
      status,
      dados,
      fixado,
      // data de conclusão: marca ao finalizar, limpa se reabrir (alimenta "tempo médio")
      concluido_em: finalizado ? (anterior?.concluido_em ?? new Date().toISOString()) : null,
    }
    const q = id
      ? supabase.from('atendimento_registros').update(linha).eq('id', id).select().single()
      : supabase.from('atendimento_registros').insert(linha).select().single()
    const { data, error } = await q
    if (error) {
      if (error.code === '23505') throw new Error('Essa turma já tem um perfil cadastrado.')
      throw new Error(error.message)
    }
    const salvo = data as Registro
    setRegistros(lista => id ? lista.map(r => r.id === id ? salvo : r) : [salvo, ...lista])
    return salvo
  }, [cat, registros])

  const excluir = useCallback(async (r: Registro) => {
    const { error } = await supabase.from('atendimento_registros').delete().eq('id', r.id)
    if (error) throw new Error(error.message)
    const anexos = cat.campos
      .filter(c => c.type === 'image')
      .map(c => r.dados[c.key])
      .filter((p): p is string => typeof p === 'string' && p.length > 0)
    if (anexos.length) await removerAnexos(anexos)
    setRegistros(lista => lista.filter(x => x.id !== r.id))
  }, [cat])

  return { registros, carregando, erro, recarregar, salvar, excluir }
}

// ── Anexos ────────────────────────────────────────────────────────────────────
export async function enviarAnexo(catId: string, arquivo: File): Promise<string> {
  const ext = (arquivo.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
  const path = `${catId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET_ANEXOS).upload(path, arquivo, { contentType: arquivo.type || undefined })
  if (error) throw new Error(`Falha ao enviar o anexo: ${error.message}`)
  return path
}

export async function removerAnexos(paths: string[]) {
  const { data, error } = await supabase.storage.from(BUCKET_ANEXOS).remove(paths)
  // remove() pode "dar certo" sem apagar nada se a policy de delete faltar
  if (error || (data && data.length < paths.length)) {
    console.warn('[atendimento] anexo não foi removido do bucket', paths, error)
  }
}

export async function urlAnexo(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET_ANEXOS).createSignedUrl(path, 60 * 10)
  if (error) return null
  return data.signedUrl
}
