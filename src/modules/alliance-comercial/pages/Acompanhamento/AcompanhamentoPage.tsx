import React, { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { useAcompanhamento } from '../../hooks/useAcompanhamento'
import { useGoogleAuth } from '../../../../contexts/GoogleAuthContext'
import { ProgressBar } from '../../../../components/ui/ProgressBar'
import { formatBRL, formatDate } from '../../../../utils/formatters'
import { ENSINO_LABEL, ENSINO_ORDEM, ENSINO_COLOR } from '../../constants/ensino'
import type { TipoEscola } from '../../../../types'
import type { MetaTotal, MetaSegmento, LinhaCaptacao } from '../../types/acompanhamento'

const COR_META = '#c98500'
const COR_CAPTADO = '#3987e5'
const COR_POSITIVO = '#00b894'
const COR_NEGATIVO = '#e94560'

function fmtPct(v: number) {
  return `${v.toFixed(1)}%`
}

function pctReal(captado: number, meta: number) {
  return meta > 0 ? (captado / meta) * 100 : 0
}

function corMeta(pct: number) {
  return pct >= 100 ? COR_POSITIVO : COR_NEGATIVO
}

// A API do Google Sheets só lê planilhas nativas — um .xlsx aberto/editado via Drive
// (mas nunca convertido) devolve esse erro genérico em inglês. Troca por uma
// explicação acionável em vez do texto cru da API.
function mensagemErroAmigavel(e: Error): string {
  if (e.message.includes('must not be an Office file')) {
    return 'Essa planilha é um arquivo Excel (.xlsx) salvo no Drive, não uma Planilha Google nativa — '
      + 'a API não consegue ler nesse formato. Abra o arquivo, vá em Arquivo → Salvar como Planilhas Google, '
      + 'e cole aqui o link da cópia convertida.'
  }
  return e.message
}

function LinhaPendente({ pendente }: { pendente: number }) {
  if (pendente < 0) {
    return <p className="text-xs mt-2 font-semibold" style={{ color: COR_POSITIVO }}>Meta superada em {formatBRL(Math.abs(pendente))}</p>
  }
  return <p className="text-xs mt-2 text-text-muted">Pendente: {formatBRL(pendente)}</p>
}

function CardMetaTotal({ titulo, dados }: { titulo: string; dados: MetaTotal }) {
  const pct = pctReal(dados.captado, dados.meta)
  const cor = corMeta(pct)
  return (
    <div className="bg-surface rounded-xl border border-white/10 p-5 flex-1 min-w-[300px]">
      <p className="text-text-main font-semibold text-sm mb-3">{titulo}</p>
      <div className="flex items-end justify-between mb-2 gap-2">
        <div>
          <p className="text-text-muted text-xs">Captado</p>
          <p className="text-text-main font-semibold">{formatBRL(dados.captado)}</p>
        </div>
        <p className="text-3xl font-bold shrink-0" style={{ color: cor }}>{fmtPct(pct)}</p>
        <div className="text-right">
          <p className="text-text-muted text-xs">Meta</p>
          <p className="text-text-main font-semibold">{formatBRL(dados.meta)}</p>
        </div>
      </div>
      {dados.meta > 0 ? (
        <ProgressBar value={dados.captado} max={dados.meta} color={cor} />
      ) : (
        <p className="text-text-muted text-xs">Meta não definida</p>
      )}
      <LinhaPendente pendente={dados.pendente} />
    </div>
  )
}

function CardSegmento({ tipo, dados }: { tipo: TipoEscola; dados: MetaSegmento }) {
  const cor = ENSINO_COLOR[tipo]
  const pct = pctReal(dados.captado, dados.meta)
  return (
    <div
      className="bg-surface rounded-xl border-l-4 border border-white/10 px-4 py-4 flex-1 min-w-[240px]"
      style={{ borderLeftColor: cor }}
    >
      <p className="text-text-main font-semibold text-sm mb-2">{ENSINO_LABEL[tipo]}</p>
      <div className="flex justify-between text-xs text-text-muted mb-1">
        <span>{formatBRL(dados.captado)}</span>
        <span>{formatBRL(dados.meta)}</span>
      </div>
      {dados.meta > 0 ? (
        <ProgressBar value={dados.captado} max={dados.meta} color={cor} />
      ) : (
        <p className="text-text-muted text-xs">Sem meta definida</p>
      )}
      <div className="flex items-center justify-between mt-2">
        <span className="text-lg font-bold" style={{ color: cor }}>{fmtPct(pct)}</span>
        {dados.pendente < 0 ? (
          <span className="text-xs font-semibold" style={{ color: COR_POSITIVO }}>
            Meta superada em {formatBRL(Math.abs(dados.pendente))}
          </span>
        ) : (
          <span className="text-xs text-text-muted">Pendente {formatBRL(dados.pendente)}</span>
        )}
      </div>
    </div>
  )
}

function BadgeComissao({ status }: { status: string }) {
  const s = status.trim().toLowerCase()
  if (s.includes('total')) {
    return <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success shrink-0">Sim (total)</span>
  }
  if (s) {
    return <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/15 text-warning shrink-0">Sim (1ª parcela)</span>
  }
  return <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-text-muted shrink-0">Pendente</span>
}

function TabelaCaptacao({ tipo, linhas }: { tipo: TipoEscola; linhas: LinhaCaptacao[] }) {
  const cor = ENSINO_COLOR[tipo]
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-black/10">
          <th className="text-left px-4 pl-9 py-2 text-text-muted font-medium text-xs">Instituição</th>
          <th className="text-left px-4 py-2 text-text-muted font-medium text-xs w-40">Adesões</th>
          <th className="text-right px-4 py-2 text-text-muted font-medium text-xs w-32">Pacote Base</th>
          <th className="text-right px-4 py-2 text-text-muted font-medium text-xs w-32">Total</th>
          <th className="text-right px-4 py-2 text-text-muted font-medium text-xs w-32">Comissão 01</th>
          <th className="text-right px-4 py-2 text-text-muted font-medium text-xs w-32">Comissão 02</th>
          <th className="text-right px-4 py-2 text-text-muted font-medium text-xs w-32">Total Comissão</th>
          <th className="text-left px-4 py-2 text-text-muted font-medium text-xs w-36">Responsável</th>
        </tr>
      </thead>
      <tbody>
        {linhas.map((l, i) => (
          <tr key={i} className="border-t border-white/5 hover:bg-white/3 transition-colors">
            <td className="px-4 pl-9 py-2.5 text-text-main">
              <div className="flex items-center gap-2">
                <span>{l.instituicao}</span>
                <BadgeComissao status={l.comissaoRecebida} />
              </div>
            </td>
            <td className="px-4 py-2.5 w-40">
              {l.metaAdesoes > 0 ? (
                <ProgressBar value={l.adesoesAtuais} max={l.metaAdesoes} color={cor} label={`${l.adesoesAtuais}/${l.metaAdesoes}`} />
              ) : (
                <span className="text-text-muted text-xs">{l.adesoesAtuais}</span>
              )}
            </td>
            <td className="px-4 py-2.5 text-right text-text-main">{formatBRL(l.pacoteBase)}</td>
            <td className="px-4 py-2.5 text-right text-text-main">{formatBRL(l.total)}</td>
            <td className="px-4 py-2.5 text-right text-text-main">{formatBRL(l.comissao01)}</td>
            <td className="px-4 py-2.5 text-right text-text-main">{formatBRL(l.comissao02)}</td>
            <td className="px-4 py-2.5 text-right text-primary font-semibold">{formatBRL(l.totalComissao)}</td>
            <td className="px-4 py-2.5 text-text-main">{l.responsavel}</td>
          </tr>
        ))}
        {linhas.length === 0 && (
          <tr>
            <td colSpan={8} className="px-4 py-6 text-center text-text-muted text-sm">Nenhuma instituição encontrada.</td>
          </tr>
        )}
      </tbody>
    </table>
  )
}

