import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { METAS_PADRAO, lerPercentual, type MetasPct } from '../../lib/economiaFechados'

interface Props {
  metas: MetasPct
  onSalvar: (m: MetasPct) => void
  onFechar: () => void
}

const CAMPOS: { k: keyof MetasPct; rotulo: string }[] = [
  { k: 'MEDIO', rotulo: 'Ensino Médio' },
  { k: 'SUPERIOR', rotulo: 'Ensino Superior' },
  { k: 'FUNDAMENTAL', rotulo: 'Ensino Fundamental (9º ano)' },
]

const paraTexto = (n: number) => String(n).replace('.', ',')

export function EditorMetas({ metas, onSalvar, onFechar }: Props) {
  const [txt, setTxt] = useState<Record<keyof MetasPct, string>>({
    MEDIO: paraTexto(metas.MEDIO), SUPERIOR: paraTexto(metas.SUPERIOR), FUNDAMENTAL: paraTexto(metas.FUNDAMENTAL),
  })

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar() }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onFechar])

  const valores = { MEDIO: lerPercentual(txt.MEDIO), SUPERIOR: lerPercentual(txt.SUPERIOR), FUNDAMENTAL: lerPercentual(txt.FUNDAMENTAL) }
  const valido = valores.MEDIO !== null && valores.SUPERIOR !== null && valores.FUNDAMENTAL !== null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar() }}>
      <form
        role="dialog"
        aria-modal="true"
        aria-label="Editar metas de margem"
        className="w-full max-w-md rounded-t-2xl border border-white/15 bg-surface p-4 shadow-2xl sm:rounded-2xl"
        onSubmit={(e) => {
          e.preventDefault()
          if (valido) onSalvar({ MEDIO: valores.MEDIO!, SUPERIOR: valores.SUPERIOR!, FUNDAMENTAL: valores.FUNDAMENTAL! })
        }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-text-main">Metas de margem</h3>
          <button type="button" onClick={onFechar} className="rounded-lg p-2 text-text-muted hover:bg-white/10 hover:text-text-main" aria-label="Fechar"><X size={18} /></button>
        </div>
        <p className="mt-1 text-xs text-text-muted">
          Margem de contribuição mínima (% da receita orçada) por tipo de ensino. Vale para esta tela, a lista de projetos e os dashboards.
          Fica salva neste navegador.
        </p>
        <div className="mt-4 space-y-3">
          {CAMPOS.map(({ k, rotulo }) => {
            const ruim = lerPercentual(txt[k]) === null
            return (
              <label key={k} className="block">
                <span className="text-xs font-semibold text-text-main">{rotulo}</span>
                <div className="relative mt-1">
                  <input
                    value={txt[k]}
                    inputMode="decimal"
                    onChange={(e) => setTxt((t) => ({ ...t, [k]: e.target.value }))}
                    className={`w-full rounded-lg border bg-surface-2 px-3 py-2 pr-8 text-sm text-text-main outline-none focus:border-primary ${ruim ? 'border-danger' : 'border-white/15'}`}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">%</span>
                </div>
                {ruim && <span className="mt-0.5 block text-[11px] text-danger">Digite um número de 0 a 100.</span>}
              </label>
            )
          })}
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            className="text-xs text-text-muted underline-offset-2 hover:text-text-main hover:underline"
            onClick={() => setTxt({ MEDIO: paraTexto(METAS_PADRAO.MEDIO), SUPERIOR: paraTexto(METAS_PADRAO.SUPERIOR), FUNDAMENTAL: paraTexto(METAS_PADRAO.FUNDAMENTAL) })}
          >
            Voltar ao padrão (25 / 15 / 15)
          </button>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={onFechar}>Cancelar</button>
            <button type="submit" className="btn-primary disabled:opacity-50" disabled={!valido}>Salvar</button>
          </div>
        </div>
      </form>
    </div>
  )
}
