import React, { useRef, useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Save, FileDown, Sheet, ArrowLeft, Plus, Trash2, RefreshCw, Paperclip, FileUp, X, ExternalLink } from 'lucide-react'
import { useAppContext } from '../../contexts/AppContext'
import { EVENT_TYPE_LABELS, EVENT_TYPES } from '../../data/defaults'
import { formatBRL, newItemId } from '../../utils/formatters'
import TabelaItens from '../../components/Orcamento/TabelaItens'
import { ResumoFinanceiro } from '../../components/Orcamento/ResumoFinanceiro'
import { SecaoAccordion } from '../../components/Orcamento/SecaoAccordion'
import { exportarPDF } from '../../utils/exportPDF'
import { exportarExcel } from '../../utils/exportExcel'
import CampoMoeda from '../../components/UI/CampoMoeda'
import { ModalImportarPlanilha } from '../../components/Orcamento/ModalImportarPlanilha'
import { ModalImportarDoDrive } from '../../components/Orcamento/ModalImportarDoDrive'
import { supabase } from '../../lib/supabase'
import { recalcularItem } from '../../utils/automacoes'
import type { Orcamento, EventType, OrcamentoStatus, SymplaLote, ItemOrcamento, Cotacao, DocumentoCotacao } from '../../types'
import type { ItemImportado, SecaoKey } from '../../utils/importarPlanilha'

// ─── Ordinal helper ────────────────────────────────────────────────────────────
const ORDINALS = ['1º','2º','3º','4º','5º','6º','7º','8º','9º','10º']
function ordinal(n: number): string {
  return ORDINALS[n - 1] ?? `${n}º`
}

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

