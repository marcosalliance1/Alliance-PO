import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { useAppContext } from '../../contexts/AppContext'
import { EVENT_TYPE_LABELS, EVENT_TYPES } from '../../data/defaults'
import { newItemId } from '../../utils/formatters'
import { calcularMediaHistorica, calcularResultado, calcularEscalaLotes } from '../../utils/simulador'
import { PainelBaseline } from '../../components/Simulador/PainelBaseline'
import { ResumoResultado } from '../../components/Simulador/ResumoResultado'
import CampoMoeda from '../../components/UI/CampoMoeda'
import TabelaLotes from '../../components/UI/TabelaLotes'
import type { Simulacao, EventType, CategoriaCusto } from '../../types'

const BASELINE_VAZIO = { operacaoEstrutura: 0, equipe: 0, atracao: 0, abBebidas: 0, extras: 0 }

function criarSimulacaoVazia(): Simulacao {
  const now = new Date().toISOString()
  return {
    id: newItemId(),
    nome: '',
    tipoEvento: '',
    quantidadeConvidados: 200,
    notas: '',
    bolsaFolia: 0,
    loteIngressos: [],
    numeroLotesEscala: 5,
    baseline: { ...BASELINE_VAZIO },
    criadoEm: now,
    atualizadoEm: now,
  }
}

