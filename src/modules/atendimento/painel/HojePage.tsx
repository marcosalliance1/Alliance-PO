import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useAvisosHoje } from './avisos'
import { dataBR, hojeISO } from './useRegistros'

export function HojePage() {
  const { avisos, carregando, erro } = useAvisosHoje()
  const navigate = useNavigate()
  const grupos = [...new Set(avisos.map(a => a.grupo))]

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-text-main">Avisos de hoje</h1>
        <p className="text-sm text-text-muted mt-1">{dataBR(hojeISO())} — eventos, marcos da régua e aniversários do dia.</p>
      </div>

      {erro && <div className="mb-4 text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-4 py-3">{erro}</div>}

      {carregando ? (
        <div className="p-10 text-center text-sm text-text-muted">Carregando…</div>
      ) : !avisos.length ? (
        <div className="bg-surface rounded-[12px] border border-white/10 p-10 text-center">
          <p className="text-text-main font-semibold">Nada previsto para hoje</p>
        </div>
      ) : (
        <div className="space-y-5">
          {grupos.map(g => (
            <div key={g}>
              <div className="text-[11px] font-bold uppercase tracking-wider text-primary mb-2">{g}</div>
              <div className="space-y-2">
                {avisos.filter(a => a.grupo === g).map((a, i) => (
                  <button key={i} onClick={() => navigate(a.link)}
                    className="w-full text-left flex items-center gap-3 bg-surface border border-white/10 hover:border-primary/50 rounded-lg px-4 py-3 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-text-main">{a.titulo}</div>
                      {a.sub && <div className="text-xs text-text-muted truncate">{a.sub}</div>}
                    </div>
                    <ChevronRight size={16} className="text-text-muted shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
