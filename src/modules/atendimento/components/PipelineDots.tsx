import type { RifaPipelineStatus } from '../lib/rifaPipeline'

// Cada etapa tem sua própria cor quando concluída (em vez de tudo verde) — dá pra ler
// de relance em que pé a rifa está sem precisar passar o mouse em cada bolinha.
const COR_ETAPA = {
  sorteada: 'bg-primary',
  contato: 'bg-warning',
  compra: 'bg-success',
} as const

export function PipelineDots({ status }: { status: RifaPipelineStatus }) {
  const dots: { label: string; on: boolean; cor: string }[] = []
  if (status.temEtapa1) dots.push({ label: 'Sorteada', on: status.sorteada, cor: COR_ETAPA.sorteada })
  dots.push({ label: 'Ganhador contatado', on: status.contatoFeito, cor: COR_ETAPA.contato })
  dots.push({ label: 'Prêmio comprado', on: status.premioComprado, cor: COR_ETAPA.compra })

  return (
    <span className="inline-flex items-center gap-1">
      {dots.map((d, i) => (
        <span
          key={i}
          title={d.label}
          className={`w-2.5 h-2.5 rounded-full ${d.on ? d.cor : 'bg-white/10 border border-white/20'}`}
        />
      ))}
      {status.avisoIntegridade && <span title={status.avisoIntegridade} className="text-warning text-[10px] ml-0.5">⚠</span>}
    </span>
  )
}
