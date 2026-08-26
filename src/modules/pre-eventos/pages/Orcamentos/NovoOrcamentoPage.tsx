import React, { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, FileText, Users, AlertTriangle } from 'lucide-react'
import { useAppContext } from '../../contexts/AppContext'
import { criarOrcamentoVazio } from '../../hooks/useOrcamentos'
import { EVENT_TYPE_LABELS, EVENT_TYPES } from '../../data/defaults'
import { gerarItensDoHistorico, sugerirConvidados } from '../../utils/estimativa'
import { INFO_EVENTO_VAZIO } from '../../components/Evento/AbaInfoEvento'
import { SECOES } from '../../utils/matchEverest'
import { formatBRL } from '../../utils/formatters'
import type { EventType, Orcamento } from '../../types'

export const NovoOrcamentoPage: React.FC = () => {
  const navigate = useNavigate()
  const { salvarOrcamento, addToast, config, orcamentos } = useAppContext()
  const [tipo, setTipo] = useState<EventType>('FESTA_MEIO_CURSO')
  const [instituicao, setInstituicao] = useState('')
  const [turma, setTurma] = useState('')
  const [convidados, setConvidados] = useState(200)
  const [convidadosEditado, setConvidadosEditado] = useState(false)
  const [formandos, setFormandos] = useState(0)

  // Sugere convidados pela mediana histórica do tipo (refina pela instituição).
  const sugestaoConv = useMemo(
    () => sugerirConvidados(orcamentos, tipo, instituicao),
    [orcamentos, tipo, instituicao],
  )
  // Enquanto a atendente não digitar manualmente, o campo segue a sugestão.
  useEffect(() => {
    if (!convidadosEditado && sugestaoConv.convidados > 0) setConvidados(sugestaoConv.convidados)
  }, [sugestaoConv, convidadosEditado])

  // Instituições já cadastradas — pra sugerir e evitar digitar errado/sem acento.
  const instituicoesExistentes = useMemo(
    () => [...new Set(orcamentos.map(o => (o.instituicao || '').trim()).filter(Boolean))].sort(),
    [orcamentos],
  )

  // Já existe um orçamento do mesmo tipo + turma? (evita criar duplicado)
  const existente = useMemo(() => {
    const t = turma.trim().toLowerCase()
    if (!t) return null
    return orcamentos.find(o => o.tipo === tipo && (o.turma || '').trim().toLowerCase() === t) ?? null
  }, [orcamentos, tipo, turma])

  // Preview ao vivo do que o histórico geraria.
  const preview = useMemo(
    () => gerarItensDoHistorico(orcamentos, tipo, convidados),
    [orcamentos, tipo, convidados],
  )
  const nComValor = useMemo(
    () => SECOES.reduce((s, sec) => s + preview.itensPorSecao[sec.key].filter(i => i.totalOrcado > 0).length, 0),
    [preview],
  )
  const custoEstimado = useMemo(
    () => SECOES.reduce((s, sec) => s + preview.itensPorSecao[sec.key].reduce((a, i) => a + i.totalOrcado, 0), 0),
    [preview],
  )
  const nSugestoes = useMemo(
    () => SECOES.reduce((s, sec) => s + preview.sugestoesPorSecao[sec.key].length, 0),
    [preview],
  )

  const temHistorico = preview.orcamentosBase > 0 && custoEstimado > 0

  function finalizar(orc: Orcamento) {
    orc.instituicao = instituicao
    orc.turma = turma
    orc.quantidadeConvidados = convidados
    orc.infoEvento = {
      ...(orc.infoEvento ?? INFO_EVENTO_VAZIO),
      formandos: formandos > 0 ? String(formandos) : (orc.infoEvento?.formandos ?? ''),
      totalConvidados: convidados > 0 ? String(convidados) : (orc.infoEvento?.totalConvidados ?? ''),
    }
    salvarOrcamento(orc)
    navigate(`/pre-eventos/orcamentos/${orc.id}`)
  }

  function criarDoHistorico() {
    const base = criarOrcamentoVazio(tipo, config)
    const orc: Orcamento = {
      ...base,
      operacaoEstrutura: preview.itensPorSecao.operacaoEstrutura,
      equipe: preview.itensPorSecao.equipe,
      atracao: preview.itensPorSecao.atracao,
      abBebidas: preview.itensPorSecao.abBebidas,
      extras: preview.itensPorSecao.extras,
    }
    finalizar(orc)
    addToast(`Orçamento gerado com ${nComValor} itens preenchidos do histórico!`, 'success')
  }

  function criarEmBranco() {
    finalizar(criarOrcamentoVazio(tipo, config))
    addToast('Orçamento em branco criado!', 'success')
  }

  const inputCls = 'w-full bg-surface border border-bordercol rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-accent transition-colors'
  const labelCls = 'block mb-1.5 text-sm text-muted'
  const nivelLabel = { tipo: 'do mesmo tipo', categoria: 'de porte parecido', geral: 'gerais', vazio: '' }[preview.nivelFiltro]

  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-surface-2 border border-bordercol rounded-card p-8">
        <h2 className="text-white font-bold text-xl mb-1">Novo Orçamento</h2>
        <p className="text-muted text-sm mb-6">Preencha os dados — o sistema já sugere valores baseados no histórico.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div className="sm:col-span-2">
            <label className={labelCls}>Tipo de Evento</label>
            <select value={tipo} onChange={e => setTipo(e.target.value as EventType)} className={inputCls}>
              {EVENT_TYPES.map(t => <option key={t} value={t}>{EVENT_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Instituição</label>
            <input value={instituicao} onChange={e => setInstituicao(e.target.value)} className={inputCls}
              placeholder="Ex: UNIFENAS" list="lista-instituicoes" autoComplete="off" />
            <datalist id="lista-instituicoes">
              {instituicoesExistentes.map(i => <option key={i} value={i} />)}
            </datalist>
          </div>
          <div>
            <label className={labelCls}>Turma</label>
            <input value={turma} onChange={e => setTurma(e.target.value)} className={inputCls} placeholder="Ex: UNIFENAS 44" />
          </div>
          <div>
            <label className={labelCls}>Quantidade de Convidados</label>
            <input type="number" min={0} value={convidados || ''}
              onChange={e => { setConvidados(Number(e.target.value) || 0); setConvidadosEditado(true) }}
              className={inputCls} />
            {sugestaoConv.convidados > 0 && (
              <p className="text-[11px] text-muted mt-1 flex items-center gap-1.5">
                <Users className="w-3 h-3" />
                Média {sugestaoConv.escopo === 'instituicao' ? `da ${instituicao}` : 'do tipo'}:{' '}
                <b className="text-gray-300">{sugestaoConv.convidados}</b> ({sugestaoConv.amostras}ev)
                {convidadosEditado && (
                  <button onClick={() => setConvidadosEditado(false)} className="text-accent hover:underline ml-1">usar</button>
                )}
              </p>
            )}
          </div>
          <div>
            <label className={labelCls}>Quantidade de Formandos</label>
            <input type="number" min={0} value={formandos || ''}
              onChange={e => setFormandos(Number(e.target.value) || 0)} className={inputCls} placeholder="ex: 200" />
            <p className="text-[10px] text-muted mt-1">Usado na fórmula dos lotes de ingresso.</p>
          </div>
        </div>

        {/* Aviso de orçamento já existente (mesmo tipo + turma) */}
        {existente && (
          <div className="bg-warning/10 border border-warning/40 rounded-lg p-4 mb-5">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium">Já existe um orçamento desse evento</p>
                <p className="text-xs text-muted mt-0.5">
                  <b className="text-gray-300">{EVENT_TYPE_LABELS[tipo]}</b> para a turma <b className="text-gray-300">{existente.turma}</b> já foi criado. Talvez você queira abrir ele em vez de criar outro.
                </p>
                <button
                  onClick={() => navigate(`/pre-eventos/orcamentos/${existente.id}`)}
                  className="mt-2 text-xs font-semibold text-warning hover:underline"
                >
                  Abrir o orçamento existente →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Preview do que o histórico gera */}
        {temHistorico ? (
          <div className="bg-accent/5 border border-accent/30 rounded-lg p-4 mb-5">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-accent" />
              <span className="text-sm font-semibold text-white">Pré-preenchimento do histórico</span>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Baseado em <b className="text-white">{preview.orcamentosBase}</b> orçamento{preview.orcamentosBase !== 1 ? 's' : ''} {nivelLabel}, vou preencher{' '}
              <b className="text-white">{nComValor} itens</b> com valor (além das linhas padrão) — custo estimado{' '}
              <b className="text-white">{formatBRL(custoEstimado)}</b>.
              {nSugestoes > 0 && <> Mais <b className="text-white">{nSugestoes}</b> sugestões opcionais.</>}
              {' '}Tudo editável depois.
            </p>
          </div>
        ) : (
          <div className="bg-white/5 border border-bordercol rounded-lg p-4 mb-5">
            <p className="text-xs text-muted flex items-center gap-2">
              <Users className="w-4 h-4" /> Ainda não há histórico suficiente desse tipo — o orçamento vai começar em branco.
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={() => navigate('/pre-eventos/orcamentos')} className="py-2.5 px-4 rounded-lg border border-bordercol text-muted hover:text-white hover:bg-white/5 text-sm transition-colors">
            Cancelar
          </button>
          <div className="flex-1" />
          <button onClick={criarEmBranco} className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-bordercol text-muted hover:text-white hover:bg-white/5 text-sm transition-colors">
            <FileText className="w-4 h-4" /> Em branco
          </button>
          <button
            onClick={criarDoHistorico}
            disabled={!temHistorico}
            className="flex items-center justify-center gap-2 py-2.5 px-5 rounded-lg bg-accent hover:bg-accent/90 disabled:opacity-40 text-white font-semibold text-sm transition-colors"
          >
            <Sparkles className="w-4 h-4" /> Gerar do histórico
          </button>
        </div>
      </div>
    </div>
  )
}
