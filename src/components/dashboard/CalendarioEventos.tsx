import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react'
import type { Projeto } from '../../types'
import { parseLocalDate } from '../../utils/formatters'

export interface EventoPreEvento {
  id: string
  titulo: string
  data: string
}

interface Props {
  projetos: Projeto[]
  preEventos?: EventoPreEvento[]
}

interface EventoCalendario {
  id: string
  titulo: string
  data: Date
  tipo: 'projeto' | 'preevento'
}

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function tituloProjeto(p: Projeto): string {
  return p.tap.turma || `${p.tap.instituicao} ${p.tap.curso}`.trim() || `Projeto #${p.id.slice(0, 6)}`
}

export function CalendarioEventos({ projetos, preEventos = [] }: Props) {
  const navigate = useNavigate()
  const hoje = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }, [])
  const [mesRef, setMesRef] = useState(() => new Date(hoje.getFullYear(), hoje.getMonth(), 1))

  const comData = useMemo(() => {
    const doProjeto: EventoCalendario[] = projetos
      .filter((p) => p.tap.dataEvento)
      .map((p) => ({ id: p.id, titulo: tituloProjeto(p), data: parseLocalDate(p.tap.dataEvento), tipo: 'projeto' as const }))
    const doPreEvento: EventoCalendario[] = preEventos
      .filter((e) => e.data)
      .map((e) => ({ id: e.id, titulo: e.titulo, data: parseLocalDate(e.data), tipo: 'preevento' as const }))
    return [...doProjeto, ...doPreEvento]
  }, [projetos, preEventos])

  const semData = useMemo(() => {
    const anoAtual = hoje.getFullYear()
    return projetos
      .filter((p) => !p.tap.dataEvento)
      .map((p) => ({ projeto: p, ehAnoAtual: p.tap.anoRealizacao === anoAtual }))
      .sort((a, b) => Number(b.ehAnoAtual) - Number(a.ehAnoAtual))
  }, [projetos, hoje])

  const porDia = useMemo(() => {
    const map = new Map<string, typeof comData>()
    for (const item of comData) {
      const key = item.data.toDateString()
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }
    return map
  }, [comData])

  const dias = useMemo(() => {
    const ano = mesRef.getFullYear()
    const mes = mesRef.getMonth()
    const primeiroDia = new Date(ano, mes, 1)
    const ultimoDia = new Date(ano, mes + 1, 0)
    const inicioGrid = new Date(primeiroDia)
    inicioGrid.setDate(inicioGrid.getDate() - primeiroDia.getDay())
    const fimGrid = new Date(ultimoDia)
    fimGrid.setDate(fimGrid.getDate() + (6 - ultimoDia.getDay()))

    const arr: Date[] = []
    const cur = new Date(inicioGrid)
    while (cur <= fimGrid) {
      arr.push(new Date(cur))
      cur.setDate(cur.getDate() + 1)
    }
    return arr
  }, [mesRef])

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-y-2">
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-semibold text-text-main">Calendário de Eventos</h3>
          {preEventos.length > 0 && (
            <div className="flex items-center gap-3 text-[10px] text-text-muted">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary shrink-0" /> Baile</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warning shrink-0" /> Pré-Evento</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMesRef(new Date(mesRef.getFullYear(), mesRef.getMonth() - 1, 1))}
            className="p-1 rounded hover:bg-white/5 text-text-muted hover:text-text-main transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-text-main min-w-[130px] text-center">
            {MESES[mesRef.getMonth()]} {mesRef.getFullYear()}
          </span>
          <button
            onClick={() => setMesRef(new Date(mesRef.getFullYear(), mesRef.getMonth() + 1, 1))}
            className="p-1 rounded hover:bg-white/5 text-text-muted hover:text-text-main transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="text-center text-[10px] font-semibold text-text-muted uppercase py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {dias.map((d, i) => {
          const doMes = d.getMonth() === mesRef.getMonth()
          const eventos = porDia.get(d.toDateString()) ?? []
          const isHoje = d.toDateString() === hoje.toDateString()
          return (
            <div
              key={i}
              className={`min-h-[64px] rounded-inner p-1.5 border ${
                isHoje ? 'border-primary/50' : 'border-white/5'
              } ${eventos.length > 0 ? 'bg-primary/5' : ''}`}
            >
              <p className={`text-[10px] mb-1 ${doMes ? (isHoje ? 'text-primary font-bold' : 'text-text-muted') : 'text-text-muted/30'}`}>
                {d.getDate()}
              </p>
              <div className="space-y-0.5">
                {eventos.slice(0, 2).map((ev) => (
                  <button
                    key={`${ev.tipo}-${ev.id}`}
                    onClick={() => navigate(ev.tipo === 'projeto' ? `/projetos/${ev.id}` : `/pre-eventos/orcamentos/${ev.id}`)}
                    title={ev.titulo}
                    className={`w-full text-left text-[9px] px-1 py-0.5 rounded truncate transition-colors block ${
                      ev.tipo === 'projeto'
                        ? 'bg-primary/20 text-primary hover:bg-primary/30'
                        : 'bg-warning/20 text-warning hover:bg-warning/30'
                    }`}
                  >
                    {ev.titulo}
                  </button>
                ))}
                {eventos.length > 2 && (
                  <p className="text-[9px] text-text-muted px-1">+{eventos.length - 2}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {semData.length > 0 && (
        <div className="mt-5 pt-4 border-t border-white/5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4" style={{ color: '#F59E0B' }} />
            <h4 className="text-xs font-semibold text-text-main">Sem data definida ({semData.length})</h4>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {semData.map(({ projeto, ehAnoAtual }) => (
              <button
                key={projeto.id}
                onClick={() => navigate(`/projetos/${projeto.id}`)}
                className={`flex items-center justify-between gap-2 text-left px-2.5 py-1.5 rounded-inner border transition-colors ${
                  ehAnoAtual ? 'border-danger/40 bg-danger/5 hover:bg-danger/10' : 'border-white/10 hover:bg-white/5'
                }`}
              >
                <span className="text-xs text-text-main truncate">{tituloProjeto(projeto)}</span>
                {ehAnoAtual && <span className="text-[9px] font-semibold text-danger shrink-0">{hoje.getFullYear()}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
