import { Phone, Mail } from 'lucide-react'
import { parseContato } from '../../../lib/rifasSync'

// Recebe o texto já normalizado (armazenado em rifas_ganhadores.contato) e separa
// telefone/e-mail pra exibir como duas linhas, em vez de texto corrido.
export function ContatoBadges({ contato }: { contato: string | null }) {
  if (!contato) return <span className="text-text-muted">—</span>
  const { telefone, email } = parseContato(contato)
  if (!telefone && !email) return <span className="text-text-muted">{contato}</span>

  return (
    <div className="flex flex-col gap-0.5">
      {telefone && (
        <span className="inline-flex items-center gap-1 text-text-main text-xs whitespace-nowrap">
          <Phone size={11} className="text-text-muted" /> {telefone}
        </span>
      )}
      {email && (
        <span className="inline-flex items-center gap-1 text-text-main text-xs whitespace-nowrap">
          <Mail size={11} className="text-text-muted" /> {email}
        </span>
      )}
    </div>
  )
}
