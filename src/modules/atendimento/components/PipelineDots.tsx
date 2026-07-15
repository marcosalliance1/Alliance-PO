import type { RifaPipelineStatus } from '../lib/rifaPipeline'

// 3 indicadores fixos na ordem do pipeline: Sorteada → Ganhador contatado → Prêmio
// comprado. Sorteios avulsos (sem etapa 1) mostram só os 2 últimos.
export function PipelineDots({ status }: { status: RifaPipelineStatus }) {
  const dots: { label: string; on: boolean }[] = []
  if (status.temEtapa1) dots.push({ label: 'Sorteada', on: status.sorteada })
  dots.push({ label: 'Ganhador contatado', on: status.contatoFeito })
  dots.push({ label: 'Prêmio comprado', on: status.premioComprado })

  return (
    <span className="inline-flex items-center gap-1">
      {dots.map((d, i) => (
        <span
          key={i}
          title={d.label}
          className={`w-2.5 h-2.5 rounded-full ${d.on ? 'bg-success' : 'bg-white/10 border border-white/20'}`}
        />
      ))}
      {status.avisoIntegridade && <span title={status.avisoIntegridade} className="text-warning text-[10px] ml-0.5">⚠</span>}
    </span>
  )
}
