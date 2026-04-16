import Btn from '../../components/UI/Btn'
import { CheckCircle, AlertCircle, Loader } from 'lucide-react'

export default function ImportProgress({ progresso, resultado, onFechar }) {
  const { mensagens = [], concluido = false, erro = false } = progresso || {}

  return (
    <div style={{ padding: 20 }}>
      {/* Mensagens */}
      <div style={{ background: '#0F1117', borderRadius: 8, padding: 16, marginBottom: 16, maxHeight: 200, overflowY: 'auto', fontFamily: 'monospace', fontSize: 12 }}>
        {mensagens.map((m, i) => (
          <div key={i} style={{ color: i === mensagens.length - 1 && !concluido ? '#60A5FA' : '#94A3B8', marginBottom: 4 }}>
            {i === mensagens.length - 1 && !concluido ? '⟳ ' : '✓ '}{m}
          </div>
        ))}
        {!concluido && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#60A5FA', marginTop: 4 }}>
            <Loader size={12} className="animate-spin" /> Processando...
          </div>
        )}
      </div>

      {/* Resultado */}
      {concluido && resultado && (
        <div style={{ background: erro ? '#450a0a' : '#052e16', border: `1px solid ${erro ? '#7f1d1d' : '#14532d'}`, borderRadius: 8, padding: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            {erro
              ? <AlertCircle size={16} style={{ color: '#EF4444' }} />
              : <CheckCircle size={16} style={{ color: '#22C55E' }} />
            }
            <span style={{ fontWeight: 600, color: erro ? '#FCA5A5' : '#86EFAC', fontSize: 14 }}>
              {erro ? 'Importação com erros' : 'Importação concluída!'}
            </span>
          </div>
          <div style={{ fontSize: 12, color: '#CBD5E1' }}>
            <div style={{ marginBottom: 4 }}>Total de itens importados: <strong style={{ color: '#F1F5F9' }}>{resultado.totalItens}</strong></div>
            {Object.entries(resultado.resumo || {}).map(([secao, qtd]) => (
              <div key={secao} style={{ marginLeft: 12, color: '#94A3B8' }}>Seção {secao}: {qtd} itens</div>
            ))}
            {resultado.erros?.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ color: '#FCA5A5', marginBottom: 4 }}>Erros/avisos:</div>
                {resultado.erros.map((e, i) => <div key={i} style={{ marginLeft: 12, color: '#FCA5A5' }}>{e}</div>)}
              </div>
            )}
          </div>
        </div>
      )}

      {concluido && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Btn onClick={onFechar}>Fechar</Btn>
        </div>
      )}
    </div>
  )
}