export const AcompanhamentoPage: React.FC = () => {
  const { dados, temDados, carregando, sincronizando, erro, sincronizar } = useAcompanhamento()
  const { accessToken, conectar, invalidarToken } = useGoogleAuth()
  const [link, setLink] = useState('')
  const [erroSync, setErroSync] = useState<string | null>(null)
  const [gruposAbertos, setGruposAbertos] = useState<Record<string, boolean>>({})

  function toggleGrupo(tipo: TipoEscola) {
    setGruposAbertos((p) => ({ ...p, [tipo]: !p[tipo] }))
  }

  async function handleSincronizar() {
    setErroSync(null)
    if (!accessToken) {
      conectar()
      return
    }
    const alvo = link.trim() || dados.spreadsheetId || ''
    if (!alvo) {
      setErroSync('Cole o link da planilha "Acompanhamento Comercial".')
      return
    }
    try {
      await sincronizar(alvo, accessToken)
      setLink('')
    } catch (e) {
      if ((e as Error & { tipo?: string }).tipo === 'TOKEN_EXPIRADO') {
        invalidarToken()
        setErroSync('Sessão do Google expirada. Clique em "Conectar Google" e sincronize novamente.')
      } else {
        setErroSync(mensagemErroAmigavel(e as Error))
      }
    }
  }

  const chartData = useMemo(() =>
    ENSINO_ORDEM.map((tipo) => ({
      segmento: ENSINO_LABEL[tipo],
      Meta: dados.metasPorSegmento[tipo].meta,
      Captado: dados.metasPorSegmento[tipo].captado,
    })),
  [dados])

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-text-main font-bold text-xl">Acompanhamento</h1>
          <p className="text-text-muted text-sm mt-1">
            {temDados
              ? `${dados.rca.nome || 'RCA'}${dados.rca.nivel ? ` · Nível ${dados.rca.nivel}` : ''}`
              : 'Metas, comissão e captação por RCA, sincronizado da planilha "Acompanhamento Comercial".'}
          </p>
        </div>
        {dados.sincronizadoEm && (
          <span className="text-[10px] px-2 py-1 rounded-full bg-white/10 text-text-muted shrink-0">
            Última atualização: {formatDate(dados.sincronizadoEm)}
          </span>
        )}
      </div>

      <div className="bg-surface-2 border border-primary/20 rounded-lg p-4">
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder={dados.spreadsheetId ? 'Cole um novo link para trocar a planilha (opcional)' : 'Cole o link do Google Sheets "Acompanhamento Comercial"'}
            className="flex-1 min-w-[240px] bg-bg border border-white/10 rounded-md px-3 py-2 text-sm text-text-main placeholder:text-text-muted"
          />
          <button
            type="button"
            onClick={handleSincronizar}
            disabled={sincronizando || (!link.trim() && !dados.spreadsheetId && !!accessToken)}
            className="px-4 py-2 bg-primary hover:bg-primary/90 disabled:bg-primary/40 text-white font-medium rounded-md text-sm shrink-0"
          >
            {sincronizando ? 'Sincronizando…' : !accessToken ? 'Conectar Google' : 'Sincronizar'}
          </button>
        </div>
        {(erroSync || erro) && <p className="text-danger text-xs mt-2">{erroSync ?? erro}</p>}
      </div>

      {carregando && !temDados && (
        <div className="bg-surface rounded-xl border border-white/10 px-4 py-8 text-center text-text-muted text-sm">
          Carregando...
        </div>
      )}

      {!carregando && !temDados && (
        <div className="bg-surface rounded-xl border border-white/10 px-4 py-8 text-center text-text-muted text-sm">
          Nenhum dado sincronizado ainda. Cole o link da planilha acima e clique em Sincronizar.
        </div>
      )}

      {temDados && (
        <>
          <div className="flex flex-wrap gap-3">
            <CardMetaTotal titulo="Meta do Ano" dados={dados.metaAno} />
            <CardMetaTotal titulo="Super Meta do Ano" dados={dados.superMetaAno} />
          </div>

          <div className="flex flex-wrap gap-3">
            {ENSINO_ORDEM.map((tipo) => (
              <CardSegmento key={tipo} tipo={tipo} dados={dados.metasPorSegmento[tipo]} />
            ))}
          </div>

          <div className="bg-surface rounded-xl border border-white/10 px-4 py-4">
            <p className="text-text-main font-semibold text-sm mb-3">Meta x Captado por segmento</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="segmento" tick={{ fill: '#8892b0', fontSize: 11 }} />
                <YAxis tick={{ fill: '#8892b0', fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v) => formatBRL(Number(v))}
                  contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#f0f0f0' }}
                  itemStyle={{ color: '#8892b0' }}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: '#8892b0' }} />
                <Bar dataKey="Meta" fill={COR_META} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Captado" fill={COR_CAPTADO} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-3">
            {ENSINO_ORDEM.map((tipo) => {
              const linhas = dados.captacaoPorSegmento[tipo]
              const aberto = gruposAbertos[tipo] ?? false
              const cor = ENSINO_COLOR[tipo]
              return (
                <div key={tipo} className="bg-surface rounded-xl border border-white/10 overflow-hidden">
                  <button
                    onClick={() => toggleGrupo(tipo)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/3 transition-colors"
                  >
                    {aberto ? <ChevronDown className="w-4 h-4 text-text-muted shrink-0" /> : <ChevronRight className="w-4 h-4 text-text-muted shrink-0" />}
                    <span className="flex-1 text-text-main font-semibold" style={{ color: cor }}>Captação {ENSINO_LABEL[tipo]}</span>
                    <span className="text-text-muted text-xs">{linhas.length} instituiç{linhas.length !== 1 ? 'ões' : 'ão'}</span>
                  </button>
                  {aberto && (
                    <div className="border-t border-white/10 overflow-x-auto">
                      <TabelaCaptacao tipo={tipo} linhas={linhas} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
