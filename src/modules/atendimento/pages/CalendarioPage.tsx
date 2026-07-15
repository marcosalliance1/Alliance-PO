import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAtendimento } from '../contexts/AtendimentoContext'
import { MesCalendario, type DiaEvento } from '../components/MesCalendario'
import { PipelineDrawer } from '../components/PipelineDrawer'
import { formatarData, formatarValor } from '../lib/formatadores'
import type { Rifa } from '../../../hooks/useRifas'

export function CalendarioPage() {
  const { rifas, ganhadores, compras } = useAtendimento()
  const [searchParams, setSearchParams] = useSearchParams()
  const diaParam = searchParams.get('dia')
  const [mes, setMes] = useState(() => (diaParam ? new Date(diaParam) : new Date()))
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(diaParam)
  const [detalhe, setDetalhe] = useState<Rifa | null>(null)

  const rifasComVencimento = useMemo(
    () => rifas.filter(r => r.dia_vencimento && (r.situacao === 'EM ANDAMENTO' || r.situacao === 'SORTEADA')),
    [rifas],
  )

  const eventosPorDia = useMemo(() => {
    const map: Record<string, DiaEvento[]> = {}
    for (const r of rifasComVencimento) {
      const cor = r.situacao === 'SORTEADA' ? 'bg-success' : 'bg-warning'
      const key = r.dia_vencimento!
      if (!map[key]) map[key] = []
      map[key].push({ cor })
    }
    return map
  }, [rifasComVencimento])

  const rifasDoDia = diaSelecionado ? rifasComVencimento.filter(r => r.dia_vencimento === diaSelecionado) : []

  function irMesAnterior() { setMes(m => new Date(m.getFullYear(), m.getMonth() - 1, 1)) }
  function irMesSeguinte() { setMes(m => new Date(m.getFullYear(), m.getMonth() + 1, 1)) }
  function selecionarDia(iso: string) {
    setDiaSelecionado(iso)
    setSearchParams({ dia: iso })
  }

  const ganhadorDoDetalhe = detalhe ? ganhadores.find(g => g.rifa_id === detalhe.id) ?? null : null
  const compraDoDetalhe = ganhadorDoDetalhe ? compras.find(c => c.ganhador_id === ganhadorDoDetalhe.id) ?? null : null

  return (
    <div>
      <h1 className="text-xl font-bold text-text-main mb-4">Calendário</h1>
      <div className="grid grid-cols-3 gap-4">
        <div className="card col-span-2">
          <div className="flex items-center justify-between mb-4">
            <button onClick={irMesAnterior} className="p-1.5 rounded-lg hover:bg-white/5 text-text-muted"><ChevronLeft size={16} /></button>
            <span className="text-sm font-semibold text-text-main capitalize">
              {mes.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={irMesSeguinte} className="p-1.5 rounded-lg hover:bg-white/5 text-text-muted"><ChevronRight size={16} /></button>
          </div>
          <MesCalendario mes={mes} eventosPorDia={eventosPorDia} diaDestacado={diaSelecionado} aoClicarDia={selecionarDia} />
          <div className="flex gap-4 mt-4 text-xs text-text-muted">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-warning" /> Ainda não sorteada</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-success" /> Já sorteada</span>
          </div>
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-text-main mb-3">
            {diaSelecionado ? `Sorteios em ${formatarData(diaSelecionado)}` : 'Selecione um dia no calendário'}
          </h2>
          {diaSelecionado && rifasDoDia.length === 0 && (
            <div className="text-xs text-text-muted">Nenhum sorteio nesse dia.</div>
          )}
          <div className="space-y-2">
            {rifasDoDia.map(r => (
              <button
                key={r.id}
                onClick={() => setDetalhe(r)}
                className="w-full text-left bg-bg rounded-lg p-3 border border-white/5 hover:border-primary/30 transition-colors"
              >
                <div className="text-sm font-semibold text-text-main">{r.turma}</div>
                <div className="text-xs text-text-muted truncate" title={r.premio_descricao ?? ''}>{r.premio_descricao ?? '—'}</div>
                <div className="text-xs text-text-muted mt-1">{formatarValor(r.valor_boleto)} · {r.situacao}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <PipelineDrawer aberto={!!detalhe} onFechar={() => setDetalhe(null)} rifa={detalhe} ganhador={ganhadorDoDetalhe} compra={compraDoDetalhe} />
    </div>
  )
}
