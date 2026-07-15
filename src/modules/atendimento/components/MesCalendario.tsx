// Grade de mês feita à mão (sem lib de calendário — o projeto não tinha nenhuma
// instalada e um grid de mês é simples o bastante pra não justificar a dependência
// nova). Reaproveitado tanto no mini-calendário do Dashboard quanto na tela Calendário.
export interface DiaEvento { cor: string }

interface MesCalendarioProps {
  mes: Date // qualquer data dentro do mês que se quer exibir
  eventosPorDia: Record<string, DiaEvento[]> // chave 'AAAA-MM-DD'
  aoClicarDia?: (dataISO: string) => void
  compacto?: boolean
  diaDestacado?: string | null
}

export function MesCalendario({ mes, eventosPorDia, aoClicarDia, compacto, diaDestacado }: MesCalendarioProps) {
  const ano = mes.getFullYear()
  const mesIdx = mes.getMonth()
  const primeiroDia = new Date(ano, mesIdx, 1)
  const diasNoMes = new Date(ano, mesIdx + 1, 0).getDate()
  const offsetInicio = primeiroDia.getDay()

  const celulas: (string | null)[] = []
  for (let i = 0; i < offsetInicio; i++) celulas.push(null)
  for (let d = 1; d <= diasNoMes; d++) celulas.push(`${ano}-${String(mesIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  while (celulas.length % 7 !== 0) celulas.push(null)

  const hojeISO = new Date().toISOString().slice(0, 10)

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-text-muted uppercase mb-1">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <div key={i}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {celulas.map((iso, i) => {
          if (!iso) return <div key={i} />
          const dia = Number(iso.slice(-2))
          const eventos = eventosPorDia[iso] ?? []
          const isHoje = iso === hojeISO
          const isDestacado = iso === diaDestacado
          return (
            <button
              key={i}
              type="button"
              onClick={() => aoClicarDia?.(iso)}
              className={`aspect-square rounded-md flex flex-col items-center justify-center gap-0.5 transition-colors
                ${compacto ? 'text-[11px]' : 'text-sm'}
                ${isDestacado ? 'bg-primary/20 border border-primary/40' : isHoje ? 'bg-white/10' : 'hover:bg-white/5'}
                ${aoClicarDia ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <span className={isHoje ? 'text-primary font-semibold' : 'text-text-main'}>{dia}</span>
              {eventos.length > 0 && (
                <span className="flex gap-0.5">
                  {eventos.slice(0, 3).map((e, j) => <span key={j} className={`w-1.5 h-1.5 rounded-full ${e.cor}`} />)}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
