import { useMemo, useState } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { useAtendimento } from '../contexts/AtendimentoContext'
import { SyncBar } from '../components/SyncBar'
import { PipelineDots } from '../components/PipelineDots'
import { calcularPipeline } from '../lib/rifaPipeline'
import { formatarData, formatarValor } from '../lib/formatadores'
import type { Rifa } from '../../../hooks/useRifas'

const SITUACAO_COR: Record<string, string> = {
  'EM ANDAMENTO': 'text-warning',
  'SORTEADA': 'text-success',
  'FECHADA': 'text-text-muted',
  'NÃO VAI TER': 'text-danger',
}

// Prioridade padrão de exibição: sorteios já sorteados (mais urgente acompanhar) primeiro.
const SITUACAO_PRIORIDADE: Record<string, number> = {
  'SORTEADA': 0,
  'EM ANDAMENTO': 1,
  'FECHADA': 2,
  'NÃO VAI TER': 3,
}

type Coluna = 'turma' | 'edicao' | 'formacao' | 'ano_formatura' | 'dia_vencimento' | 'premio_descricao' | 'valor_boleto' | 'situacao' | 'vinculo'

function valorOrdenavel(r: Rifa, coluna: Coluna): string | number {
  if (coluna === 'vinculo') return r.dimensao_projeto_id ? (r.match_manual ? 2 : 1) : 0
  const v = r[coluna]
  return v ?? ''
}

export function RifasListPage() {
  const { rifas, ganhadores, compras, carregando } = useAtendimento()
  const [sort, setSort] = useState<{ coluna: Coluna; dir: 'asc' | 'desc' } | null>(null)
  const [situacaoModo, setSituacaoModo] = useState<'padrao' | 'alfabetica'>('padrao')

  function handleClickHeader(coluna: Coluna) {
    if (coluna === 'situacao') {
      setSituacaoModo(m => (m === 'padrao' ? 'alfabetica' : 'padrao'))
      setSort(null)
      return
    }
    setSort(s => (s?.coluna === coluna ? { coluna, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { coluna, dir: 'asc' }))
  }

  const rifasOrdenadas = useMemo(() => {
    const arr = [...rifas]
    if (sort) {
      arr.sort((a, b) => {
        const va = valorOrdenavel(a, sort.coluna)
        const vb = valorOrdenavel(b, sort.coluna)
        const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'pt-BR')
        return sort.dir === 'asc' ? cmp : -cmp
      })
      return arr
    }
    if (situacaoModo === 'alfabetica') {
      arr.sort((a, b) => (a.situacao ?? '').localeCompare(b.situacao ?? '', 'pt-BR'))
      return arr
    }
    arr.sort((a, b) => {
      const pa = SITUACAO_PRIORIDADE[a.situacao ?? ''] ?? 99
      const pb = SITUACAO_PRIORIDADE[b.situacao ?? ''] ?? 99
      if (pa !== pb) return pa - pb
      return (a.dia_vencimento ?? '9999-99-99').localeCompare(b.dia_vencimento ?? '9999-99-99')
    })
    return arr
  }, [rifas, sort, situacaoModo])

  function IconeSort({ coluna }: { coluna: Coluna }) {
    if (coluna === 'situacao') return null
    if (sort?.coluna !== coluna) return <ChevronsUpDown size={11} className="text-text-muted/50" />
    return sort.dir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />
  }

  const colunas: { campo: Coluna; label: string }[] = [
    { campo: 'turma', label: 'Turma' },
    { campo: 'edicao', label: 'Edição' },
    { campo: 'formacao', label: 'Formação' },
    { campo: 'ano_formatura', label: 'Ano' },
    { campo: 'dia_vencimento', label: 'Vencimento' },
    { campo: 'premio_descricao', label: 'Prêmio' },
    { campo: 'valor_boleto', label: 'Valor' },
    { campo: 'situacao', label: 'Situação' },
    { campo: 'vinculo', label: 'Vínculo' },
  ]

  return (
    <div>
      <h1 className="text-xl font-bold text-text-main mb-4">Todas as Rifas</h1>
      <SyncBar />

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/5">
              <tr className="text-left text-text-muted uppercase tracking-wider text-[10px]">
                {colunas.map(c => (
                  <th
                    key={c.campo}
                    onClick={() => handleClickHeader(c.campo)}
                    className="px-4 py-3 font-semibold cursor-pointer select-none hover:text-text-main transition-colors"
                  >
                    <span className="inline-flex items-center gap-1">
                      {c.label}
                      {c.campo === 'situacao'
                        ? <span className="normal-case text-[9px] text-text-muted/70">({situacaoModo === 'padrao' ? 'padrão' : 'A-Z'})</span>
                        : <IconeSort coluna={c.campo} />}
                    </span>
                  </th>
                ))}
                <th className="px-4 py-3 font-semibold">Pipeline</th>
              </tr>
            </thead>
            <tbody>
              {carregando && (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-text-muted">Carregando...</td></tr>
              )}
              {!carregando && rifasOrdenadas.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-text-muted">Nenhuma rifa sincronizada ainda.</td></tr>
              )}
              {rifasOrdenadas.map(r => {
                const ganhador = ganhadores.find(g => g.rifa_id === r.id) ?? null
                const compra = ganhador ? compras.find(c => c.ganhador_id === ganhador.id) ?? null : null
                const status = calcularPipeline(r, ganhador, compra)
                return (
                  <tr key={r.id} className="border-t border-white/5 hover:bg-white/5">
                    <td className="px-4 py-2 text-text-main">{r.turma}</td>
                    <td className="px-4 py-2 text-text-muted">{r.edicao ?? '—'}</td>
                    <td className="px-4 py-2 text-text-muted">{r.formacao ?? '—'}</td>
                    <td className="px-4 py-2 text-text-muted">{r.ano_formatura ?? '—'}</td>
                    <td className="px-4 py-2 text-text-muted whitespace-nowrap">{formatarData(r.dia_vencimento)}</td>
                    <td className="px-4 py-2 text-text-muted max-w-xs truncate" title={r.premio_descricao ?? ''}>{r.premio_descricao ?? '—'}</td>
                    <td className="px-4 py-2 text-text-muted whitespace-nowrap">{formatarValor(r.valor_boleto)}</td>
                    <td className={`px-4 py-2 font-semibold whitespace-nowrap ${SITUACAO_COR[r.situacao ?? ''] ?? 'text-text-muted'}`}>{r.situacao ?? '—'}</td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {r.dimensao_projeto_id
                        ? <span className={r.match_manual ? 'text-success' : 'text-text-muted'}>{r.match_manual ? 'manual' : `auto (${Math.round((r.match_confianca ?? 0) * 100)}%)`}</span>
                        : <span className="text-danger">pendente</span>}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap"><PipelineDots status={status} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
