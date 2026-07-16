// Legenda de apoio pra quem não lembra o que cada bolinha do Pipeline significa.
export function PipelineLegenda({ compacta }: { compacta?: boolean }) {
  const itens = [
    { label: 'Sorteada', cor: 'bg-primary' },
    { label: 'Ganhador contatado', cor: 'bg-warning' },
    { label: 'Prêmio comprado', cor: 'bg-success' },
  ]
  return (
    <div className={`flex flex-wrap items-center gap-3 text-[11px] text-text-muted ${compacta ? '' : 'mb-3'}`}>
      {itens.map(item => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span className={`w-2.5 h-2.5 rounded-full ${item.cor}`} /> {item.label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-white/10 border border-white/20" /> ainda não
      </span>
      <span className="inline-flex items-center gap-1.5 text-warning">⚠ inconsistência (revisar)</span>
    </div>
  )
}
