import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStorage } from '../../hooks/useStorage'
import { formatarMoeda, formatarPercentual } from '../../utils/formatters'
import { calcularTotaisItens, calcularMargem, MAPEAMENTO_RESUMO } from '../../utils/calculadora'
import { NOMES_SECOES, ORDEM_SECOES } from '../../data/bancoItensDefault'
import { ArrowLeft, FileText } from 'lucide-react'
import Btn from '../../components/UI/Btn'

const LINHAS_RECEITA = [
  'Faturamento Adesões',
  'Vendas Convites Extras',
  'Vendas Mesas Extras',
  'Arrecadação Extra',
  'Receita Vendas Baile',
  'Outros',
  'Receita Rescisões',
]

const LINHAS_CUSTO = Object.keys(MAPEAMENTO_RESUMO)

export default function DashboardProjetoPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [projetos, setProjetos] = useStorage('projetos', [])
  const projeto = projetos.find(p => p.id === id)

  if (!projeto) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: '#64748B' }}>
        <p>Projeto não encontrado.</p>
        <Btn onClick={() => navigate('/projetos')} variante="ghost">Voltar</Btn>
      </div>
    )
  }

  function atualizarConciliacao(linha, campo, valor) {
    const conciliacaoEverest = {
      ...projeto.conciliacaoEverest,
      [linha]: {
        ...(projeto.conciliacaoEverest?.[linha] || {}),
        [campo]: Number(valor) || 0,
      }
    }
    setProjetos(prev => prev.map(p => p.id === id ? { ...p, conciliacaoEverest } : p))
  }

  // Calcular custos por categoria a partir dos itens
  const custosPorCategoria = useMemo(() => {
    const resultado = {}
    for (const [linha, cfg] of Object.entries(MAPEAMENTO_RESUMO)) {
      const itensSecao = projeto.secoes?.[cfg.secao] || []
      const itensFiltrados = itensSecao.filter(cfg.filtro)
      const totais = calcularTotaisItens(itensFiltrados)
      resultado[linha] = totais
    }
    return resultado
  }, [projeto])

  // Receitas (do conciliacaoEverest ou zeros)
  const receitas = useMemo(() => {
    const rec = projeto.conciliacaoEverest?.receitas || {}
    return LINHAS_RECEITA.reduce((acc, linha) => {
      acc[linha] = {
        vendido: rec[linha]?.vendido || 0,
        orcado: rec[linha]?.orcado || 0,
        contratado: rec[linha]?.contratado || 0,
        everestPago: rec[linha]?.everestPago || 0,
        everestFalta: rec[linha]?.everestFalta || 0,
      }
      return acc
    }, {})
  }, [projeto])

  // Totais
  const totalReceitaVendido = Object.values(receitas).reduce((a, r) => a + (r.vendido || 0), 0)
  const totalReceitaOrcado = Object.values(receitas).reduce((a, r) => a + (r.orcado || 0), 0)
  const totalReceitaContratado = Object.values(receitas).reduce((a, r) => a + (r.contratado || 0), 0)
  const totalReceitaEverest = Object.values(receitas).reduce((a, r) => a + (r.everestPago || 0), 0)

  const totalCustoVendido = Object.values(custosPorCategoria).reduce((a, c) => a + (c.totalAtual || 0), 0)
  const totalCustoOrcado = Object.values(custosPorCategoria).reduce((a, c) => a + (c.totalOrcado || 0), 0)
  const totalCustoContratado = Object.values(custosPorCategoria).reduce((a, c) => a + (c.totalContratado || 0), 0)
  const totalCustoPago = Object.values(custosPorCategoria).reduce((a, c) => a + (c.totalPago || 0), 0)

  const margemVendido = calcularMargem(totalReceitaVendido, totalCustoVendido)
  const margemOrcado = calcularMargem(totalReceitaOrcado, totalCustoOrcado)
  const margemContratado = calcularMargem(totalReceitaContratado, totalCustoContratado)
  const margemEverest = calcularMargem(totalReceitaEverest, totalCustoPago)

  // Totais por seção
  const totaisPorSecao = useMemo(() => {
    return ORDEM_SECOES.map(secao => {
      const itens = projeto.secoes?.[secao] || []
      const totais = calcularTotaisItens(itens)
      return { secao, nome: NOMES_SECOES[secao], itens: itens.length, ...totais }
    })
  }, [projeto])

  const totalContratadoGeral = totaisPorSecao.reduce((a, s) => a + s.totalContratado, 0)

  function atualizarReceita(linha, campo, valor) {
    const conciliacaoEverest = {
      ...projeto.conciliacaoEverest,
      receitas: {
        ...(projeto.conciliacaoEverest?.receitas || {}),
        [linha]: {
          ...(projeto.conciliacaoEverest?.receitas?.[linha] || {}),
          [campo]: Number(valor) || 0,
        }
      }
    }
    setProjetos(prev => prev.map(p => p.id === id ? { ...p, conciliacaoEverest } : p))
  }

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{ marginBottom: 20 }}>
        <button onClick={() => navigate('/projetos')} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: 0, marginBottom: 12 }}>
          <ArrowLeft size={14} /> Voltar
        </button>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#F1F5F9' }}>Dashboard — {projeto.nome}</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748B' }}>{projeto.instituicao} · {projeto.curso} · {projeto.anoRealizacao}</p>
          </div>
          <Btn variante="ghost" onClick={() => navigate(`/orcamento/${id}`)}><FileText size={14} /> Ver Orçamento</Btn>
        </div>
      </div>

      {/* Resumo Geral — Conciliação Everest */}
      <div style={{ background: '#1A1D2E', border: '1px solid #2E3150', borderRadius: 10, marginBottom: 20, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #2E3150', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#F1F5F9' }}>Resumo Geral — Conciliação Everest</h2>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#0F1117' }}>
                <th style={thStyle}>Categoria</th>
                <th style={{ ...thStyle, ...thValor, color: '#93C5FD' }}>Vendido pelo Comercial</th>
                <th style={{ ...thStyle, ...thValor, color: '#FCD34D' }}>Orçado</th>
                <th style={{ ...thStyle, ...thValor, color: '#86EFAC' }}>Contratado</th>
                <th style={{ ...thStyle, ...thValor, color: '#C4B5FD' }}>Conciliação Everest<br /><span style={{ fontSize: 10, opacity: 0.7 }}>Valor Pago</span></th>
                <th style={{ ...thStyle, ...thValor, color: '#FDA4AF' }}>Conciliação Everest<br /><span style={{ fontSize: 10, opacity: 0.7 }}>Falta Pagar</span></th>
              </tr>
            </thead>
            <tbody>
              {/* Receitas */}
              <tr><td colSpan={6} style={{ background: '#1E3A5F', color: '#93C5FD', fontWeight: 700, padding: '6px 16px', fontSize: 11, letterSpacing: '0.05em' }}>RECEITAS</td></tr>
              {LINHAS_RECEITA.map(linha => (
                <tr key={linha} style={{ background: '#EFF6FF' }}>
                  <td style={{ padding: '7px 16px', color: '#1E3A8A', fontWeight: 500 }}>{linha}</td>
                  <CelulaReceitaEdit valor={receitas[linha]?.vendido} onChange={v => atualizarReceita(linha, 'vendido', v)} />
                  <CelulaReceitaEdit valor={receitas[linha]?.orcado} onChange={v => atualizarReceita(linha, 'orcado', v)} />
                  <CelulaReceitaEdit valor={receitas[linha]?.contratado} onChange={v => atualizarReceita(linha, 'contratado', v)} />
                  <CelulaReceitaEdit valor={receitas[linha]?.everestPago} onChange={v => atualizarReceita(linha, 'everestPago', v)} everest />
                  <CelulaReceitaEdit valor={receitas[linha]?.everestFalta} onChange={v => atualizarReceita(linha, 'everestFalta', v)} everest />
                </tr>
              ))}
              {/* Subtotal RECEITA BAILE */}
              <tr style={{ background: '#DBEAFE', borderTop: '2px solid #3B82F6', borderBottom: '2px solid #3B82F6' }}>
                <td style={{ padding: '8px 16px', color: '#1E3A8A', fontWeight: 700, fontSize: 13 }}>RECEITA BAILE</td>
                <td style={{ ...tdValor, color: '#1E3A8A', fontWeight: 700 }}>{formatarMoeda(totalReceitaVendido)}</td>
                <td style={{ ...tdValor, color: '#1E3A8A', fontWeight: 700 }}>{formatarMoeda(totalReceitaOrcado)}</td>
                <td style={{ ...tdValor, color: '#1E3A8A', fontWeight: 700 }}>{formatarMoeda(totalReceitaContratado)}</td>
                <td style={{ ...tdValor, color: '#1E3A8A', fontWeight: 700 }}>{formatarMoeda(totalReceitaEverest)}</td>
                <td style={{ ...tdValor, color: '#1E3A8A', fontWeight: 700 }}>—</td>
              </tr>

              {/* Separador DESPESAS */}
              <tr>
                <td colSpan={6} style={{ padding: '10px 16px', background: 'linear-gradient(to right, #1E3A8A, #D97706)', position: 'relative' }}>
                  <div style={{ textAlign: 'center', color: '#F1F5F9', fontWeight: 700, fontSize: 11, letterSpacing: '0.1em' }}>▼ DESPESAS</div>
                </td>
              </tr>

              {/* Custos */}
              {LINHAS_CUSTO.map(linha => {
                const c = custosPorCategoria[linha] || {}
                const pago = projeto.conciliacaoEverest?.[linha]?.valorPago || 0
                const falta = projeto.conciliacaoEverest?.[linha]?.faltaPagar || 0
                return (
                  <tr key={linha}>
                    <td style={{ padding: '7px 16px', color: '#1E293B' }}>{linha}</td>
                    <td style={{ ...tdValor, color: '#1E293B' }}>{formatarMoeda(c.totalAtual)}</td>
                    <td style={{ ...tdValor, color: '#1E293B' }}>{formatarMoeda(c.totalOrcado)}</td>
                    <td style={{ ...tdValor, color: '#1E293B' }}>{formatarMoeda(c.totalContratado)}</td>
                    <CelulaEverest
                      valor={pago}
                      onChange={v => atualizarConciliacao(linha, 'valorPago', v)}
                    />
                    <CelulaEverest
                      valor={falta}
                      onChange={v => atualizarConciliacao(linha, 'faltaPagar', v)}
                    />
                  </tr>
                )
              })}

              {/* CUSTO TOTAL */}
              <tr style={{ background: '#3D2B00' }}>
                <td style={{ padding: '8px 16px', color: '#FCD34D', fontWeight: 700, fontSize: 13 }}>CUSTO TOTAL</td>
                <td style={{ ...tdValor, color: '#FCD34D', fontWeight: 700 }}>{formatarMoeda(totalCustoVendido)}</td>
                <td style={{ ...tdValor, color: '#FCD34D', fontWeight: 700 }}>{formatarMoeda(totalCustoOrcado)}</td>
                <td style={{ ...tdValor, color: '#FCD34D', fontWeight: 700 }}>{formatarMoeda(totalCustoContratado)}</td>
                <td style={{ ...tdValor, color: '#FCD34D', fontWeight: 700 }}>{formatarMoeda(totalCustoPago)}</td>
                <td style={{ ...tdValor, color: '#FCD34D', fontWeight: 700 }}>—</td>
              </tr>

              {/* MARGEM */}
              {[
                ['MARGEM DE CONTRIBUIÇÃO — Vendido', margemVendido, totalReceitaVendido - totalCustoVendido],
                ['MARGEM DE CONTRIBUIÇÃO — Orçado', margemOrcado, totalReceitaOrcado - totalCustoOrcado],
                ['MARGEM DE CONTRIBUIÇÃO — Contratado', margemContratado, totalReceitaContratado - totalCustoContratado],
                ['MARGEM REAL — Everest', margemEverest, totalReceitaEverest - totalCustoPago],
              ].map(([label, pct, abs]) => (
                <tr key={label} style={{ background: abs >= 0 ? '#052e16' : '#450a0a', borderTop: '2px solid ' + (abs >= 0 ? '#16A34A' : '#DC2626') }}>
                  <td style={{ padding: '8px 16px', color: abs >= 0 ? '#86EFAC' : '#FCA5A5', fontWeight: 700, fontSize: 13 }}>{label}</td>
                  <td colSpan={3} style={{ ...tdValor, color: abs >= 0 ? '#86EFAC' : '#FCA5A5', fontWeight: 700, fontSize: 14 }}>
                    {formatarMoeda(abs)} ({formatarPercentual(pct)})
                  </td>
                  <td colSpan={2} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resumo por Seção */}
      <div style={{ background: '#1A1D2E', border: '1px solid #2E3150', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #2E3150' }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#F1F5F9' }}>Resumo por Seção</h2>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#0F1117' }}>
              <th style={thStyle}>Seção</th>
              <th style={thStyle}>Nome</th>
              <th style={{ ...thStyle, textAlign: 'right', paddingRight: 16 }}>Itens</th>
              <th style={{ ...thStyle, textAlign: 'right', paddingRight: 16 }}>Orçado</th>
              <th style={{ ...thStyle, textAlign: 'right', paddingRight: 16 }}>Contratado</th>
              <th style={{ ...thStyle, textAlign: 'right', paddingRight: 16 }}>Desvio %</th>
              <th style={{ ...thStyle, textAlign: 'right', paddingRight: 16 }}>% do Total</th>
            </tr>
          </thead>
          <tbody>
            {totaisPorSecao.map(s => {
              const desvio = s.totalOrcado > 0 ? ((s.totalContratado - s.totalOrcado) / s.totalOrcado) * 100 : 0
              const pctTotal = totalContratadoGeral > 0 ? (s.totalContratado / totalContratadoGeral) * 100 : 0
              return (
                <tr
                  key={s.secao}
                  onClick={() => navigate(`/orcamento/${id}#${s.secao}`)}
                  style={{ cursor: 'pointer', borderBottom: '1px solid #2E3150' }}
                  className="hover-row"
                >
                  <td style={{ padding: '10px 16px', color: '#64748B', fontSize: 12 }}>{s.secao}</td>
                  <td style={{ padding: '10px 16px', color: '#F1F5F9', fontWeight: 500 }}>{s.nome}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', paddingRight: 16, color: '#94A3B8' }}>{s.itens}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', paddingRight: 16, color: '#F1F5F9' }}>{formatarMoeda(s.totalOrcado)}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', paddingRight: 16, color: '#F1F5F9', fontWeight: 600 }}>{formatarMoeda(s.totalContratado)}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', paddingRight: 16, color: desvio >= 0 ? '#22C55E' : '#EF4444', fontWeight: 600 }}>
                    {formatarPercentual(desvio)}
                  </td>
                  <td style={{ padding: '10px 16px', paddingRight: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                      <div style={{ flex: 1, height: 6, background: '#2E3150', borderRadius: 3, maxWidth: 80 }}>
                        <div style={{ height: '100%', width: `${Math.min(pctTotal, 100)}%`, background: '#2563EB', borderRadius: 3 }} />
                      </div>
                      <span style={{ color: '#94A3B8', fontSize: 12, minWidth: 36, textAlign: 'right' }}>{pctTotal.toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CelulaReceitaEdit({ valor, onChange, everest }) {
  const [editando, setEditando] = useState(false)
  const [temp, setTemp] = useState('')

  function iniciar() { setTemp(String(valor || '')); setEditando(true) }
  function confirmar() { onChange?.(temp); setEditando(false) }

  if (editando) {
    return (
      <td style={tdValor}>
        <input
          autoFocus
          type="number"
          value={temp}
          onChange={e => setTemp(e.target.value)}
          onBlur={confirmar}
          onKeyDown={e => { if (e.key === 'Enter') confirmar(); if (e.key === 'Escape') setEditando(false) }}
          style={{ width: 120, padding: '2px 6px', border: '1px solid #3B82F6', borderRadius: 3, fontSize: 12, background: '#EFF6FF', textAlign: 'right' }}
        />
      </td>
    )
  }

  const n = Number(valor) || 0
  return (
    <td
      style={{ ...tdValor, cursor: 'pointer', color: '#1E293B' }}
      onClick={iniciar}
      title="Clique para editar"
    >
      {formatarMoeda(n)}
    </td>
  )
}

function CelulaEverest({ valor, onChange }) {
  const [editando, setEditando] = useState(false)
  const [temp, setTemp] = useState('')

  function iniciar() { setTemp(String(valor || '')); setEditando(true) }
  function confirmar() { onChange?.(temp); setEditando(false) }

  if (editando) {
    return (
      <td style={tdValor}>
        <input
          autoFocus
          type="number"
          value={temp}
          onChange={e => setTemp(e.target.value)}
          onBlur={confirmar}
          onKeyDown={e => { if (e.key === 'Enter') confirmar(); if (e.key === 'Escape') setEditando(false) }}
          style={{ width: 120, padding: '2px 6px', border: '1px solid #7C3AED', borderRadius: 3, fontSize: 12, background: '#EDE9FE', textAlign: 'right' }}
        />
      </td>
    )
  }

  const n = Number(valor) || 0
  return (
    <td style={{ ...tdValor, cursor: 'pointer' }} onClick={iniciar} title="Clique para editar">
      {formatarMoeda(n)}
    </td>
  )
}

const thStyle = {
  padding: '10px 16px',
  color: '#64748B',
  fontWeight: 600,
  fontSize: 11,
  textAlign: 'left',
  letterSpacing: '0.03em',
  borderBottom: '1px solid #2E3150',
}

const thValor = {
  textAlign: 'right',
  paddingRight: 16,
}

const tdValor = {
  padding: '7px 16px',
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
}
