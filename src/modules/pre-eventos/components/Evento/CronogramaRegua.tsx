import React, { useEffect, useMemo, useState } from 'react'
import { CalendarClock, Plus, Trash2, Save, ListChecks } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { newItemId } from '../../utils/formatters'
import {
  STATUS_REGUA, RESPONSAVEIS_ALLIANCE, TEMPLATES_REGUA, templateParaTipo,
} from '../../../../data/reguaTemplates'
import type { Orcamento } from '../../types'

interface TarefaRegua {
  id: string
  tarefa: string
  momento: string
  dias: number
  responsavel: string
  status: string
  observacoes: string
  ordem: number
}

// data do evento (ISO) menos `dias` → dd/mm/yyyy
function dataPrevista(dataEventoISO: string, dias: number): string {
  if (!dataEventoISO) return '—'
  const base = new Date(dataEventoISO + 'T00:00:00')
  if (isNaN(base.getTime())) return '—'
  base.setDate(base.getDate() - dias)
  return base.toLocaleDateString('pt-BR')
}

function diasParaEvento(dataEventoISO: string): number | null {
  if (!dataEventoISO) return null
  const alvo = new Date(dataEventoISO + 'T00:00:00')
  if (isNaN(alvo.getTime())) return null
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000)
}

const STATUS_TEXT: Record<string, string> = {
  'Concluído':    '!text-success',
  'A iniciar':    '!text-white',
  'Em andamento': '!text-yellow-400',
  'Pendente':     '!text-orange-400',
  'Cancelado':    '!text-red-400 line-through',
}

