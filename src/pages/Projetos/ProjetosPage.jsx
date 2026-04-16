import { useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProjetos, mapearProjetoDoDB } from '../../hooks/useProjetos'
import { Plus, Upload, Search, X, ChevronDown, ChevronRight, BarChart2, FileText, Edit, Copy, Trash2, RefreshCw, Loader } from 'lucide-react'
import Btn from '../../components/UI/Btn'
import { BadgeTipoEnsino } from '../../components/UI/Badge'
import { importarXLSX } from '../../utils/importador'
import { supabase } from '../../lib/supabase'
import Modal from '../../components/UI/Modal'
import FormProjeto from './FormProjeto'
import ImportProgress from './ImportProgress'

export default function ProjetosPage() {
  const navigate = useNavigate()
  const { projetos: projetosRaw, carregando, criarProjeto, atualizarProjeto, excluirProjeto, duplicarProjeto } = useProjetos()
  const projetos = useMemo(() => projetosRaw.map(mapearProjetoDoDB), [projetosRaw])

  const [busca, setBusca] = useState('')
  const [filtroInst, setFiltroInst] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroAno, setFiltroAno] = useState('')
  const [secoesAbertas, setSecoesAbertas] = useState({})
  const [modalNovo, setModalNovo] = useState(false)
  const [projetoEditando, setProjetoEditando] = useState(null)
  const [importProgress, setImportProgress] = useState(null)
  const [importResultado, setImportResultado] = useState(null)
  const fileInputRef = useRef()
  const fileInputUpdateRef = useRef()
  const [projetoParaAtualizar, setProjetoParaAtualizar] = useState(null)
  const [salvando, setSalvando] = useState(false)

  const instituicoes = useMemo(() => [...new Set(projetos.map(p => p.instituicao).filter(Boolean))].sort(), [projetos])
  const anos = useMemo(() => [...new Set(projetos.map(p => p.anoRealizacao).filter(Boolean))].sort().reverse(), [projetos])

  const projetosFiltrados = useMemo(() => projetos.filter(p => {
    const q = busca.toLowerCase()
    if (q && !`${p.nome} ${p.instituicao} ${p.curso} ${p.turma}`.toLowerCase().includes(q)) return false
    if (filtroInst && p.instituicao !== filtroInst) return false
    if (filtroTipo && p.tipoEnsino !== filtroTipo) return false
    if (filtroAno && p.anoRealizacao !== filtroAno) return false
    return true
  }), [projetos, busca, filtroInst, filtroTipo, filtroAno])

  const porAno = useMemo(() => {
    const grupos = {}
    for (const p of projetosFiltrados) {
      const ano = p.anoRealizacao || 'Sem ano'
      if (!grupos[ano]) grupos[ano] = []
      grupos[ano].push(p)
    }
    return Object.entries(grupos).sort(([a], [b]) => b.localeCompare(a))
  }, [projetosFiltrados])

  function toggleAno(ano) { setSecoesAbertas(prev => ({ ...prev, [ano]: !prev[ano] })) }

  async function salvarProjeto(dados) {
    setSalvando(true)
    try {
      if (projetoEditando) {
        await atualizarProjeto(projetoEditando.id, dados)
      } else {
        await criarProjeto(dados)
      }
    } finally {
      setSalvando(false)
      setModalNovo(false)
      setProjetoEditando(null)
    }
  }

  async function handleExcluir(id) {
    if (!confirm('Confirmar exclusão do projeto?')) return
    await excluirProjeto(id)
  }

  async function handleDuplicar(projeto) {
    await duplicarProjeto(projetosRaw.find(p => p.id === projeto.id))
  }

  async function importarNovoProjeto(e) {
    const arquivo = e.target.files?.[0]
    if (!arquivo) return
    e.target.value = ''
    const mensagens = []
    setImportProgress({ mensagens: [], concluido: false })
    try {
      const resultado = await importarXLSX(arquivo, (msg) => {
        mensagens.push(msg)
        setImportProgress({ mensagens: [...mensagens], concluido: false })
      })
      const { tap, secoes } = resultado
      const nomeProjeto = tap.curso ? `${tap.curso} — ${tap.turma || tap.anoRealizacao || ''}` : arquivo.name.replace('.xlsx', '')
      const novoProjeto = await criarProjeto({
        nome: nomeProjeto, tipoEnsino: tap.tipoEnsino || 'Superior',
        instituicao: tap.instituicao || '', curso: tap.curso || '',
        turma: tap.turma || '', anoOrcamento: String(tap.anoOrcamento || new Date().getFullYear()),
        anoRealizacao: String(tap.anoRealizacao || new Date().getFullYear()),
        semestre: tap.semestre || '1', modeloContrato: tap.modeloContrato || 'Produção',
        totalAlunos: tap.totalAlunos || 0, ipcaAm: tap.ipcaAm || 0.0055,
        tempoContrato: tap.tempoContrato || 24, tempoFesta: tap.tempoFesta || 6,
      })
      for (const [secao, itens] of Object.entries(secoes)) {
        if (itens.length > 0) {
          const rows = itens.map(({ id, ...i }) => ({
            projeto_id: novoProjeto.id, secao,
            codigo: i.codigo, area: i.area, moscow: i.moscow, def_custo: i.defCusto,
            sub_categoria: i.subCategoria, item: i.item, fornecedor: i.fornecedor,
            qtde: i.qtde || 0, valor_unitario_atual: i.valorUnitarioAtual || 0,
            total_atual: i.totalAtual || 0, valor_projetado: i.valorProjetado || 0,
            total_projetado: i.totalProjetado || 0, qtde_orcada: i.qtdeOrcada || 0,
            valor_unitario_orcado: i.valorUnitarioOrcado || 0, valor_orcado: i.valorOrcado || 0,
            qtde_contratada: i.qtdeContratada || 0, valor_unitario_contratado: i.valorUnitarioContratado || 0,
            valor_contratado: i.valorContratado || 0, responsavel: i.responsavel,
            status: i.status || 'Em aberto', valor_pago: i.valorPago || 0, falta_pagar: i.faltaPagar || 0,
          }))
          await supabase.from('po_itens').insert(rows)
        }
      }
      setImportProgress({ mensagens: [...mensagens, 'Concluído!'], concluido: true })
      setImportResultado(resultado)
    } catch (err) {
      setImportProgress({ mensagens: [...mensagens, `Erro: ${err.message}`], concluido: true, erro: true })
    }
  }

  async function atualizarPO(e) {
    const arquivo = e.target.files?.[0]
    if (!arquivo || !projetoParaAtualizar) return
    e.target.value = ''
    const mensagens = []
    setImportProgress({ mensagens: [], concluido: false })
    try {
      const resultado = await importarXLSX(arquivo, (msg) => {
        mensagens.push(msg)
        setImportProgress({ mensagens: [...mensagens], concluido: false })
      })
      const { data: itensAntigos } = await supabase.from('po_itens').select('codigo, item, valor_pago').eq('projeto_id', projetoParaAtualizar.id)
      const mapaValorPago = {}
      for (const i of (itensAntigos || [])) mapaValorPago[`${i.codigo}|${i.item}`] = i.valor_pago
      for (const [secao, itens] of Object.entries(resultado.secoes)) {
        await supabase.from('po_itens').delete().eq('projeto_id', projetoParaAtualizar.id).eq('secao', secao)
        if (itens.length > 0) {
          const rows = itens.map(({ id, ...i }) => ({
            projeto_id: projetoParaAtualizar.id, secao,
            codigo: i.codigo, area: i.area, moscow: i.moscow, def_custo: i.defCusto,
            sub_categoria: i.subCategoria, item: i.item, fornecedor: i.fornecedor,
            qtde: i.qtde || 0, valor_unitario_atual: i.valorUnitarioAtual || 0,
            total_atual: i.totalAtual || 0, valor_projetado: i.valorProjetado || 0,
            total_projetado: i.totalProjetado || 0, qtde_orcada: i.qtdeOrcada || 0,
            valor_unitario_orcado: i.valorUnitarioOrcado || 0, valor_orcado: i.valorOrcado || 0,
            qtde_contratada: i.qtdeContratada || 0, valor_unitario_contratado: i.valorUnitarioContratado || 0,
            valor_contratado: i.valorContratado || 0, responsavel: i.responsavel,
            status: i.status || 'Em aberto',
            valor_pago: mapaValorPago[`${i.codigo}|${i.item}`] ?? (i.valorPago || 0),
            falta_pagar: i.faltaPagar || 0,
          }))
          await supabase.from('po_itens').insert(rows)
        }
      }
      setImportProgress({ mensagens: [...mensagens, 'P.O. atualizado!'], concluido: true })
      setImportResultado(resultado)
    } catch (err) {
      setImportProgress({ mensagens: [...mensagens, `Erro: ${err.message}`], concluido: true, erro: true })
    }
    setProjetoParaAtualizar(null)
  }

  const limparFiltros = () => { setBusca(''); setFiltroInst(''); setFiltroTipo(''); setFiltroAno('') }
  const temFiltros = busca || filtroInst || filtroTipo || filtroAno

  if (carregando) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 12, color: '#64748B' }}>
      <Loader size={20} /> Carregando projetos...
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#F1F5F9' }}>
            Projetos
            <span style={{ marginLeft: 10, fontSize: 14, fontWeight: 500, color: '#64748B', background: '#1A1D2E', border: '1px solid #2E3150', borderRadius: 20, padding: '2px 10px' }}>{projetos.length}</span>
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748B' }}>Gestão de orçamentos de bailes de formatura</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variante="ghost" onClick={() => fileInputRef.current?.click()}><Upload size={14} /> Importar P.O.</Btn>
          <Btn onClick={() => { setProjetoEditando(null); setModalNovo(true) }}><Plus size={14} /> Novo Projeto</Btn>
        </div>
      </div>

      <div style={{ background: '#1A1D2E', border: '1px solid #2E3150', borderRadius: 10, padding: '14px 16px', marginBottom: 20, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar nome, instituição, curso, turma..." style={{ background: '#0F1117', border: '1px solid #2E3150', borderRadius: 6, padding: '8px 10px 8px 32px', color: '#F1F5F9', fontSize: 13, width: '100%', outline: 'none', fontFamily: 'Inter, sans-serif' }} />
        </div>
        <select value={filtroInst} onChange={e => setFiltroInst(e.target.value)} style={selectStyle}>
          <option value="">Todas as instituições</option>
          {instituicoes.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={selectStyle}>
          <option value="">Tipo de Ensino</option>
          {['Fundamental', 'Médio', 'Superior'].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filtroAno} onChange={e => setFiltroAno(e.target.value)} style={selectStyle}>
          <option value="">Todos os anos</option>
          {anos.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        {temFiltros && <Btn variante="ghost" pequeno onClick={limparFiltros}><X size={12} /> Limpar</Btn>}
        <span style={{ fontSize: 12, color: '#64748B', whiteSpace: 'nowrap' }}>Exibindo {projetosFiltrados.length} de {projetos.length}</span>
      </div>

      {porAno.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748B' }}>
          <p style={{ fontSize: 15 }}>Nenhum projeto encontrado</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>Crie um novo projeto ou importe um arquivo P.O.</p>
        </div>
      ) : porAno.map(([ano, lista]) => {
        const aberto = secoesAbertas[ano] !== false
        return (
          <div key={ano} style={{ marginBottom: 20 }}>
            <button onClick={() => toggleAno(ano)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0', color: '#F1F5F9', fontSize: 15, fontWeight: 700, width: '100%' }}>
              {aberto ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              <span style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{ano}</span>
              <span style={{ fontSize: 12, color: '#64748B', fontWeight: 400 }}>— {lista.length} projeto{lista.length !== 1 ? 's' : ''}</span>
            </button>
            {aberto && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14, marginTop: 10 }}>
                {lista.map(p => (
                  <CardProjeto key={p.id} projeto={p}
                    onOrcamento={() => navigate(`/orcamento/${p.id}`)}
                    onDashboard={() => navigate(`/dashboard/${p.id}`)}
                    onEditar={() => { setProjetoEditando(p); setModalNovo(true) }}
                    onAtualizar={() => { setProjetoParaAtualizar(p); fileInputUpdateRef.current?.click() }}
                    onDuplicar={() => handleDuplicar(p)}
                    onExcluir={() => handleExcluir(p.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}

      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={importarNovoProjeto} />
      <input ref={fileInputUpdateRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={atualizarPO} />

      {modalNovo && (
        <Modal titulo={projetoEditando ? 'Editar Projeto' : 'Novo Projeto'} onClose={() => { setModalNovo(false); setProjetoEditando(null) }} largura={700}>
          <FormProjeto projeto={projetoEditando} onSalvar={salvarProjeto} onCancelar={() => { setModalNovo(false); setProjetoEditando(null) }} salvando={salvando} />
        </Modal>
      )}
      {importProgress && (
        <Modal titulo="Importando P.O." onClose={importProgress.concluido ? () => { setImportProgress(null); setImportResultado(null) } : undefined} largura={500}>
          <ImportProgress progresso={importProgress} resultado={importResultado} onFechar={() => { setImportProgress(null); setImportResultado(null) }} />
        </Modal>
      )}
    </div>
  )
}

function CardProjeto({ projeto: p, onOrcamento, onDashboard, onEditar, onAtualizar, onDuplicar, onExcluir }) {
  return (
    <div style={{ background: '#1A1D2E', border: '1px solid #2E3150', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#F1F5F9', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nome || `${p.curso} — ${p.turma}`}</div>
          <div style={{ fontSize: 12, color: '#94A3B8' }}>{p.instituicao}</div>
        </div>
        <BadgeTipoEnsino tipo={p.tipoEnsino} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: 12 }}>
        <Info label="Curso" value={p.curso} /><Info label="Turma" value={p.turma} />
        <Info label="Realização" value={p.anoRealizacao ? `${p.semestre}º Sem. ${p.anoRealizacao}` : '—'} />
        <Info label="Contrato" value={p.modeloContrato} />
        <Info label="Alunos" value={p.totalAlunos ? `${p.totalAlunos} alunos` : '—'} />
        <Info label="IPCA a.m." value={p.ipcaAm ? `${(Number(p.ipcaAm) * 100).toFixed(2)}%` : '—'} />
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', borderTop: '1px solid #2E3150', paddingTop: 12 }}>
        <Btn pequeno onClick={onOrcamento}><FileText size={12} /> Orçamento</Btn>
        <Btn pequeno variante="ghost" onClick={onDashboard}><BarChart2 size={12} /> Dashboard</Btn>
        <Btn pequeno variante="secundario" onClick={onEditar}><Edit size={12} /></Btn>
        <Btn pequeno variante="ghost" onClick={onAtualizar} style={{ marginLeft: 'auto' }}><RefreshCw size={12} /> Atualizar P.O.</Btn>
        <Btn pequeno variante="secundario" onClick={onDuplicar}><Copy size={12} /></Btn>
        <Btn pequeno variante="perigo" onClick={onExcluir}><Trash2 size={12} /></Btn>
      </div>
    </div>
  )
}

function Info({ label, value }) {
  return <div><span style={{ color: '#64748B' }}>{label}: </span><span style={{ color: '#CBD5E1' }}>{value || '—'}</span></div>
}

const selectStyle = { background: '#0F1117', border: '1px solid #2E3150', borderRadius: 6, padding: '8px 10px', color: '#F1F5F9', fontSize: 13, outline: 'none', fontFamily: 'Inter, sans-serif', cursor: 'pointer' }
