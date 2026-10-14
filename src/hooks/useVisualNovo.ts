import { useCallback, useSyncExternalStore } from 'react'

// Preferência "Visual novo" (fundo claro, estilo planilha) da área de Projetos.
// Opt-in e por navegador (localStorage): desligado = o app fica exatamente como era.
const KEY = 'alliance_visual_novo'
const EVENTO = 'alliance-visual-novo'

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

export function useVisualNovo(): [boolean, (v: boolean) => void] {
  const ativo = useSyncExternalStore(assinar, ler, () => false)
  const definir = useCallback((v: boolean) => {
    try { localStorage.setItem(KEY, v ? '1' : '0') } catch { /* sem armazenamento: só não persiste */ }
    window.dispatchEvent(new Event(EVENTO))
  }, [])
  return [ativo, definir]
}