export const CronogramaRegua: React.FC<{ orc: Orcamento }> = ({ orc }) => {
  const [tarefas, setTarefas] = useState<TarefaRegua[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    async function load() {
      setLoading(true); setErro(null)
      if (!supabase) { setLoading(false); return }
      const { data, error } = await supabase
        .from('regua_tarefas')
        .select('*')
        .eq('orcamento_id', orc.id)
        .order('ordem', { ascending: true })
      if (!ativo) return
      if (error) setErro('Erro ao carregar o cronograma.')
      else setTarefas((data ?? []) as TarefaRegua[])
      setLoading(false)
    }
    load()
    return () => { ativo = false }
  }, [orc.id])

  const tipoTemplate = useMemo(() => templateParaTipo(orc.tipo), [orc.tipo])

  async function criarDoTemplate() {
    if (!supabase) return
    setSaving(true); setErro(null)
    const tpl = TEMPLATES_REGUA[tipoTemplate].tarefas
    const linhas = tpl.map((t, i) => ({
      projeto_id: orc.turma || '',
      orcamento_id: orc.id,
      tarefa: t.tarefa,
      momento: t.momento,
      dias: t.dias,
      responsavel: '',
      status: 'A iniciar',
      observacoes: '',
      ordem: i,
    }))
    const { data, error } = await supabase.from('regua_tarefas').insert(linhas).select('*')
    if (error) setErro('Erro ao criar o cronograma. (Precisa estar logado como equipe.)')
    else setTarefas((data ?? []) as TarefaRegua[])
    setSaving(false)
  }

  function upd(id: string, campo: keyof TarefaRegua, valor: string | number) {
    setTarefas(prev => prev.map(t => t.id === id ? { ...t, [campo]: valor } : t))
    setDirty(true)
  }

  function addTarefa() {
    setTarefas(prev => [...prev, {
      id: `novo_${newItemId()}`, tarefa: '', momento: '', dias: 0,
      responsavel: '', status: 'A iniciar', observacoes: '', ordem: prev.length,
    }])
    setDirty(true)
  }

  async function removerTarefa(id: string) {
    if (!supabase) return
    if (!id.startsWith('novo_')) {
      const { error } = await supabase.from('regua_tarefas').delete().eq('id', id)
      if (error) { setErro('Erro ao remover.'); return }
    }
    setTarefas(prev => prev.filter(t => t.id !== id))
  }

  async function salvar() {
    if (!supabase) return
    setSaving(true); setErro(null)
    const rows = tarefas.map((t, i) => ({
      ...(t.id.startsWith('novo_') ? {} : { id: t.id }),
      projeto_id: orc.turma || '',
      orcamento_id: orc.id,
      tarefa: t.tarefa,
      momento: t.momento,
      dias: t.dias,
      responsavel: t.responsavel,
      status: t.status,
      observacoes: t.observacoes,
      ordem: i,
      updated_at: new Date().toISOString(),
    }))
    const { data, error } = await supabase.from('regua_tarefas').upsert(rows).select('*')
    if (error) setErro('Erro ao salvar. (Precisa estar logado como equipe.)')
    else { setTarefas((data ?? []) as TarefaRegua[]); setDirty(false) }
    setSaving(false)
  }

  const dias = diasParaEvento(orc.data)
  const concluidas = tarefas.filter(t => t.status === 'Concluído').length
  const total = tarefas.length
  const pct = total > 0 ? Math.round((concluidas / total) * 100) : 0

  if (loading) return <div className="text-muted text-sm py-8 text-center">Carregando cronograma…</div>

  // Cara de texto: sem caixa/borda por padrão; borda só no hover/focus (igual a coluna Prazo).
  const selCls = 'bg-transparent border border-transparent hover:border-bordercol/60 focus:border-accent rounded px-1.5 py-1 text-sm text-white/90 outline-none transition-colors'

  return (
    <div className="space-y-4">
      {/* Cabeçalho: contagem + jornada */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-surface-2 border border-bordercol rounded-card p-4">
          <div className="text-xs text-muted mb-1 flex items-center gap-1"><CalendarClock className="w-3.5 h-3.5" /> Data do evento</div>
          <div className="text-white font-semibold">{orc.data ? new Date(orc.data + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</div>
        </div>
        <div className="bg-surface-2 border border-bordercol rounded-card p-4">
          <div className="text-xs text-muted mb-1">Contagem regressiva</div>
          <div className="text-accent font-semibold">{dias == null ? '—' : dias >= 0 ? `faltam ${dias} dias` : `${Math.abs(dias)} dias atrás`}</div>
        </div>
        <div className="bg-surface-2 border border-bordercol rounded-card p-4">
          <div className="text-xs text-muted mb-1 flex items-center gap-1"><ListChecks className="w-3.5 h-3.5" /> Jornada</div>
          <div className="text-white font-semibold">{concluidas} de {total} · {pct}%</div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mt-2">
            <div className="h-full bg-success rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      {erro && <div className="text-danger text-xs bg-danger/10 border border-danger/30 rounded px-3 py-2">{erro}</div>}

      {total === 0 ? (
        <div className="bg-surface-2 border border-bordercol rounded-card p-8 text-center">
          <p className="text-muted text-sm mb-4">Nenhum cronograma criado pra este pré-evento.</p>
          <button
            onClick={criarDoTemplate}
            disabled={saving}
            className="inline-flex items-center gap-2 bg-accent hover:bg-accent/90 disabled:opacity-50 text-white text-sm font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> Criar a partir da {TEMPLATES_REGUA[tipoTemplate].nome}
          </button>
        </div>
      ) : (
        <div className="bg-surface-2 border border-bordercol rounded-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/4 border-b border-bordercol text-muted text-xs">
                  <th className="text-left px-3 py-2 font-medium w-28">Momento</th>
                  <th className="text-left px-3 py-2 font-medium">Tarefa</th>
                  <th className="text-left px-3 py-2 font-medium w-24">Prazo</th>
                  <th className="text-left px-3 py-2 font-medium w-40">Responsável</th>
                  <th className="text-left px-3 py-2 font-medium w-36">Status</th>
                  <th className="text-left px-3 py-2 font-medium">Obs.</th>
                  <th className="w-9" />
                </tr>
              </thead>
              <tbody>
                {tarefas.map(t => (
                  <tr key={t.id} className="border-b border-bordercol/50 last:border-0 hover:bg-white/2">
                    <td className="px-3 py-2">
                      <input className={`${selCls} w-24`} value={t.momento} onChange={e => upd(t.id, 'momento', e.target.value)} placeholder="D-60" />
                    </td>
                    <td className="px-3 py-2">
                      <input className={`${selCls} w-full`} value={t.tarefa} onChange={e => upd(t.id, 'tarefa', e.target.value)} placeholder="Descrição da tarefa" />
                    </td>
                    <td className="px-3 py-2 text-muted whitespace-nowrap">{dataPrevista(orc.data, t.dias)}</td>
                    <td className="px-3 py-2">
                      <select className={`${selCls} w-full`} value={t.responsavel} onChange={e => upd(t.id, 'responsavel', e.target.value)}>
                        <option value="">—</option>
                        {RESPONSAVEIS_ALLIANCE.map(r => <option key={r} value={r}>{r}</option>)}
                        {t.responsavel && !RESPONSAVEIS_ALLIANCE.includes(t.responsavel as typeof RESPONSAVEIS_ALLIANCE[number]) && (
                          <option value={t.responsavel}>{t.responsavel}</option>
                        )}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        className={`${selCls} w-full font-medium ${STATUS_TEXT[t.status] ?? ''}`}
                        value={t.status}
                        onChange={e => upd(t.id, 'status', e.target.value)}
                      >
                        {STATUS_REGUA.map(s => <option key={s} value={s} className="bg-surface text-white">{s}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input className={`${selCls} w-full`} value={t.observacoes} onChange={e => upd(t.id, 'observacoes', e.target.value)} placeholder="—" />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button onClick={() => removerTarefa(t.id)} className="text-danger/60 hover:text-danger transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-3 py-2.5 border-t border-bordercol bg-white/2">
            <button onClick={addTarefa} className="flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Adicionar tarefa
            </button>
            <button
              onClick={salvar}
              disabled={saving || !dirty}
              className="flex items-center gap-2 bg-accent hover:bg-accent/90 disabled:opacity-40 text-white text-sm font-semibold py-1.5 px-4 rounded-lg transition-colors"
            >
              <Save className="w-4 h-4" /> {saving ? 'Salvando…' : 'Salvar cronograma'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
