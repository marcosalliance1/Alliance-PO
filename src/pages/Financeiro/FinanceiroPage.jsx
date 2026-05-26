import { useState, useRef } from 'react'
import { Upload, Loader, TrendingUp, CreditCard, BarChart2 } from 'lucide-react'
import { useFinanceiro } from '../../hooks/useFinanceiro'
import { tempoDesde } from '../../utils/parseFinanceiro'
import Toast from '../../components/UI/Toast'
import ResultadoProjetos from './tabs/ResultadoProjetos'
import FluxoCaixa from './tabs/FluxoCaixa'
import ControleDespesas from './tabs/ControleDespesas'

const ABAS = [
  { id: 'resultado',  label: 'Resultado Projetos',  Icon: TrendingUp },
  { id: 'fluxo',     label: 'Fluxo de Caixa',       Icon: CreditCard },
  { id: 'despesas',  label: 'Controle de Despesas',  Icon: BarChart2 },
]

export default function FinanceiroPage() {
  const { cap, car, uploads, carregando, uploadCAP, uploadCAR } = useFinanceiro()
  const [abaAtiva, setAbaAtiva] = useState('resultado')
  const [processando, setProcessando] = useState({ CAP: false, CAR: false })
  const [toast, setToast] = useState(null)
  const capRef = useRef()
  const carRef = useRef()

  const semDados = cap.length === 0 && car.length === 0

  async function handleArquivo(tipo, arquivo) {
    if (!arquivo) return
    if (!arquivo.name.toLowerCase().endsWith('.xlsx')) {
      setToast({ mensagem: 'Envie um arquivo .xlsx válido.', tipo: 'erro' })
      return
    }

    setProcessando(prev => ({ ...prev, [tipo]: true }))
    try {
      const fn = tipo === 'CAP' ? uploadCAP : uploadCAR
      const { totalLinhas } = await fn(arquivo)
      setToast({ mensagem: `${tipo} atualizado — ${totalLinhas.toLocaleString('pt-BR')} registros importados.`, tipo: 'sucesso' })
    } catch (err) {
      const msg = err.tipo === 'ABA_NAO_ENCONTRADA'
        ? err.message
        : `Erro ao processar ${tipo}: ${err.message}`
      setToast({ mensagem: msg, tipo: 'erro' })
    } finally {
      setProcessando(prev => ({ ...prev, [tipo]: false }))
      if (tipo === 'CAP' && capRef.current) capRef.current.value = ''
      if (tipo === 'CAR' && carRef.current) carRef.current.value = ''
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#F1F5F9' }}>Financeiro</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748B' }}>Contas a Pagar (CAP) e Contas a Receber (CAR)</p>
        </div>

        {/* Botões de upload */}
        <div style={{ display: 'flex', gap: 10 }}>
          {/* CAP */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <input ref={capRef} type="file" accept=".xlsx" style={{ display: 'none' }}
              onChange={e => handleArquivo('CAP', e.target.files?.[0])} />
            <button
              onClick={() => capRef.current?.click()}
              disabled={processando.CAP}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 16px', borderRadius: 8, cursor: processando.CAP ? 'default' : 'pointer',
                background: '#1A1D2E', border: '1px solid #2E3150',
                color: processando.CAP ? '#64748B' : '#94A3B8', fontSize: 13, fontWeight: 500,
              }}
            >
              {processando.CAP
                ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />
                : <Upload size={14} />}
              Atualizar CAP
            </button>
            {uploads.CAP && (
              <span style={{ fontSize: 11, color: '#475569' }}>
                Atualizado {tempoDesde(uploads.CAP.uploaded_at)} · {(uploads.CAP.total_linhas || 0).toLocaleString('pt-BR')} linhas
              </span>
            )}
          </div>

          {/* CAR */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <input ref={carRef} type="file" accept=".xlsx" style={{ display: 'none' }}
              onChange={e => handleArquivo('CAR', e.target.files?.[0])} />
            <button
              onClick={() => carRef.current?.click()}
              disabled={processando.CAR}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 16px', borderRadius: 8, cursor: processando.CAR ? 'default' : 'pointer',
                background: '#2563EB20', border: '1px solid #2563EB60',
                color: processando.CAR ? '#64748B' : '#93C5FD', fontSize: 13, fontWeight: 500,
              }}
            >
              {processando.CAR
                ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />
                : <Upload size={14} />}
              Atualizar CAR
            </button>
            {uploads.CAR && (
              <span style={{ fontSize: 11, color: '#475569' }}>
                Atualizado {tempoDesde(uploads.CAR.uploaded_at)} · {(uploads.CAR.total_linhas || 0).toLocaleString('pt-BR')} linhas
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Sub-abas */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #2E3150', paddingBottom: 0 }}>
        {ABAS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setAbaAtiva(id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 16px', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: abaAtiva === id ? 600 : 400,
              color: abaAtiva === id ? '#F1F5F9' : '#64748B',
              borderBottom: abaAtiva === id ? '2px solid #3B82F6' : '2px solid transparent',
              marginBottom: -1, transition: 'all 0.15s',
            }}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      {carregando ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12, color: '#64748B' }}>
          <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: 14 }}>Carregando dados financeiros...</span>
        </div>
      ) : semDados ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: 320, gap: 12, textAlign: 'center',
          background: '#1A1D2E', border: '1px solid #2E3150', borderRadius: 16,
        }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: '#0D1220', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Upload size={22} style={{ color: '#475569' }} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#64748B' }}>Nenhum dado financeiro carregado</div>
          <div style={{ fontSize: 13, color: '#475569', maxWidth: 380, lineHeight: 1.6 }}>
            Use os botões <strong style={{ color: '#94A3B8' }}>Atualizar CAP</strong> e{' '}
            <strong style={{ color: '#93C5FD' }}>Atualizar CAR</strong> para importar os dados do sistema financeiro.
          </div>
        </div>
      ) : (
        <>
          {abaAtiva === 'resultado' && <ResultadoProjetos cap={cap} car={car} />}
          {abaAtiva === 'fluxo'     && <FluxoCaixa cap={cap} />}
          {abaAtiva === 'despesas'  && <ControleDespesas cap={cap} />}
        </>
      )}

      {toast && <Toast mensagem={toast.mensagem} tipo={toast.tipo} onFechar={() => setToast(null)} />}
    </div>
  )
}
