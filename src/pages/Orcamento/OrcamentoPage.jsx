import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStorage } from '../../hooks/useStorage'
import { formatarMoeda, formatarPercentual } from '../../utils/formatters'
import { calcularTotaisItens, calcularDesvio, calcularProjetado, calcularStatusPgto } from '../../utils/calculadora'
import { NOMES_SECOES, ORDEM_SECOES } from '../../data/bancoItensDefault'
import { ChevronDown, ChevronRight, Plus, ArrowLeft, Edit2, Trash2 } from 'lucide-react'
import Btn from '../../components/UI/Btn'
import { BadgeDefCusto, BadgeStatus, BadgePgto } from '../../components/UI/Badge'
import { uuidv4 } from '../../utils/uuid'
import Modal from '../../components/UI/Modal'
import FormItem from './FormItem'

const HEADER_GRUPOS = [
  { label: 'Vendido pelo Comercial', cols: 5, cor: '#1E3A8A' },
  { label: 'Orçado', cols: 3, cor: '#92400E' },
  { label: 'Contratado', cols: 6, cor: '#14532D' },
]

export default function OrcamentoPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [projetos, setProjetos] = useStorage('projetos', [])
  const projeto = projetos.find(p => p.id === id)
  const [secoesAbertas, setSecoesAbertas] = useState(() => Object.fromEntries(ORDEM_SECOES.map(s => [s, true])))
  const [modalItem, setModalItem] = useState(null) // { secao, item? }

  if (!projeto) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: '#64748B' }}>
        <p>Projeto não encontrado.</p>
        <Btn onClick={() => navigate('/projetos')} variante="ghost" style={{ marginTop: 16 }}>Voltar</Btn>
      </div>
    )
  }

  function atualizarProjeto(updates) {
    setProjetos(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
  }

  function atualizarItem(secao, itemId, campo, valor) {
    const secoes = { ...projeto.secoes }
    secoes[secao] = secoes[secao].map(item => {
      if (item.id !== itemId) return item
      const atualizado = { ...item, [campo]: valor }
      // Recalcular totais
      atualizado.totalAtual = (atualizado.qtde || 0) * (atualizado.valorUnitarioAtual || 0)
      atualizado.valorProjetado = calcularProjetado(atualizado.valorUnitarioAtual, projeto.ipcaAm, projeto.tempoContrato)
      atualizado.totalProjetado = (atualizado.qtde || 0) * atualizado.valorProjetado
      atualizado.valorOrcado = (atualizado.qtdeOrcada || 0) * (atualizado.valorUnitarioOrcado || 0)
      atualizado.valorContratado = (atualizado.qtdeContratada || 0) * (atualizado.valorUnitarioContratado || 0)
      atualizado.pgto = calcularStatusPgto(atualizado.valorPago, atualizado.valorContratado)
      return atualizado
    })
    atualizarProjeto({ secoes })
  }

  function salvarItem(secao, dados) {
    const secoes = { ...projeto.secoes }
    if (dados.id && secoes[secao].find(i => i.id === dados.id)) {
      secoes[secao] = secoes[secao].map(i => i.id === dados.id ? { ...i, ...dados } : i)
    } else {
      const novo = { ...dados, id: uuidv4(), secao }
      novo.totalAtual = (novo.qtde || 0) * (novo.valorUnitarioAtual || 0)
      novo.valorProjetado = calcularProjetado(novo.valorUnitarioAtual, projeto.ipcaAm, projeto.tempoContrato)
      novo.totalProjetado = (novo.qtde || 0) * novo.valorProjetado
      novo.valorOrcado = (novo.qtdeOrcada || 0) * (novo.valorUnitarioOrcado || 0)
      novo.valorContratado = (novo.qtdeContratada || 0) * (novo.valorUnitarioContratado || 0)
      novo.pgto = calcularStatusPgto(novo.valorPago, novo.valorContratado)
      secoes[secao] = [...(secoes[secao] || []), novo]
    }
    atualizarProjeto({ secoes })
    setModalItem(null)
  }

  function excluirItem(secao, itemId) {
    if (!confirm('Excluir item?')) return
    const secoes = { ...projeto.secoes }
    secoes[secao] = secoes[secao].filter(i => i.id !== itemId)
    atualizarProjeto({ secoes })
  }

  // KPIs gerais
  const kpis = useMemo(() => {
    const todasSecoes = ORDEM_SECOES.flatMap(s => projeto.secoes?.[s] || [])
    const t = calcularTotaisItens(todasSecoes)
    const desvio = calcularDesvio(t.totalContratado, t.totalOrcado)
    return { ...t, desvio, custoFormando: projeto.totalAlunos > 0 ? t.totalContratado / projeto.totalAlunos : 0 }
  }, [projeto])

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{ marginBottom: 20 }}>
        <button onClick={() => navigate('/projetos')} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: 0, marginBottom: 12 }}>
          <ArrowLeft size={14} /> Voltar para Projetos
        </button>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#F1F5F9' }}>{projeto.nome || `${projeto.curso} — ${projeto.turma}`}</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748B' }}>
              {projeto.instituicao} · {projeto.curso} · Turma {projeto.turma} · {projeto.anoRealizacao}
            </p>
          </div>
          <Btn variante="ghost" onClick={() => navigate(`/dashboard/${id}`)}>Ver Dashboard</Btn>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 24 }}>
        <KPI label="ATUAL" valor={formatarMoeda(kpis.totalAtual)} cor="#2563EB" />
        <KPI label="PROJETADO" valor={formatarMoeda(kpis.totalProjetado)} cor="#7C3AED" />
        <KPI label="ORÇADO" valor={formatarMoeda(kpis.totalOrcado)} cor="#D97706" />
        <KPI label="CONTRATADO" valor={formatarMoeda(kpis.totalContratado)} cor="#16A34A" />
        <KPI
          label="DESVIO"
          valor={formatarPercentual(kpis.desvio)}
          cor={kpis.desvio >= 0 ? '#16A34A' : '#DC2626'}
          valorStyle={{ color: kpis.desvio >= 0 ? '#22C55E' : '#EF4444' }}
        />
        <KPI label="CUSTO/FORMANDO" valor={formatarMoeda(kpis.custoFormando)} cor="#0891B2" />
      </div>

      {/* Seções */}
      {ORDEM_SECOES.map(secao => {
        const itens = projeto.secoes?.[secao] || []
        const totais = calcularTotaisItens(itens)
        const aberta = secoesAbertas[secao] !== false
        const desvioSecao = calcularDesvio(totais.totalContratado, totais.totalOrcado)

        return (
          <div key={secao} style={{ marginBottom: 12, background: '#1A1D2E', border: '1px solid #2E3150', borderRadius: 10, overflow: 'hidden' }}>
            {/* Cabeçalho da seção */}
            <button
              onClick={() => setSecoesAbertas(prev => ({ ...prev, [secao]: !aberta }))}
              style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: aberta ? '1px solid #2E3150' : 'none' }}
            >
              {aberta ? <ChevronDown size={16} style={{ color: '#64748B' }} /> : <ChevronRight size={16} style={{ color: '#64748B' }} />}
              <span style={{ fontWeight: 600, fontSize: 14, color: '#F1F5F9' }}>{secao} — {NOMES_SECOES[secao]}</span>
              <span style={{ fontSize: 11, color: '#64748B', background: '#0F1117', padding: '2px 8px', borderRadius: 10 }}>{itens.length} itens</span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 20, fontSize: 12 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#64748B', fontSize: 10 }}>ORÇADO</div>
                  <div style={{ color: '#F1F5F9', fontWeight: 600 }}>{formatarMoeda(totais.totalOrcado)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#64748B', fontSize: 10 }}>CONTRATADO</div>
                  <div style={{ color: '#F1F5F9', fontWeight: 600 }}>{formatarMoeda(totais.totalContratado)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#64748B', fontSize: 10 }}>DESVIO</div>
                  <div style={{ color: desvioSecao >= 0 ? '#22C55E' : '#EF4444', fontWeight: 600 }}>{formatarPercentual(desvioSecao)}</div>
                </div>
              </div>
            </button>

            {/* Tabela */}
            {aberta && (
              <div style={{ overflowX: 'auto' }}>
                <table className="tabela-orcamento" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
                  <thead>
                    <tr>
                      <th colSpan={7} style={{ background: '#1A1D2E', borderBottom: '1px solid #2E3150', textAlign: 'left', padding: '6px 12px', fontSize: 11, color: '#64748B' }}>IDENTIFICAÇÃO</th>
                      {HEADER_GRUPOS.map(g => (
                        <th key={g.label} colSpan={g.cols} style={{ background: g.cor, color: '#fff', textAlign: 'center', padding: '6px 12px', fontSize: 11, borderLeft: '2px solid rgba(255,255,255,0.2)' }}>
                          {g.label}
                        </th>
                      ))}
                      <th style={{ background: '#1A1D2E', padding: '6px 12px', fontSize: 11, color: '#64748B', borderLeft: '1px solid #2E3150' }}>AÇÕES</th>
                    </tr>
                    <tr style={{ background: '#F1F5F9' }}>
                      <th>Cód.</th>
                      <th>Área</th>
                      <th>MoSCoW</th>
                      <th>Def. Custo</th>
                      <th>Sub Cat.</th>
                      <th style={{ minWidth: 200 }}>Item</th>
                      <th>Fornecedor</th>
                      {/* Vendido */}
                      <th className="valor" style={{ borderLeft: '2px solid #BFDBFE' }}>Qtde</th>
                      <th className="valor">$ Unit. Atual</th>
                      <th className="valor">Total Atual</th>
                      <th className="valor">$ Projetado</th>
                      <th className="valor">Total Proj.</th>
                      {/* Orçado */}
                      <th className="valor" style={{ borderLeft: '2px solid #FEF3C7' }}>Qtde Orç.</th>
                      <th className="valor">Vlr. Unit.</th>
                      <th className="valor">Val. Orçado</th>
                      {/* Contratado */}
                      <th className="valor" style={{ borderLeft: '2px solid #BBF7D0' }}>Qtde Contr.</th>
                      <th className="valor">Vlr. Unit.</th>
                      <th className="valor">Val. Contr.</th>
                      <th className="valor">Valor Pago</th>
                      <th>Responsável</th>
                      <th>Status</th>
                      <th>Pgto</th>
                      <th style={{ borderLeft: '1px solid #E2E8F0' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    <TabelaItens
                      itens={itens}
                      secao={secao}
                      onAtualizarItem={atualizarItem}
                      onEditar={(item) => setModalItem({ secao, item })}
                      onExcluir={(itemId) => excluirItem(secao, itemId)}
                    />
                    {itens.length === 0 && (
                      <tr>
                        <td colSpan={24} style={{ textAlign: 'center', padding: '20px', color: '#94A3B8', fontSize: 13 }}>
                          Nenhum item nesta seção
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <div style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #E2E8F0' }}>
                  <button
                    onClick={() => setModalItem({ secao, item: null })}
                    style={{ background: 'none', border: '1px dashed #CBD5E1', borderRadius: 6, padding: '6px 14px', color: '#64748B', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <Plus size={12} /> Adicionar Item
                  </button>
                  <div style={{ fontSize: 12, color: '#475569', display: 'flex', gap: 20 }}>
                    <span>Total Atual: <strong>{formatarMoeda(totais.totalAtual)}</strong></span>
                    <span>Orçado: <strong>{formatarMoeda(totais.totalOrcado)}</strong></span>
                    <span>Contratado: <strong>{formatarMoeda(totais.totalContratado)}</strong></span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Modal item */}
      {modalItem && (
        <Modal
          titulo={modalItem.item ? 'Editar Item' : 'Novo Item'}
          onClose={() => setModalItem(null)}
          largura={680}
        >
          <FormItem
            item={modalItem.item}
            secao={modalItem.secao}
            projeto={projeto}
            onSalvar={(dados) => salvarItem(modalItem.secao, dados)}
            onCancelar={() => setModalItem(null)}
          />
        </Modal>
      )}
    </div>
  )
}

function KPI({ label, valor, cor, valorStyle = {} }) {
  return (
    <div style={{ background: '#1A1D2E', border: '1px solid #2E3150', borderRadius: 8, padding: '12px 14px', borderTop: `3px solid ${cor}` }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: '#64748B', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9', ...valorStyle }}>{valor}</div>
    </div>
  )
}

function TabelaItens({ itens, secao, onAtualizarItem, onEditar, onExcluir }) {
  // Agrupar por subCategoria para inserir separadores
  let subCatAtual = null
  const linhas = []

  for (const item of itens) {
    if (item.subCategoria !== subCatAtual) {
      subCatAtual = item.subCategoria
      if (subCatAtual) {
        linhas.push({ tipo: 'separador', label: subCatAtual, id: `sep-${subCatAtual}` })
      }
    }
    linhas.push({ tipo: 'item', item })
  }

  return (
    <>
      {linhas.map(linha => {
        if (linha.tipo === 'separador') {
          return (
            <tr key={linha.id} className="separador-area">
              <td colSpan={24} style={{ paddingLeft: 12 }}>{linha.label}</td>
            </tr>
          )
        }

        const item = linha.item
        const statusClass = {
          'Fechado': 'status-fechado',
          'Estimado': 'status-estimado',
          'Orçando': 'status-orcando',
          'Em aberto': 'status-aberto',
        }[item.status] || ''

        return (
          <LinhaItem
            key={item.id}
            item={item}
            statusClass={statusClass}
            onAtualizar={(campo, valor) => onAtualizarItem(secao, item.id, campo, valor)}
            onEditar={() => onEditar(item)}
            onExcluir={() => onExcluir(item.id)}
          />
        )
      })}
    </>
  )
}

function LinhaItem({ item, statusClass, onAtualizar, onEditar, onExcluir }) {
  const isNeg = (v) => Number(v) < 0

  return (
    <tr className={statusClass}>
      <td style={{ fontSize: 11, color: '#64748B' }}>{item.codigo || '—'}</td>
      <td style={{ fontSize: 11 }}>{item.area || '—'}</td>
      <td style={{ fontSize: 11, textAlign: 'center' }}>{item.moscow || '—'}</td>
      <td><BadgeDefCusto tipo={item.defCusto} /></td>
      <td style={{ fontSize: 11 }}>{item.subCategoria || '—'}</td>
      <td style={{ minWidth: 200, maxWidth: 280, fontWeight: 500 }}>{item.item || '—'}</td>
      <td style={{ fontSize: 11, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.fornecedor || '—'}</td>

      {/* Vendido */}
      <CelulaEditavel valor={item.qtde} tipo="number" onChange={v => onAtualizar('qtde', Number(v))} style={{ borderLeft: '2px solid #BFDBFE' }} />
      <CelulaEditavel valor={item.valorUnitarioAtual} tipo="number" moeda onChange={v => onAtualizar('valorUnitarioAtual', Number(v))} />
      <CelulaMoeda valor={item.totalAtual} />
      <CelulaMoeda valor={item.valorProjetado} />
      <CelulaMoeda valor={item.totalProjetado} />

      {/* Orçado */}
      <CelulaEditavel valor={item.qtdeOrcada} tipo="number" onChange={v => onAtualizar('qtdeOrcada', Number(v))} style={{ borderLeft: '2px solid #FEF3C7' }} />
      <CelulaEditavel valor={item.valorUnitarioOrcado} tipo="number" moeda onChange={v => onAtualizar('valorUnitarioOrcado', Number(v))} />
      <CelulaMoeda valor={item.valorOrcado} />

      {/* Contratado */}
      <CelulaEditavel valor={item.qtdeContratada} tipo="number" onChange={v => onAtualizar('qtdeContratada', Number(v))} style={{ borderLeft: '2px solid #BBF7D0' }} />
      <CelulaEditavel valor={item.valorUnitarioContratado} tipo="number" moeda onChange={v => onAtualizar('valorUnitarioContratado', Number(v))} />
      <CelulaMoeda valor={item.valorContratado} />
      <CelulaEditavel valor={item.valorPago} tipo="number" moeda onChange={v => onAtualizar('valorPago', Number(v))} />
      <CelulaEditavel valor={item.responsavel} tipo="text" onChange={v => onAtualizar('responsavel', v)} />
      <CelulaStatus valor={item.status} onChange={v => onAtualizar('status', v)} />
      <td><BadgePgto status={item.pgto} /></td>

      <td style={{ borderLeft: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>
        <button onClick={onEditar} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: '#94A3B8' }}>
          <Edit2 size={12} />
        </button>
        <button onClick={onExcluir} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: '#EF4444' }}>
          <Trash2 size={12} />
        </button>
      </td>
    </tr>
  )
}

function CelulaMoeda({ valor }) {
  const n = Number(valor) || 0
  return (
    <td className="valor" style={{ color: n < 0 ? '#DC2626' : undefined }}>
      {formatarMoeda(n)}
    </td>
  )
}

function CelulaEditavel({ valor, tipo, moeda, onChange, style = {} }) {
  const [editando, setEditando] = useState(false)
  const [temp, setTemp] = useState('')

  function iniciarEdicao() {
    setTemp(String(valor ?? ''))
    setEditando(true)
  }

  function confirmar() {
    onChange?.(temp)
    setEditando(false)
  }

  if (editando) {
    return (
      <td className={moeda ? 'valor' : ''} style={style}>
        <input
          autoFocus
          type={tipo}
          value={temp}
          onChange={e => setTemp(e.target.value)}
          onBlur={confirmar}
          onKeyDown={e => { if (e.key === 'Enter') confirmar(); if (e.key === 'Escape') setEditando(false) }}
          style={{ width: moeda ? 100 : tipo === 'number' ? 60 : 120, padding: '2px 4px', border: '1px solid #3B82F6', borderRadius: 3, fontSize: 11, fontFamily: 'Inter, sans-serif', background: '#EFF6FF' }}
        />
      </td>
    )
  }

  const n = Number(valor)
  const display = moeda ? formatarMoeda(n) : (tipo === 'number' ? (n || 0) : (valor || '—'))

  return (
    <td
      className={moeda ? 'valor' : ''}
      onClick={iniciarEdicao}
      style={{ cursor: 'pointer', ...style, color: n < 0 && moeda ? '#DC2626' : undefined }}
      title="Clique para editar"
    >
      {display}
    </td>
  )
}

function CelulaStatus({ valor, onChange }) {
  const [editando, setEditando] = useState(false)
  const STATUS = ['Em aberto', 'Orçando', 'Estimado', 'Fechado']

  if (editando) {
    return (
      <td>
        <select
          autoFocus
          value={valor}
          onChange={e => { onChange(e.target.value); setEditando(false) }}
          onBlur={() => setEditando(false)}
          style={{ fontSize: 11, fontFamily: 'Inter, sans-serif', border: '1px solid #3B82F6', borderRadius: 3, padding: '2px 4px', background: '#EFF6FF' }}
        >
          {STATUS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </td>
    )
  }

  return (
    <td onClick={() => setEditando(true)} style={{ cursor: 'pointer' }} title="Clique para editar">
      <BadgeStatus status={valor} />
    </td>
  )
}
