import { Sun, Moon } from 'lucide-react'
import { useTemaClaro } from '../../hooks/useTemaClaro'

// Botão da barra lateral (a barra continua escura nos dois temas — só a área de conteúdo muda).
export function ToggleTemaClaro() {
  const [claro, setClaro] = useTemaClaro()
  return (
    <button
      onClick={() => setClaro(!claro)}
      title={claro ? 'Voltar ao tema escuro' : 'Ativar o tema claro (fundo claro no conteúdo)'}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-text-muted hover:text-text-main hover:bg-white/5 transition-colors"
    >
      {claro ? <Moon size={13} /> : <Sun size={13} />}
      {claro ? 'Tema escuro' : 'Tema claro'}
    </button>
  )
}