export const SimuladorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { orcamentos, buscarSimulacao, salvarSimulacao, confirm, addToast } = useAppContext()

  const [sim, setSim] = useState<Simulacao | null>(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!id) {
      const inicial = criarSimulacaoVazia()
      const { baseline } = calcularMediaHistorica(orcamentos, inicial.tipoEvento, inicial.quantidadeConvidados)
      setSim({ ...inicial, baseline })
      return
    }
    const found = buscarSimulacao(id)
    if (found) setSim({ ...found, numeroLotesEscala: found.numeroLotesEscala || 5 })
    else navigate('/pre-eventos/simulador')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const mediaAtual = useMemo(() => {
    if (!sim) return null
    return calcularMediaHistorica(orcamentos, sim.tipoEvento, sim.quantidadeConvidados)
  }, [orcamentos, sim?.tipoEvento, sim?.quantidadeConvidados])

  const resultado = useMemo(() => {
    if (!sim) return null
    return calcularResultado(sim.baseline, sim.bolsaFolia, sim.loteIngressos)
  }, [sim?.baseline, sim?.bolsaFolia, sim?.loteIngressos])

  const precoInicial = sim?.loteIngressos[0]?.valorUnitario ?? 0

  const escala = useMemo(() => {
    if (!sim) return []
    return calcularEscalaLotes(precoInicial, sim.quantidadeConvidados, sim.numeroLotesEscala)
  }, [precoInicial, sim?.quantidadeConvidados, sim?.numeroLotesEscala])

  function set<K extends keyof Simulacao>(field: K, value: Simulacao[K]) {
    setSim(prev => (prev ? { ...prev, [field]: value } : prev))
    setDirty(true)
  }

  function handleBaselineChange(categoria: CategoriaCusto, valor: number) {
    setSim(prev => (prev ? { ...prev, baseline: { ...prev.baseline, [categoria]: valor } } : prev))
    setDirty(true)
  }

  function handleRecalcular() {
    if (!mediaAtual) return
    confirm('Isso vai sobrescrever os valores editados manualmente pela média histórica atual. Continuar?', () => {
      setSim(prev => (prev ? { ...prev, baseline: mediaAtual.baseline } : prev))
      setDirty(true)
    })
  }

  function handleSave() {
    if (!sim) return
    salvarSimulacao(sim)
    setDirty(false)
    addToast('Simulação salva com sucesso!', 'success')
    if (!id) navigate(`/pre-eventos/simulador/${sim.id}`)
  }

  if (!sim) return (
    <div className="flex items-center justify-center h-64 text-muted">Carregando...</div>
  )

  const inputCls = 'w-full bg-surface border border-bordercol rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-accent transition-colors'
  const labelCls = 'block text-xs text-muted mb-1'

  return (
    <div className="max-w-[1100px] mx-auto space-y-4 pb-20 md:pb-0">
      {/* Header bar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => navigate('/pre-eventos/simulador')}
          className="flex items-center gap-1 text-muted hover:text-white text-sm transition-colors min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <div className="flex-1" />
        {dirty && (
          <span className="text-xs text-warning border border-warning/30 bg-warning/10 rounded px-2 py-1">
            Não salvo
          </span>
        )}
        <button
          onClick={handleSave}
          className="flex items-center gap-2 bg-accent hover:bg-accent/90 text-white text-sm font-semibold py-2 px-4 rounded-lg transition-colors"
        >
          <Save className="w-4 h-4" /> Salvar
        </button>
      </div>

      {/* Dados da simulação */}
      <div className="bg-surface-2 border border-bordercol rounded-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-1 h-6 bg-accent rounded-full" />
          <h2 className="text-white font-semibold">Dados da Simulação</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Nome / Turma</label>
            <input
              className={inputCls}
              value={sim.nome}
              onChange={e => set('nome', e.target.value)}
              placeholder="Ex: CMMG 90 (hipotético)"
            />
          </div>
          <div>
            <label className={labelCls}>Tipo de Evento</label>
            <select
              value={sim.tipoEvento}
              onChange={e => set('tipoEvento', e.target.value as EventType | '')}
              className={inputCls}
            >
              <option value="">Todos (média geral)</option>
              {EVENT_TYPES.map(t => (
                <option key={t} value={t}>{EVENT_TYPE_LABELS[t]}</option>
              ))}
            </select>
            {mediaAtual?.categoria && (
              <p className="text-muted text-[10px] mt-1">Categoria: {mediaAtual.categoria}</p>
            )}
          </div>
          <div>
            <label className={labelCls}>Quantidade de Convidados</label>
            <input
              type="number"
              min={0}
              className={inputCls}
              value={sim.quantidadeConvidados || ''}
              onChange={e => set('quantidadeConvidados', Number(e.target.value) || 0)}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className={labelCls}>Observações / Particularidades</label>
            <textarea
              className={inputCls}
              rows={2}
              value={sim.notas}
              onChange={e => set('notas', e.target.value)}
              placeholder="Ex: instituição nova, sem histórico direto de eventos parecidos..."
            />
          </div>
        </div>
      </div>

      <PainelBaseline
        baseline={sim.baseline}
        amostras={mediaAtual?.amostras ?? BASELINE_VAZIO}
        onChange={handleBaselineChange}
        onRecalcular={handleRecalcular}
      />

      {/* Bolsa Folia */}
      <div className="bg-surface-2 border border-bordercol rounded-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-1 h-6 bg-accent rounded-full" />
          <h2 className="text-white font-semibold">Bolsa Folia</h2>
        </div>
        <div className="max-w-xs">
          <label className={labelCls}>Bolsa Folia (contratual)</label>
          <CampoMoeda value={sim.bolsaFolia} onChange={v => set('bolsaFolia', v)} className={inputCls} />
        </div>
      </div>

      {/* Venda de Ingressos */}
      <div className="bg-surface-2 border border-bordercol rounded-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-1 h-6 bg-accent rounded-full" />
          <h2 className="text-white font-semibold">Venda de Ingressos</h2>
        </div>
        <TabelaLotes
          lotes={sim.loteIngressos}
          onChange={l => set('loteIngressos', l)}
          labelTotal="TOTAL INGRESSOS"
          nomeItem="Lote"
        />
        <div className="max-w-xs mt-4">
          <label className={labelCls}>Nº de Lotes (escala do ponto de equilíbrio)</label>
          <input
            type="number"
            min={1}
            max={10}
            className={inputCls}
            value={sim.numeroLotesEscala || ''}
            onChange={e => set('numeroLotesEscala', Number(e.target.value) || 0)}
          />
          <p className="text-muted text-[10px] mt-1">
            Cada lote comporta no máximo 10% dos convidados, com o preço subindo R$15 a cada lote,
            partindo do preço do 1º lote acima.
          </p>
        </div>
      </div>

      {resultado && (
        <ResumoResultado resultado={resultado} escala={escala} temPrecoInicial={precoInicial > 0} />
      )}
    </div>
  )
}
