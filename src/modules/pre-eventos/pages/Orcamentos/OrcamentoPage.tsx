import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Save, FileDown, Sheet, ArrowLeft, Plus, Trash2, RefreshCw, Paperclip, FileUp, X, ExternalLink, FileWarning, Database, Wallet, Eraser, Ticket, Check, Users } from 'lucide-react'
import { useAppContext } from '../../contexts/AppContext'
import { EVENT_TYPE_LABELS, EVENT_TYPES } from '../../data/defaults'
import { formatBRL, newItemId } from '../../utils/formatters'
import TabelaItens from '../../components/Orcamento/TabelaItens'
import { ResumoFinanceiro } from '../../components/Orcamento/ResumoFinanceiro'
import { PainelMargem } from '../../components/Orcamento/PainelMargem'
import { PainelSugestoes } from '../../components/Orcamento/PainelSugestoes'
import { AbaInfoEvento } from '../../components/Evento/AbaInfoEvento'
import { CronogramaRegua } from '../../components/Evento/CronogramaRegua'
import { gerarLotesIngresso, custoVariavelPorPessoa } from '../../utils/lotesIngresso'
import { criarItemDeSugestao, type ItemEstimado } from '../../utils/estimativa'
import { useAuth } from '../../../../contexts/AuthContext'
import { PresencaBar } from '../../../../components/PresencaBar'
import { SecaoAccordion } from '../../components/Orcamento/SecaoAccordion'
import { exportarPDF, exportarPendenciasPDF, exportarRelatorioCliente } from '../../utils/exportPDF'
import { exportarExcel } from '../../utils/exportExcel'
import CampoMoeda from '../../components/UI/CampoMoeda'
import TabelaLotes from '../../components/UI/TabelaLotes'
import { ModalImportarPlanilha } from '../../components/Orcamento/ModalImportarPlanilha'
import { ModalImportarDoDrive } from '../../components/Orcamento/ModalImportarDoDrive'
import { ModalConciliacaoEverest } from '../../components/Everest/ModalConciliacaoEverest'
import { ModalApagarVazias } from '../../components/Orcamento/ModalApagarVazias'
import { ModalPreencherVCliente } from '../../components/Orcamento/ModalPreencherVCliente'
import { aplicarAssociacoes, SECOES as SECOES_EVEREST, type DestinoEverest, type FornecedorEverest, type SecaoKeyEverest } from '../../utils/matchEverest'
import { salvarDepara } from '../../utils/deparaEverest'
import { supabase } from '../../lib/supabase'
import { recalcularItem } from '../../utils/automacoes'
import type { Orcamento, EventType, OrcamentoStatus, ItemOrcamento, Cotacao, DocumentoCotacao } from '../../types'
import type { ItemImportado, SecaoKey } from '../../utils/importarPlanilha'

// ─── Campo com label ──────────────────────────────────────────────────────────
const CampoComLabel: React.FC<{
  label: string; value: number; onChange: (v: number) => void
}> = ({ label, value, onChange }) => (
  <div>
    <label className="block text-xs text-muted mb-1">{label}</label>
    <CampoMoeda
      value={value}
      onChange={onChange}
      className="w-full bg-surface border border-bordercol rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-accent transition-colors text-right"
    />
  </div>
)

