import { useState } from 'react'
import Btn from '../../components/UI/Btn'
import { CheckCircle, AlertCircle, Loader, ChevronDown, ChevronRight } from 'lucide-react'
import { formatarMoeda } from '../../utils/formatters'

export default function ImportProgress({ progresso, resultado, onFechar }) {
  const { mensagens = [], concluido = false, erro = false } = progresso || {}
  const [showDivergencias, setShowDivergencias] = useState(false)

  const totalDiv = resultado?.totalDivergencias || 0
  const divergencias = resultado?.divergencias || []

  return (
    <div style={{ padding: 20 }}>
      {/* Log de progresso */}
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

      {/* Resultado da importação */}
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

      {/* Resumo de divergências */}
      {concluido && resultado && !erro && (
        <div style={{
          borderRadius: 8,
          padding: 12,
          marginBottom: 16,
          ...(totalDiv > 0
            ? { background: '#3D2D00', border: '1px solid #92400E' }
            : { background: '#052e16', border: '1px solid #14532d' }
          ),
        }}>
          {totalDiv > 0 ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 15 }}>⚠️</span>
                <span style={{ fontWeight: 600, color: '#FEF9C3', fontSize: 13 }}>
                  Divergências encontradas: {totalDiv} {totalDiv === 1 ? 'item' : 'itens'}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#D4A017', marginBottom: 8, lineHeight: 1.5 }}>
                Os valores totais desses itens foram importados como estão na planilha, mas diferem do cálculo Qtde × $ Unitário.
                Eles ficam marcados com ⚠️ na tabela para sua revisão.
              </div>
              <button
                onClick={() => setShowDivergencias(v => !v)}
                style={{ background: 'none', border: '1px solid #92400E', borderRadius: 4, padding: '3px 10px', color: '#FEF9C3', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                {showDivergencias ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                {showDivergencias ? 'Ocultar lista' : 'Ver lista de itens'}
              </button>
              {showDivergencias && (
                <div style={{ marginTop: 10, maxHeight: 200, overflowY: 'auto' }}>
                  {divergencias.map((d, i) => (
                    <div key={i} style={{ marginBottom: 8, padding: '6px 8px', background: 'rgba(0,0,0,0.2)', borderRadius: 4 }}>
                      <div style={{ color: '#FEF9C3', fontSize: 11, fontWeight: 600 }}>
                        Seção {d.secao} — {d.codigo ? `[${d.codigo}] ` : ''}{d.item}
                      </div>
                      {d.divergenciaDetalhe?.map((det, j) => (
                        <div key={j} style={{ color: '#D4A017', fontSize: 10, marginTop: 3, marginLeft: 8 }}>
                          {det.coluna}: {det.qtde} × {formatarMoeda(det.unitario)} = {formatarMoeda(det.totalCalculado)} | Planilha: {formatarMoeda(det.totalPlanilha)}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#86EFAC', fontSize: 12 }}>
              <CheckCircle size={14} />
              Todos os totais conferem com Qtde × $ Unit.
            </div>
          )}
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
