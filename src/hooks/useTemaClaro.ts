import { useCallback, useSyncExternalStore } from 'react'

// Preferência "Tema claro" dos módulos (Dashboard, Verbas, Financeiro, Pré-Eventos, Comercial, Atendimento…).
// Opt-in e por navegador (localStorage). Desligado = o app fica exatamente como era (escuro).
const KEY = 'alliance_tema_claro'
const EVENTO = 'alliance-tema-claro'

function ler(): boolean {
  try { return localStorage.getItem(KEY) === '1' } catch { return false }
}

function assinar(cb: () => void) {
  window.addEventListener(EVENTO, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(EVENTO, cb)
    window.removeEventListener('storage', cb)
  }
}

export function useTemaClaro(): [boolean, (v: boolean) => void] {
  const ativo = useSyncExternalStore(assinar, ler, () => false)
  const definir = useCallback((v: boolean) => {
    try { localStorage.setItem(KEY, v ? '1' : '0') } catch { /* sem armazenamento: só não persiste */ }
    window.dispatchEvent(new Event(EVENTO))
  }, [])
  return [ativo, definir]
}
