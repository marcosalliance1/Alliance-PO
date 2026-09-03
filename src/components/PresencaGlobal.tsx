import { useAuth } from '../contexts/AuthContext'
import { PresencaBar, type UsuarioPresenca } from './PresencaBar'

// Presença global do sistema interno inteiro (não por projeto/documento) — um
// canal fixo, sempre o mesmo em qualquer tela. Fica de fora do portal do
// cliente/comissão porque só é montado dentro do RequireAuth (rotas internas).
export function PresencaGlobal() {
  const { usuario, isAuthenticated } = useAuth()
  if (!isAuthenticated) return null

  // Sem login Google (senha de visitante compartilhada) não tem como saber
  // quem é — aparece genérico "Visitante" em vez de tentar adivinhar um nome.
  const pessoa: UsuarioPresenca = usuario ?? { nome: 'Visitante', avatar: null, email: '' }

  return (
    <div className="fixed top-2 right-2 z-50">
      <PresencaBar canal="sistema-alliance-po" usuario={pessoa} />
    </div>
  )
}