// ─── Sympla Lotes ─────────────────────────────────────────────────────────────
const LotesSympla: React.FC<{
  lotes: SymplaLote[]
  onChange: (lotes: SymplaLote[]) => void
}> = ({ lotes, onChange }) => {
  function addLote() {
    const n = lotes.length + 1
    onChange([...lotes, { id: newItemId(), nome: `${ordinal(n)} Lote`, qtde: 0, valorUnitario: 0, total: 0 }])
  }
  function removeLote(id: string) {
    onChange(lotes.filter(l => l.id !== id))
  }
  function updateLote(id: string, field: keyof SymplaLote, val: string | number) {
    onChange(lotes.map(l => {
      if (l.id !== id) return l
      const updated = { ...l, [field]: val }
      updated.total = updated.qtde * updated.valorUnitario
      return updated
    }))
  }

  const total = lotes.reduce((s, l) => s + l.total, 0)

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[460px]">
          <thead>
            <tr className="bg-surface2/50">
              <th className="text-left text-muted px-2 py-2 font-medium">Nome do Lote</th>
              <th className="text-right text-muted px-2 py-2 font-medium w-20">Qtde</th>
              <th className="text-right text-muted px-2 py-2 font-medium w-32">Valor Unit.</th>
              <th className="text-right text-muted px-2 py-2 font-medium w-28">Total</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {lotes.map(l => (
              <tr key={l.id} className="border-b border-bordercol/50">
                <td className="px-2 py-1.5">
                  <input
                    className="w-full bg-transparent text-white text-xs outline-none border border-transparent hover:border-bordercol focus:border-accent rounded px-1 py-0.5 transition-colors"
                    value={l.nome}
                    onChange={e => updateLote(l.id, 'nome', e.target.value)}
                    placeholder="Ex: 1º Lote"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="number" min={0}
                    className="w-full bg-transparent text-white text-xs text-right outline-none border border-transparent hover:border-bordercol focus:border-accent rounded px-1 py-0.5 transition-colors"
                    value={l.qtde || ''}
                    onChange={e => updateLote(l.id, 'qtde', Number(e.target.value))}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <CampoMoeda
                    value={l.valorUnitario}
                    onChange={v => updateLote(l.id, 'valorUnitario', v)}
                    className="w-full bg-transparent text-white text-xs text-right outline-none border border-transparent hover:border-bordercol focus:border-accent rounded px-1 py-0.5 transition-colors"
                  />
                </td>
                <td className="px-2 py-1.5 text-right text-gray-300">{formatBRL(l.total)}</td>
                <td className="px-2 py-1.5 text-center">
                  <button
                    onClick={() => removeLote(l.id)}
                    className="text-danger/60 hover:text-danger transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-surface2/80">
              <td colSpan={3} className="px-2 py-2 text-xs text-right text-muted font-semibold">TOTAL SYMPLA</td>
              <td className="px-2 py-2 text-xs text-right text-white font-bold">{formatBRL(total)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <button
        onClick={addLote}
        className="mt-3 flex items-center gap-2 text-accent text-xs hover:text-accent/80 transition-colors"
      >
        <Plus className="w-4 h-4" /> Adicionar lote
      </button>
    </div>
  )
}

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

// ─── Main Page ────────────────────────────────────────────────────────────────
export const OrcamentoPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { buscarOrcamento, salvarOrcamento, addToast, atualizarEquipe, config, recalcularSecao } = useAppContext()

  const [orc, setOrc] = useState<Orcamento | null>(null)
  const [dirty, setDirty] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showDriveModal, setShowDriveModal] = useState(false)
  const [uploadingCotId, setUploadingCotId] = useState<string | null>(null)
  const cotFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!id) return
    const found = buscarOrcamento(id)
    if (found) setOrc(found)
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

  function handleSave() {
    if (!orc) return
    salvarOrcamento(orc)
    setDirty(false)
    addToast('Orçamento salvo com sucesso!', 'success')
  }

  function handlePDF() {
    if (!orc) return
    exportarPDF(orc)
    addToast('PDF gerado!', 'success')
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
        {dirty && (
          <span className="text-xs text-warning border border-warning/30 bg-warning/10 rounded px-2 py-1">
            Não salvo
          </span>
        )}
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
          onClick={handlePDF}
          className="hidden md:flex items-center gap-2 border border-bordercol text-muted hover:text-white hover:bg-white/5 text-sm py-2 px-3 rounded-lg transition-colors"
        >
          <FileDown className="w-4 h-4" /> PDF
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

      {/* ── Barra de progresso ── */}
      <BarraProgressoPagamento orc={orc} />

      {/* ── 2. Receitas ── */}
      <SecaoAccordion
        title="Receitas"
        subtitle={`Total: ${formatBRL(totalReceitas)}`}
        defaultOpen
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
          <CampoComLabel
            label="Bolsa Folia (R$)"
            value={orc.bolsaFolia}
            onChange={v => set('bolsaFolia', v)}
          />
          <div className="flex items-end">
            <div className="text-xs text-muted">
              <p>Total Sympla:</p>
              <p className="text-white font-semibold text-base">
                {formatBRL(orc.receitasSympla.reduce((s, l) => s + l.total, 0))}
              </p>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted mb-3">Lotes Sympla</p>
        <LotesSympla
          lotes={orc.receitasSympla}
          onChange={l => set('receitasSympla', l)}
        />
      </SecaoAccordion>

      {/* ── 3. Operação / Estrutura ── */}
      <SecaoAccordion
        title="Operação / Estrutura"
        subtitle={`${orc.operacaoEstrutura.length} itens`}
      >
        <TabelaItens
          items={orc.operacaoEstrutura}
          onChange={items => updateSecao('operacaoEstrutura', items)}
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
        />
      </SecaoAccordion>

      {/* ── 5. Atração ── */}
      <SecaoAccordion title="Atração" subtitle={`${orc.atracao.length} itens`}>
        <TabelaItens
          items={orc.atracao}
          onChange={items => updateSecao('atracao', items)}
        />
      </SecaoAccordion>

      {/* ── 6. A&B ── */}
      <SecaoAccordion title="A&B — Alimentos e Bebidas" subtitle={`${orc.abBebidas.length} itens`}>
        <TabelaItens
          items={orc.abBebidas}
          onChange={items => updateSecao('abBebidas', items)}
        />
      </SecaoAccordion>

      {/* ── 7. Extras ── */}
      <SecaoAccordion title="Extras" subtitle={`${orc.extras.length} itens`}>
        <TabelaItens
          items={orc.extras}
          onChange={items => updateSecao('extras', items)}
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
      <ResumoFinanceiro orc={orc} />

      {/* Floating save — desktop only */}
      {dirty && (
        <div className="hidden md:flex fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 bg-accent hover:bg-accent/90 text-white font-semibold py-3 px-6 rounded-full shadow-lg transition-colors text-sm"
          >
            <Save className="w-4 h-4" /> Salvar alterações
          </button>
        </div>
      )}

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
