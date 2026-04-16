import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { ORDEM_SECOES } from '../data/bancoItensDefault'

// ─── Projetos ────────────────────────────────────────────────────
export function useProjetos() {
  const [projetos, setProjetos] = useState([])
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(async () => {
    setCarregando(true)
    const { data, error } = await supabase
      .from('po_projetos')
      .select('*')
      .order('criado_em', { ascending: false })
    if (!error) setProjetos(data || [])
    setCarregando(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function criarProjeto(dados) {
    const row = mapearProjetoParaDB(dados)
    const { data, error } = await supabase
      .from('po_projetos')
      .insert(row)
      .select()
      .single()
    if (error) throw error
    setProjetos(prev => [data, ...prev])
    return data
  }

  async function atualizarProjeto(id, dados) {
    const row = mapearProjetoParaDB(dados)
    const { data, error } = await supabase
      .from('po_projetos')
      .update(row)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    setProjetos(prev => prev.map(p => p.id === id ? data : p))
    return data
  }

  async function excluirProjeto(id) {
    const { error } = await supabase.from('po_projetos').delete().eq('id', id)
    if (error) throw error
    setProjetos(prev => prev.filter(p => p.id !== id))
  }

  async function duplicarProjeto(projeto) {
    const row = mapearProjetoParaDB({
      ...mapearProjetoDoDB(projeto),
      nome: `${projeto.nome} (Cópia)`,
    })
    const { data: novoProjeto, error } = await supabase
      .from('po_projetos')
      .insert(row)
      .select()
      .single()
    if (error) throw error

    // Duplicar itens
    const { data: itens } = await supabase
      .from('po_itens')
      .select('*')
      .eq('projeto_id', projeto.id)

    if (itens?.length) {
      const novosItens = itens.map(({ id, criado_em, projeto_id, ...rest }) => ({
        ...rest,
        projeto_id: novoProjeto.id,
      }))
      await supabase.from('po_itens').insert(novosItens)
    }

    setProjetos(prev => [novoProjeto, ...prev])
    return novoProjeto
  }

  return { projetos, carregando, criarProjeto, atualizarProjeto, excluirProjeto, duplicarProjeto, recarregar: carregar }
}

// ─── Itens de um projeto ─────────────────────────────────────────
export function useItensProjeto(projetoId) {
  const [secoes, setSecoes] = useState(() =>
    Object.fromEntries(ORDEM_SECOES.map(s => [s, []]))
  )
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(async () => {
    if (!projetoId) return
    setCarregando(true)
    const { data, error } = await supabase
      .from('po_itens')
      .select('*')
      .eq('projeto_id', projetoId)
      .order('criado_em', { ascending: true })

    if (!error && data) {
      const agrupado = Object.fromEntries(ORDEM_SECOES.map(s => [s, []]))
      for (const item of data) {
        if (agrupado[item.secao]) agrupado[item.secao].push(mapearItemDoDB(item))
      }
      setSecoes(agrupado)
    }
    setCarregando(false)
  }, [projetoId])

  useEffect(() => { carregar() }, [carregar])

  async function adicionarItem(secao, dados) {
    const row = { ...mapearItemParaDB(dados), projeto_id: projetoId, secao }
    const { data, error } = await supabase.from('po_itens').insert(row).select().single()
    if (error) throw error
    const item = mapearItemDoDB(data)
    setSecoes(prev => ({ ...prev, [secao]: [...(prev[secao] || []), item] }))
    return item
  }

  async function atualizarItem(secao, itemId, campos) {
    const { data, error } = await supabase
      .from('po_itens')
      .update(mapearItemParaDB(campos))
      .eq('id', itemId)
      .select()
      .single()
    if (error) throw error
    const item = mapearItemDoDB(data)
    setSecoes(prev => ({
      ...prev,
      [secao]: prev[secao].map(i => i.id === itemId ? item : i),
    }))
  }

  async function excluirItem(secao, itemId) {
    const { error } = await supabase.from('po_itens').delete().eq('id', itemId)
    if (error) throw error
    setSecoes(prev => ({ ...prev, [secao]: prev[secao].filter(i => i.id !== itemId) }))
  }

  async function salvarSecaoCompleta(secao, itens) {
    // Deleta todos os itens da seção e reinsere (usado no import)
    await supabase.from('po_itens').delete().eq('projeto_id', projetoId).eq('secao', secao)
    if (itens.length > 0) {
      const rows = itens.map(i => ({ ...mapearItemParaDB(i), projeto_id: projetoId, secao }))
      const { error } = await supabase.from('po_itens').insert(rows)
      if (error) throw error
    }
    await carregar()
  }

  return { secoes, carregando, adicionarItem, atualizarItem, excluirItem, salvarSecaoCompleta, recarregar: carregar }
}

// ─── Conciliação Everest ─────────────────────────────────────────
export function useConciliacao(projetoId) {
  const [conciliacao, setConciliacao] = useState({})

  useEffect(() => {
    if (!projetoId) return
    supabase
      .from('po_conciliacao_everest')
      .select('*')
      .eq('projeto_id', projetoId)
      .then(({ data }) => {
        if (!data) return
        const mapa = {}
        for (const row of data) {
          if (row.tipo === 'receita') {
            if (!mapa.receitas) mapa.receitas = {}
            mapa.receitas[row.linha] = {
              vendido: row.vendido,
              orcado: row.orcado,
              contratado: row.contratado,
              everestPago: row.everest_pago,
              everestFalta: row.everest_falta,
            }
          } else {
            mapa[row.linha] = {
              valorPago: row.everest_pago,
              faltaPagar: row.everest_falta,
            }
          }
        }
        setConciliacao(mapa)
      })
  }, [projetoId])

  async function salvarConciliacao(linha, tipo, campos) {
    const row = {
      projeto_id: projetoId,
      linha,
      tipo,
      vendido: campos.vendido || 0,
      orcado: campos.orcado || 0,
      contratado: campos.contratado || 0,
      everest_pago: campos.everestPago ?? campos.valorPago ?? 0,
      everest_falta: campos.everestFalta ?? campos.faltaPagar ?? 0,
    }
    await supabase.from('po_conciliacao_everest').upsert(row, {
      onConflict: 'projeto_id,linha,tipo',
    })
    setConciliacao(prev => {
      if (tipo === 'receita') {
        return { ...prev, receitas: { ...(prev.receitas || {}), [linha]: campos } }
      }
      return { ...prev, [linha]: campos }
    })
  }

  return { conciliacao, salvarConciliacao }
}

// ─── Mapeamentos snake_case ↔ camelCase ──────────────────────────
function mapearProjetoParaDB(p) {
  return {
    nome: p.nome,
    tipo_ensino: p.tipoEnsino,
    instituicao: p.instituicao,
    curso: p.curso,
    turma: p.turma,
    ano_orcamento: p.anoOrcamento,
    ano_realizacao: p.anoRealizacao,
    semestre: p.semestre,
    modelo_contrato: p.modeloContrato,
    total_alunos: Number(p.totalAlunos) || 0,
    adesoes_previstas: Number(p.adesoesPrevistas) || 0,
    pacote_base: Number(p.pacoteBase) || 0,
    comissao_alunos: Number(p.comissaoAlunos) || 0,
    cortesias_comissao: Number(p.cortesiasComissao) || 0,
    qtd_convidados: Number(p.qtdConvidados) || 0,
    convidados_pos_baile: Number(p.convidadosPosBaile) || 0.7,
    ipca_am: Number(p.ipcaAm) || 0.0055,
    tempo_contrato: Number(p.tempoContrato) || 24,
    tempo_festa: Number(p.tempoFesta) || 6,
    tempo_pos_baile: Number(p.tempoPosBaile) || 3,
    responsavel_alliance: p.responsavelAlliance,
  }
}

export function mapearProjetoDoDB(r) {
  return {
    id: r.id,
    nome: r.nome,
    tipoEnsino: r.tipo_ensino,
    instituicao: r.instituicao,
    curso: r.curso,
    turma: r.turma,
    anoOrcamento: r.ano_orcamento,
    anoRealizacao: r.ano_realizacao,
    semestre: r.semestre,
    modeloContrato: r.modelo_contrato,
    totalAlunos: r.total_alunos,
    adesoesPrevistas: r.adesoes_previstas,
    pacoteBase: r.pacote_base,
    comissaoAlunos: r.comissao_alunos,
    cortesiasComissao: r.cortesias_comissao,
    qtdConvidados: r.qtd_convidados,
    convidadosPosBaile: r.convidados_pos_baile,
    ipcaAm: r.ipca_am,
    tempoContrato: r.tempo_contrato,
    tempoFesta: r.tempo_festa,
    tempoPosBaile: r.tempo_pos_baile,
    responsavelAlliance: r.responsavel_alliance,
    criadoEm: r.criado_em,
  }
}

function mapearItemParaDB(i) {
  return {
    codigo: i.codigo,
    area: i.area,
    moscow: i.moscow,
    def_custo: i.defCusto,
    sub_categoria: i.subCategoria,
    item: i.item,
    fornecedor: i.fornecedor,
    qtde: Number(i.qtde) || 0,
    valor_unitario_atual: Number(i.valorUnitarioAtual) || 0,
    total_atual: Number(i.totalAtual) || 0,
    valor_projetado: Number(i.valorProjetado) || 0,
    total_projetado: Number(i.totalProjetado) || 0,
    qtde_orcada: Number(i.qtdeOrcada) || 0,
    valor_unitario_orcado: Number(i.valorUnitarioOrcado) || 0,
    valor_orcado: Number(i.valorOrcado) || 0,
    qtde_contratada: Number(i.qtdeContratada) || 0,
    valor_unitario_contratado: Number(i.valorUnitarioContratado) || 0,
    valor_contratado: Number(i.valorContratado) || 0,
    responsavel: i.responsavel,
    status: i.status || 'Em aberto',
    pgto: i.pgto,
    valor_pago: Number(i.valorPago) || 0,
    falta_pagar: Number(i.faltaPagar) || 0,
  }
}

export function mapearItemDoDB(r) {
  return {
    id: r.id,
    secao: r.secao,
    codigo: r.codigo,
    area: r.area,
    moscow: r.moscow,
    defCusto: r.def_custo,
    subCategoria: r.sub_categoria,
    item: r.item,
    fornecedor: r.fornecedor,
    qtde: Number(r.qtde) || 0,
    valorUnitarioAtual: Number(r.valor_unitario_atual) || 0,
    totalAtual: Number(r.total_atual) || 0,
    valorProjetado: Number(r.valor_projetado) || 0,
    totalProjetado: Number(r.total_projetado) || 0,
    qtdeOrcada: Number(r.qtde_orcada) || 0,
    valorUnitarioOrcado: Number(r.valor_unitario_orcado) || 0,
    valorOrcado: Number(r.valor_orcado) || 0,
    qtdeContratada: Number(r.qtde_contratada) || 0,
    valorUnitarioContratado: Number(r.valor_unitario_contratado) || 0,
    valorContratado: Number(r.valor_contratado) || 0,
    responsavel: r.responsavel,
    status: r.status || 'Em aberto',
    pgto: r.pgto,
    valorPago: Number(r.valor_pago) || 0,
    faltaPagar: Number(r.falta_pagar) || 0,
  }
}