// ─── Barra de progresso de pagamento ─────────────────────────────────────────
const BarraProgressoPagamento: React.FC<{ orc: Orcamento }> = ({ orc }) => {
  const secoes = [orc.operacaoEstrutura, orc.equipe, orc.atracao, orc.abBebidas, orc.extras]
  const totalOrcado = secoes.reduce((s, sec) => s + sec.reduce((a, i) => a + i.totalOrcado, 0), 0)
  const totalPago   = secoes.reduce((s, sec) => s + sec.reduce((a, i) => a + i.totalPagoReal, 0), 0)

  if (totalOrcado === 0 && totalPago === 0) return null

  const pct   = totalOrcado > 0 ? Math.min((totalPago / totalOrcado) * 100, 100) : 0
  const acima = totalPago > totalOrcado

  return (
    <div className="bg-surface-2 border border-bordercol rounded-card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted">Progresso de Pagamento</span>
        {acima && (
          <span className="text-xs font-semibold text-danger border border-danger/30 bg-danger/10 rounded px-2 py-0.5">
            Acima do orçamento
          </span>
        )}
      </div>
      <div className="w-full bg-surface2 rounded-full h-3 overflow-hidden">
        <div
          className={`h-3 rounded-full transition-all duration-500 ${acima ? 'bg-danger' : 'bg-success'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-muted mt-2">
        <span className="text-white font-semibold">{formatBRL(totalPago)}</span>
        {' '}pago de{' '}
        <span className="text-white font-semibold">{formatBRL(totalOrcado)}</span>
        {' '}orçado —{' '}
        <span className={`font-semibold ${acima ? 'text-danger' : 'text-success'}`}>
          {totalOrcado > 0 ? ((totalPago / totalOrcado) * 100).toFixed(1) : '0.0'}% concluído
        </span>
      </p>
    </div>
  )
}

// Item Contratado cuja Data de Pagamento já chegou/passou (≤ hoje) vira Pago.
// Status não afeta cálculo (BV/cards usam Total Pago), então é seguro.
function aplicarPagoPorData(o: Orcamento): Orcamento {
  const hoje = new Date().toISOString().slice(0, 10) // YYYY-MM-DD (compara lexicográfico = cronológico)
  let mudou = false
  const flip = (itens: ItemOrcamento[]) => itens.map(it => {
    if (it.status === 'CONTRATADO' && it.dataPagamento && it.dataPagamento <= hoje) {
      mudou = true
      return { ...it, status: 'PAGO' as const }
    }
    return it
  })
  const novo: Orcamento = {
    ...o,
    operacaoEstrutura: flip(o.operacaoEstrutura),
    equipe: flip(o.equipe),
    atracao: flip(o.atracao),
    abBebidas: flip(o.abBebidas),
    extras: flip(o.extras),
  }
  return mudou ? novo : o
}

// Plataformas/formas de venda sugeridas (múltiplo — um pré-evento pode usar várias).
const PLATAFORMAS_PADRAO = ['Sympla', 'PIX', 'Dinheiro', 'Cartão', 'Transferência']

// ─── Main Page ────────────────────────────────────────────────────────────────
export const OrcamentoPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { buscarOrcamento, salvarOrcamento, salvarOrcamentoComGuarda, addToast, atualizarEquipe, config, recalcularSecao } = useAppContext()
  const { usuario } = useAuth()

  const [orc, setOrc] = useState<Orcamento | null>(null)
  const [abaAtiva, setAbaAtiva] = useState<'orcamento' | 'evento' | 'cronograma'>('orcamento')
  const [dirty, setDirty] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [conflito, setConflito] = useState<{ servidor: string } | null>(null)
  const [filtroFornecedor, setFiltroFornecedor] = useState('')
  // Versão (atualizado_em) que este cliente tinha ao abrir — trava de concorrência.
  const baseVersion = useRef<string | null>(null)

  // Fornecedores usados neste orçamento (pro filtro interno).
  const fornecedoresDoOrc = useMemo(() => {
    if (!orc) return [] as string[]
    const secs = [orc.operacaoEstrutura, orc.equipe, orc.atracao, orc.abBebidas, orc.extras]
    const set = new Set<string>()
    for (const sec of secs) for (const it of sec)
      for (const f of (it.fornecedor || '').split('||').map(x => x.trim()).filter(Boolean)) set.add(f)
    return [...set].sort()
  }, [orc])

  // Plataformas/formas de venda dos ingressos (múltiplo).
  const plataformasChips = useMemo(() => {
    const custom = (orc?.plataformasVenda ?? []).filter(p => !PLATAFORMAS_PADRAO.includes(p))
    return [...PLATAFORMAS_PADRAO, ...custom]
  }, [orc])
  function togglePlataforma(p: string) {
    const cur = orc?.plataformasVenda ?? []
    set('plataformasVenda', cur.includes(p) ? cur.filter(x => x !== p) : [...cur, p])
  }
  function adicionarPlataforma() {
    const nova = window.prompt('Outra plataforma ou forma de venda:')?.trim()
    const cur = orc?.plataformasVenda ?? []
    if (nova && !cur.includes(nova)) set('plataformasVenda', [...cur, nova])
  }
  const [showImportModal, setShowImportModal] = useState(false)
  const [showDriveModal, setShowDriveModal] = useState(false)
  const [showEverestModal, setShowEverestModal] = useState(false)
  const [showVaziasModal, setShowVaziasModal] = useState(false)
  const [showVClienteModal, setShowVClienteModal] = useState(false)
  const [uploadingCotId, setUploadingCotId] = useState<string | null>(null)
  const cotFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!id) return
    const found = buscarOrcamento(id)
    if (found) {
      baseVersion.current = found.atualizadoEm
      const ajustado = aplicarPagoPorData(found)
      setOrc(ajustado)
      if (ajustado !== found) setDirty(true) // houve flip Contratado→Pago → auto-save persiste
    }
    else navigate('/pre-eventos/orcamentos')
  }, [id, buscarOrcamento, navigate])

  function set<K extends keyof Orcamento>(field: K, value: Orcamento[K]) {
    setOrc(prev => prev ? { ...prev, [field]: value } : prev)
    setDirty(true)
  }

  const handleConvidadosChange = useCallback((qtde: number) => {
    if (!orc) return
    const updated = atualizarEquipe({ ...orc, quantidadeConvidados: qtde }, config)
    setOrc(updated)
    setDirty(true)
  }, [orc, atualizarEquipe, config])

  const handleTipoChange = useCallback((tipo: EventType) => {
    if (!orc) return
    const updated = atualizarEquipe({ ...orc, tipo }, config)
    setOrc(updated)
    setDirty(true)
  }, [orc, atualizarEquipe, config])

  // Grava com trava de concorrência. Se outra pessoa salvou desde que abri,
  // NÃO sobrescreve — sinaliza conflito pra decidir (recarregar ou forçar).
  async function persistir(manual: boolean) {
    if (!orc) return
    const orcAutor = { ...orc, atualizadoPor: usuario?.nome ?? orc.atualizadoPor }
    const res = await salvarOrcamentoComGuarda(orcAutor, baseVersion.current)
    if (res.conflito) {
      setConflito({ servidor: res.servidor ?? '' })
      return
    }
    if (res.ok) {
      baseVersion.current = res.updated.atualizadoEm
      setOrc(prev => prev ? { ...prev, atualizadoPor: res.updated.atualizadoPor, atualizadoEm: res.updated.atualizadoEm } : prev)
      setDirty(false)
      setSalvo(true)
      if (manual) addToast('Orçamento salvo com sucesso!', 'success')
    }
  }

  function handleSave() { void persistir(true) }

  // Força a gravação por cima da versão do servidor (decisão consciente do usuário).
  function forcarSalvar() {
    if (!orc) return
    const updated = salvarOrcamento({ ...orc, atualizadoPor: usuario?.nome ?? orc.atualizadoPor }) // upsert simples, sem trava
    baseVersion.current = updated.atualizadoEm
    setOrc(prev => prev ? { ...prev, atualizadoPor: updated.atualizadoPor, atualizadoEm: updated.atualizadoEm } : prev)
    setConflito(null); setDirty(false); setSalvo(true)
    addToast('Salvo (sobrescreveu a outra versão).', 'success')
  }

  // Auto-save (tipo Sheets): grava sozinho ~1s depois da última edição. Pausa
  // enquanto houver conflito aberto (pra não ficar tentando atropelar em loop).
  useEffect(() => {
    if (!dirty || !orc || conflito) return
    const h = window.setTimeout(() => { void persistir(false) }, 1000)
    return () => window.clearTimeout(h)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, orc, conflito])

  // Tira o "Salvo ✓" da tela depois de alguns segundos.
  useEffect(() => {
    if (!salvo) return
    const h = window.setTimeout(() => setSalvo(false), 2500)
    return () => window.clearTimeout(h)
  }, [salvo])

  async function handlePDF() {
    if (!orc) return
    await exportarPDF(orc)
    addToast('PDF gerado!', 'success')
  }

  async function handlePendenciasPDF() {
    if (!orc) return
    await exportarPendenciasPDF(orc)
    addToast('Relatório de pendências gerado!', 'success')
  }

  async function handleRelatorioCliente() {
    if (!orc) return
    await exportarRelatorioCliente(orc)
    addToast('Relatório do cliente gerado!', 'success')
  }

  function handleExcel() {
    if (!orc) return
    exportarExcel(orc)
    addToast('Excel gerado!', 'success')
  }

  function handleRecalcularEquipe() {
    if (!orc) return
    const updated = atualizarEquipe(orc, config)
    setOrc(updated)
    setDirty(true)
    addToast('Equipe recalculada!', 'info')
  }

  function updateSecao(
    key: 'operacaoEstrutura' | 'equipe' | 'atracao' | 'abBebidas' | 'extras',
    items: ItemOrcamento[],
  ) {
    set(key, recalcularSecao(items))
  }

  // ─── Importar planilha ────────────────────────────────────────────────────
  function handleAplicarImportacao(
    reconhecidos: ItemImportado[],
    mapeados: { item: ItemImportado; alvoId: string }[],
    novos: { item: ItemImportado; nome: string; secao: SecaoKey }[],
  ) {
    if (!orc) return
    let updated = { ...orc }
    const aplicar = (item: ItemImportado, alvoId: string) => {
      const secao = updated[item.secao] as ItemOrcamento[]
      updated = {
        ...updated,
        [item.secao]: secao.map(i =>
          i.id === alvoId
            ? recalcularItem({ ...i, qtde: item.qtde, custoUnitario: item.custoUnitario, status: item.status, notas: item.notas || i.notas })
            : i,
        ),
      }
    }
    for (const rec of reconhecidos) if (rec.matchId) aplicar(rec, rec.matchId)
    for (const { item, alvoId } of mapeados) aplicar(item, alvoId)
    for (const { item, nome, secao } of novos) {
      const secaoItems = updated[secao] as ItemOrcamento[]
      const novoItem = recalcularItem({
        id: newItemId(),
        item: nome,
        fornecedor: '',
        qtde: item.qtde,
        custoUnitario: item.custoUnitario,
        totalOrcado: 0,
        totalPagoReal: 0,
        valorPassadoCliente: 0,
        bvAbsoluto: 0,
        bvPercentual: 0,
        status: item.status,
        dataPagamento: null,
        notas: item.notas,
        automatico: false,
        fixo: false,
      })
      updated = { ...updated, [secao]: [...secaoItems, novoItem] }
    }
    setOrc(updated)
    setDirty(true)
    setShowImportModal(false)
    setShowDriveModal(false)
    addToast(`${reconhecidos.length + mapeados.length + novos.length} itens importados!`, 'success')
  }

  function handleAplicarEverest(
    grupos: FornecedorEverest[],
    destinos: Record<string, DestinoEverest>,
  ) {
    if (!orc) return
    const nAssociados = Object.values(destinos).filter(d => d.tipo !== 'ignorar').length
    setOrc(aplicarAssociacoes(orc, grupos, destinos))
    setDirty(true)
    setShowEverestModal(false)
    addToast(`${nAssociados} custo(s) do Everest associado(s)!`, 'success')

    // Aprende o de-para (fornecedor → nome do item) das associações simples,
    // pra pré-preencher nas próximas turmas. Divididos não são memorizados.
    const pares: { fornecedor: string; itemNome: string; secao: typeof SECOES_EVEREST[number]['key'] }[] = []
    for (const g of grupos) {
      const d = destinos[g.fornecedor]
      if (!d) continue
      if (d.tipo === 'novo') pares.push({ fornecedor: g.fornecedor, itemNome: d.nome, secao: d.secao })
      else if (d.tipo === 'item' && d.itemId) {
        for (const secao of SECOES_EVEREST) {
          const it = orc[secao.key].find(i => i.id === d.itemId)
          if (it && it.item.trim()) { pares.push({ fornecedor: g.fornecedor, itemNome: it.item, secao: secao.key }); break }
        }
      }
    }
    void salvarDepara(pares)
  }

  function handleApagarVazias(novo: Orcamento, removidos: number) {
    setOrc(novo)
    setDirty(true)
    setShowVaziasModal(false)
    addToast(`${removidos} linha(s) vazia(s) removida(s)`, 'success')
  }

  function handlePreencherVCliente(novo: Orcamento) {
    setOrc(novo)
    setDirty(true)
    setShowVClienteModal(false)
    addToast('V. Cliente preenchido nos itens sem BV', 'success')
  }

  function handleAdicionarSugestao(secao: SecaoKeyEverest, item: ItemEstimado) {
    if (!orc) return
    const novoItem = criarItemDeSugestao(item)
    setOrc({ ...orc, [secao]: [...(orc[secao] as ItemOrcamento[]), novoItem] })
    setDirty(true)
    addToast(`"${item.item}" adicionado`, 'success')
  }

  function handleGerarLotes() {
    if (!orc) return
    const lotes = gerarLotesIngresso(orc)
    if (lotes.length === 0) {
      addToast('Pra gerar os lotes, preencha os Formandos (aba Info do Evento) e o A&B.', 'error')
      return
    }
    setOrc({ ...orc, receitasSympla: lotes })
    setDirty(true)
    addToast(`${lotes.length} lotes gerados pela fórmula`, 'success')
  }

  // ─── Anexar documento em Cotação ────────────────────────────────────────
  function iniciarAnexoCotacao(cotId: string) {
    setUploadingCotId(cotId)
    cotFileRef.current?.click()
  }

  async function handleFileCotacao(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !uploadingCotId || !orc) return
    if (!supabase) {
      addToast('Supabase Storage não configurado', 'error')
      setUploadingCotId(null)
      return
    }
    const cotId = uploadingCotId
    const path = `pre-eventos/cotacoes/${orc.id}/${cotId}/${file.name}`
    const { error } = await supabase.storage.from('pre-eventos').upload(path, file, { upsert: true })
    if (error) { addToast('Erro ao enviar arquivo', 'error'); setUploadingCotId(null); return }
    const { data: { publicUrl } } = supabase.storage.from('pre-eventos').getPublicUrl(path)
    const doc: DocumentoCotacao = { nome: file.name, url: publicUrl, tamanho: file.size, tipo: file.type }
    set('cotacoes', (orc.cotacoes ?? []).map(c =>
      c.id === cotId ? { ...c, documentos: [...(c.documentos ?? []), doc] } : c,
    ))
    addToast('Arquivo anexado!', 'success')
    setUploadingCotId(null)
    e.target.value = ''
  }

  const inputCls = 'w-full bg-surface border border-bordercol rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-accent transition-colors'
  const labelCls = 'block text-xs text-muted mb-1'

  // ─── Cotações helpers ───────────────────────────────────────────────────────
  const CATEGORIAS_COTACAO = ['Local', 'Bar / Drinks', 'Food', 'Decoração', 'Som / Iluminação', 'Foto / Vídeo', 'Segurança', 'Outros']

  function CotacoesSection({ cotacoes, onChange, inputCls: cls }: {
    cotacoes: Cotacao[]
    onChange: (c: Cotacao[]) => void
    inputCls: string
  }) {
    function add() {
      onChange([...cotacoes, { id: newItemId(), categoria: 'Local', fornecedor: '', valor: 0, notas: '' }])
    }
    function remove(id: string) {
      onChange(cotacoes.filter(c => c.id !== id))
    }
    function update(id: string, field: keyof Cotacao, val: string | number) {
      onChange(cotacoes.map(c => c.id === id ? { ...c, [field]: val } : c))
    }
    function removerDoc(cotId: string, docIdx: number) {
      onChange(cotacoes.map(c =>
        c.id === cotId ? { ...c, documentos: (c.documentos ?? []).filter((_, i) => i !== docIdx) } : c,
      ))
    }

    return (
      <div className="space-y-3">
        {cotacoes.length === 0 && (
          <p className="text-muted text-sm py-2">Nenhuma cotação cadastrada.</p>
        )}
        {cotacoes.map(c => (
          <div key={c.id} className="space-y-1.5">
            <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr_130px_1fr_auto_36px] gap-2 items-start">
              <select
                value={c.categoria}
                onChange={e => update(c.id, 'categoria', e.target.value)}
                className={cls}
              >
                {CATEGORIAS_COTACAO.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <input
                className={cls}
                placeholder="Fornecedor"
                value={c.fornecedor}
                onChange={e => update(c.id, 'fornecedor', e.target.value)}
              />
              <CampoMoeda
                value={c.valor}
                onChange={v => update(c.id, 'valor', v)}
                className={`${cls} text-right`}
              />
              <input
                className={cls}
                placeholder="Notas"
                value={c.notas}
                onChange={e => update(c.id, 'notas', e.target.value)}
              />
              <button
                onClick={() => iniciarAnexoCotacao(c.id)}
                title="Anexar documento"
                className={`h-[38px] flex items-center justify-center border border-dashed border-bordercol hover:border-accent/50 rounded-lg px-2 transition-colors ${uploadingCotId === c.id ? 'text-accent' : 'text-muted hover:text-accent'}`}
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <button
                onClick={() => remove(c.id)}
                className="h-[38px] flex items-center justify-center text-danger/60 hover:text-danger transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            {(c.documentos ?? []).length > 0 && (
              <div className="pl-2 flex flex-wrap gap-2">
                {c.documentos!.map((doc, di) => (
                  <div key={di} className="flex items-center gap-1 bg-surface2/60 border border-bordercol/50 rounded px-2 py-1 text-[10px]">
                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline flex items-center gap-1 max-w-[140px] truncate" title={doc.nome}>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      {doc.nome}
                    </a>
                    <button onClick={() => removerDoc(c.id, di)} className="text-muted hover:text-danger transition-colors shrink-0">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        <button
          onClick={add}
          className="flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 transition-colors mt-1"
        >
          <Plus className="w-3.5 h-3.5" /> Adicionar cotação
        </button>
        {cotacoes.length > 0 && (
          <div className="flex justify-end pt-2 border-t border-bordercol/50">
            <span className="text-xs text-muted mr-2">Total cotações:</span>
            <span className="text-sm font-semibold text-white">
              {formatBRL(cotacoes.reduce((s, c) => s + (c.valor || 0), 0))}
            </span>
          </div>
        )}
      </div>
    )
  }

  if (!orc) return (
    <div className="flex items-center justify-center h-64 text-muted">Carregando...</div>
  )

  const totalReceitas = orc.bolsaFolia + orc.receitasSympla.reduce((s, l) => s + l.total, 0)

  return (
    <div className="max-w-[1400px] mx-auto space-y-4 pb-20 md:pb-0">
      {/* Header bar — desktop only action buttons */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => navigate('/pre-eventos/orcamentos')}
          className="flex items-center gap-1 text-muted hover:text-white text-sm transition-colors min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <div className="flex-1" />
        {orc.id && <PresencaBar canal={`orcamento:${orc.id}`} usuario={usuario} />}
        {dirty ? (
          <span className="text-xs text-muted border border-bordercol/60 rounded px-2 py-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" /> Salvando…
          </span>
        ) : salvo ? (
          <span className="text-xs text-success border border-success/30 bg-success/10 rounded px-2 py-1 flex items-center gap-1">
            <Check className="w-3 h-3" /> Salvo
          </span>
        ) : orc.atualizadoPor ? (
          <span className="text-xs text-muted hidden sm:inline">Editado por {orc.atualizadoPor}</span>
        ) : null}
        <button
          onClick={() => setShowImportModal(true)}
          className="hidden md:flex items-center gap-2 border border-bordercol text-muted hover:text-white hover:bg-white/5 text-sm py-2 px-3 rounded-lg transition-colors"
        >
          <FileUp className="w-4 h-4" /> Importar
        </button>
        <button
          onClick={() => setShowDriveModal(true)}
          className="hidden md:flex items-center gap-2 border border-bordercol text-muted hover:text-white hover:bg-white/5 text-sm py-2 px-3 rounded-lg transition-colors"
        >
          <ExternalLink className="w-4 h-4" /> Drive
        </button>
        <button
          onClick={() => setShowEverestModal(true)}
          title="Associar os custos reais do Everest aos itens do orçamento"
          className="hidden md:flex items-center gap-2 border border-bordercol text-muted hover:text-white hover:bg-white/5 text-sm py-2 px-3 rounded-lg transition-colors"
        >
          <Database className="w-4 h-4" /> Everest
        </button>
        <button
          onClick={() => setShowVClienteModal(true)}
          title="Preencher V. Cliente = Pago nos itens sem BV"
          className="hidden md:flex items-center gap-2 border border-bordercol text-muted hover:text-white hover:bg-white/5 text-sm py-2 px-3 rounded-lg transition-colors"
        >
          <Wallet className="w-4 h-4" /> V. Cliente
        </button>
        <button
          onClick={() => setShowVaziasModal(true)}
          title="Apagar linhas vazias (sem fornecedor e sem valores)"
          className="hidden md:flex items-center gap-2 border border-bordercol text-muted hover:text-white hover:bg-white/5 text-sm py-2 px-3 rounded-lg transition-colors"
        >
          <Eraser className="w-4 h-4" /> Limpar
        </button>
        <button
          onClick={handlePendenciasPDF}
          title="Gerar PDF com itens ainda pendentes para enviar à produção"
          className="hidden md:flex items-center gap-2 border border-bordercol text-muted hover:text-white hover:bg-white/5 text-sm py-2 px-3 rounded-lg transition-colors"
        >
          <FileWarning className="w-4 h-4" /> Pendências
        </button>
        <button
          onClick={handlePDF}
          className="hidden md:flex items-center gap-2 border border-bordercol text-muted hover:text-white hover:bg-white/5 text-sm py-2 px-3 rounded-lg transition-colors"
        >
          <FileDown className="w-4 h-4" /> PDF
        </button>
        <button
          onClick={handleRelatorioCliente}
          title="Relatório para a turma — só o valor do cliente (sem orçado, custo ou margem)"
          className="hidden md:flex items-center gap-2 border border-bordercol text-muted hover:text-white hover:bg-white/5 text-sm py-2 px-3 rounded-lg transition-colors"
        >
          <Users className="w-4 h-4" /> Rel. Cliente
        </button>
        <button
          onClick={handleExcel}
          className="hidden md:flex items-center gap-2 border border-bordercol text-muted hover:text-white hover:bg-white/5 text-sm py-2 px-3 rounded-lg transition-colors"
        >
          <Sheet className="w-4 h-4" /> Excel
        </button>
        <button
          onClick={handleSave}
          className="hidden md:flex items-center gap-2 bg-accent hover:bg-accent/90 text-white text-sm font-semibold py-2 px-4 rounded-lg transition-colors"
        >
          <Save className="w-4 h-4" /> Salvar
        </button>
      </div>

      {/* Aviso de conflito — outra pessoa salvou este orçamento no meio */}
      {conflito && (
        <div className="bg-danger/10 border border-danger/40 rounded-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <p className="text-danger font-semibold text-sm flex items-center gap-2">
              <FileWarning className="w-4 h-4" /> Outra pessoa salvou este orçamento
            </p>
            <p className="text-xs text-muted mt-1">
              Suas alterações <b>não foram gravadas</b> pra não apagar o trabalho dela. Recarregue pra ver a versão atual, ou force a sua (sobrescreve a dela).
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => window.location.reload()} className="border border-bordercol text-white hover:bg-white/5 text-sm py-2 px-3 rounded-lg transition-colors">
              Recarregar
            </button>
            <button onClick={forcarSalvar} className="bg-danger/80 hover:bg-danger text-white text-sm font-semibold py-2 px-3 rounded-lg transition-colors">
              Forçar minha versão
            </button>
          </div>
        </div>
      )}

      {/* ── 1. Informações Gerais ── */}
      <div className="bg-surface-2 border border-bordercol rounded-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-1 h-6 bg-accent rounded-full" />
          <h2 className="text-white font-semibold">Informações Gerais</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Tipo de Evento</label>
            <select
              value={orc.tipo}
              onChange={e => handleTipoChange(e.target.value as EventType)}
              className={inputCls}
            >
              {EVENT_TYPES.map(t => (
                <option key={t} value={t}>{EVENT_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Instituição</label>
            <input
              className={inputCls}
              value={orc.instituicao}
              onChange={e => set('instituicao', e.target.value)}
              placeholder="Nome da instituição"
            />
          </div>
          <div>
            <label className={labelCls}>Turma</label>
            <input
              className={inputCls}
              value={orc.turma}
              onChange={e => set('turma', e.target.value)}
              placeholder="Ex: Medicina 2026"
            />
          </div>
          <div>
            <label className={labelCls}>Data do Evento</label>
            <input
              type="date"
              className={inputCls}
              value={orc.data}
              onChange={e => set('data', e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Quantidade de Convidados</label>
            <input
              type="number" min={0}
              className={inputCls}
              value={orc.quantidadeConvidados || ''}
              onChange={e => handleConvidadosChange(Number(e.target.value))}
            />
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <select
              value={orc.status}
              onChange={e => set('status', e.target.value as OrcamentoStatus)}
              className={inputCls}
            >
              <option value="RASCUNHO">Rascunho</option>
              <option value="EM_ANDAMENTO">Em Andamento</option>
              <option value="CONCLUIDO">Concluído</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Abas: Orçamento | Info do Evento ── */}
      <div className="flex gap-1 border-b border-bordercol">
        {([['orcamento', 'Orçamento'], ['evento', 'Info do Evento'], ['cronograma', 'Cronograma']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setAbaAtiva(k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${abaAtiva === k ? 'border-accent text-white' : 'border-transparent text-muted hover:text-white'}`}>
            {label}
          </button>
        ))}
      </div>

      {abaAtiva === 'evento' && (
        <AbaInfoEvento orc={orc} onChange={info => { setOrc({ ...orc, infoEvento: info }); setDirty(true) }} />
      )}

      {abaAtiva === 'cronograma' && <CronogramaRegua orc={orc} />}

      {abaAtiva === 'orcamento' && (<>
      {/* ── Painel de margem (planejamento: elas veem se fecha) ── */}
      <PainelMargem orc={orc} />

      {/* ── Barra de progresso ── */}
      <BarraProgressoPagamento orc={orc} />

      {/* ── 2. Receitas ── */}
      <SecaoAccordion
        title="Receitas"
        subtitle={`Total: ${formatBRL(totalReceitas)}`}
        defaultOpen
      >
        {/* Vendido via (plataformas/formas — múltiplo) */}
        <div className="flex items-center gap-2 flex-wrap mb-5">
          <span className="text-xs text-muted">Vendido via:</span>
          {plataformasChips.map(p => {
            const on = (orc.plataformasVenda ?? []).includes(p)
            return (
              <button key={p} type="button" onClick={() => togglePlataforma(p)}
                className={`text-xs border rounded-full px-2.5 py-1 transition-colors ${on ? 'bg-accent/20 text-accent border-accent/40' : 'text-muted border-bordercol hover:text-white'}`}>
                {on ? '✓ ' : ''}{p}
              </button>
            )
          })}
          <button type="button" onClick={adicionarPlataforma} className="text-xs text-accent hover:underline">+ outra</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
          <CampoComLabel
            label="Bolsa Folia (R$)"
            value={orc.bolsaFolia}
            onChange={v => set('bolsaFolia', v)}
          />
          <div className="flex items-end">
            <div className="text-xs text-muted">
              <p>Total Ingressos:</p>
              <p className="text-white font-semibold text-base">
                {formatBRL(orc.receitasSympla.reduce((s, l) => s + l.total, 0))}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-end justify-between gap-2 mb-3 flex-wrap">
          <div>
            <p className="text-xs text-muted">Lotes de Ingresso</p>
            {(() => {
              const cv = custoVariavelPorPessoa(orc)
              return cv.formandos > 0 && cv.totalAB > 0 ? (
                <p className="text-[10px] text-muted">Custo variável: <span className="text-gray-300">{formatBRL(cv.valor)}/pessoa</span> (A&B {formatBRL(cv.totalAB)} ÷ {cv.formandos} formandos)</p>
              ) : (
                <p className="text-[10px] text-muted">Pra gerar pela fórmula: preencha Formandos (aba Info do Evento) e o A&B.</p>
              )
            })()}
          </div>
          <button onClick={handleGerarLotes}
            className="flex items-center gap-1.5 text-xs text-accent hover:underline shrink-0">
            <Ticket className="w-3.5 h-3.5" /> Gerar lotes (fórmula)
          </button>
        </div>
        <TabelaLotes
          lotes={orc.receitasSympla}
          onChange={l => set('receitasSympla', l)}
          labelTotal="TOTAL INGRESSOS"
          nomeItem="Lote"
        />
      </SecaoAccordion>

      {/* Filtro de fornecedor (dentro do orçamento) */}
      {fornecedoresDoOrc.length > 0 && (
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <span className="text-muted">Filtrar por fornecedor:</span>
          <select value={filtroFornecedor} onChange={e => setFiltroFornecedor(e.target.value)}
            className="bg-surface border border-bordercol rounded px-2 py-1.5 text-white outline-none focus:border-accent max-w-[240px]">
            <option value="" className="bg-surface text-white">Todos</option>
            {fornecedoresDoOrc.map(f => <option key={f} value={f} className="bg-surface text-white">{f}</option>)}
          </select>
          {filtroFornecedor && <button onClick={() => setFiltroFornecedor('')} className="text-accent hover:underline">limpar</button>}
        </div>
      )}

      {/* ── 3. Operação / Estrutura ── */}
      <SecaoAccordion
        title="Operação / Estrutura"
        subtitle={`${orc.operacaoEstrutura.length} itens`}
      >
        <TabelaItens
          items={orc.operacaoEstrutura}
          onChange={items => updateSecao('operacaoEstrutura', items)}
          filtroFornecedor={filtroFornecedor}
        />
      </SecaoAccordion>

      {/* ── 4. Equipe ── */}
      <SecaoAccordion
        title="Equipe"
        subtitle={`${orc.equipe.length} itens — itens com badge "A" foram preenchidos automaticamente`}
      >
        <div className="flex justify-end mb-3">
          <button
            onClick={handleRecalcularEquipe}
            className="flex items-center gap-2 text-xs text-accent hover:text-accent/80 border border-accent/30 hover:border-accent/60 rounded-lg px-3 py-1.5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Recalcular automações
          </button>
        </div>
        <TabelaItens
          items={orc.equipe}
          onChange={items => updateSecao('equipe', items)}
          filtroFornecedor={filtroFornecedor}
        />
      </SecaoAccordion>

      {/* ── 5. Atração ── */}
      <SecaoAccordion title="Atração" subtitle={`${orc.atracao.length} itens`}>
        <TabelaItens
          items={orc.atracao}
          onChange={items => updateSecao('atracao', items)}
          filtroFornecedor={filtroFornecedor}
        />
      </SecaoAccordion>

      {/* ── 6. A&B ── */}
      <SecaoAccordion title="A&B — Alimentos e Bebidas" subtitle={`${orc.abBebidas.length} itens`}>
        <TabelaItens
          items={orc.abBebidas}
          onChange={items => updateSecao('abBebidas', items)}
          filtroFornecedor={filtroFornecedor}
        />
      </SecaoAccordion>

      {/* ── 7. Extras ── */}
      <SecaoAccordion title="Extras" subtitle={`${orc.extras.length} itens`}>
        <TabelaItens
          items={orc.extras}
          onChange={items => updateSecao('extras', items)}
          filtroFornecedor={filtroFornecedor}
        />
      </SecaoAccordion>

      {/* ── 8. Cotações / Orçamentos Recebidos ── */}
      <SecaoAccordion
        title="Cotações / Orçamentos Recebidos"
        subtitle={`${(orc.cotacoes ?? []).length} cotações`}
      >
        <CotacoesSection
          cotacoes={orc.cotacoes ?? []}
          onChange={cotacoes => set('cotacoes', cotacoes)}
          inputCls={inputCls}
        />
      </SecaoAccordion>

      {/* ── Resumo Financeiro ── */}
      <PainelSugestoes orc={orc} onAdicionar={handleAdicionarSugestao} />

      <ResumoFinanceiro orc={orc} />
      </>)}

      {/* Input oculto para upload de documento de cotação */}
      <input ref={cotFileRef} type="file" className="hidden" onChange={handleFileCotacao} />

      {/* Modal de importar planilha (arquivo local) */}
      {showImportModal && (
        <ModalImportarPlanilha
          orc={orc}
          onConfirmar={handleAplicarImportacao}
          onFechar={() => setShowImportModal(false)}
        />
      )}

      {/* Modal de importar do Google Drive */}
      {showDriveModal && (
        <ModalImportarDoDrive
          orc={orc}
          onConfirmar={handleAplicarImportacao}
          onFechar={() => setShowDriveModal(false)}
        />
      )}

      {/* Modal de associação de custos do Everest */}
      {showEverestModal && (
        <ModalConciliacaoEverest
          orc={orc}
          onAplicar={handleAplicarEverest}
          onFechar={() => setShowEverestModal(false)}
        />
      )}

      {/* Modal de preencher V. Cliente */}
      {showVClienteModal && (
        <ModalPreencherVCliente
          orc={orc}
          onConfirmar={handlePreencherVCliente}
          onFechar={() => setShowVClienteModal(false)}
        />
      )}

      {/* Modal de apagar linhas vazias */}
      {showVaziasModal && (
        <ModalApagarVazias
          orc={orc}
          onConfirmar={handleApagarVazias}
          onFechar={() => setShowVaziasModal(false)}
        />
      )}

      {/* Mobile sticky bottom action bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur border-t border-bordercol px-4 py-3 flex gap-2">
        <button
          onClick={handlePDF}
          className="flex-1 flex items-center justify-center gap-1.5 border border-bordercol text-muted hover:text-white text-xs py-3 rounded-lg transition-colors min-h-[44px]"
        >
          <FileDown className="w-4 h-4" /> PDF
        </button>
        <button
          onClick={handleExcel}
          className="flex-1 flex items-center justify-center gap-1.5 border border-bordercol text-muted hover:text-white text-xs py-3 rounded-lg transition-colors min-h-[44px]"
        >
          <Sheet className="w-4 h-4" /> Excel
        </button>
        <button
          onClick={handleSave}
          className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-3 rounded-lg transition-colors min-h-[44px] ${
            dirty ? 'bg-accent hover:bg-accent/90 text-white' : 'bg-accent/40 text-white/60'
          }`}
        >
          <Save className="w-4 h-4" /> Salvar
        </button>
      </div>
    </div>
  )
}
