import { useState, useEffect } from 'react'
import { useGoogleAuth } from '../../../contexts/GoogleAuthContext'
import { fetchSheetNames, fetchAba } from '../../../utils/sheetsSync'
import {
  SHEET_EVENTOS_ID, TABS_IGNORAR, parseEventoDetalhes, casarAbaComTurma, type EventoDetalhes,
} from '../utils/eventoOperacional'

export interface EventoOperacionalState {
  conectado: boolean
  logando: boolean
  conectar: () => void
  abas: string[]
  abaSelecionada: string
  setAbaSelecionada: (t: string) => void
  detalhes: EventoDetalhes | null
  carregando: boolean
  erro: string | null
  autoCasou: boolean // a aba foi escolhida sozinha pela turma
}

/**
 * Lê a planilha "Operacional" de eventos (Drive) e devolve os detalhes da aba da
 * turma. Auto-casa a aba pela turma; a UI pode trocar manualmente. Só busca
 * quando `ativo` (ex: a aba "Info do Evento" está aberta).
 */
export function useEventoOperacional(turma: string, ativo: boolean): EventoOperacionalState {
  const { accessToken, conectado, logando, conectar } = useGoogleAuth()
  const [abas, setAbas] = useState<string[]>([])
  const [abaSelecionada, setAbaSelecionada] = useState('')
  const [autoCasou, setAutoCasou] = useState(false)
  const [detalhes, setDetalhes] = useState<EventoDetalhes | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // 1) Lista as abas e auto-seleciona a da turma.
  useEffect(() => {
    if (!ativo || !accessToken) return
    let cancel = false
    setCarregando(true); setErro(null)
    fetchSheetNames(SHEET_EVENTOS_ID, accessToken)
      .then(names => {
        if (cancel) return
        const validas = names.filter(n => !TABS_IGNORAR.has(n.toLowerCase().trim()))
        setAbas(validas)
        setAbaSelecionada(prev => {
          if (prev) return prev
          const auto = casarAbaComTurma(validas, turma)
          setAutoCasou(!!auto)
          return auto ?? ''
        })
        setCarregando(false)
      })
      .catch(e => { if (!cancel) { setErro(String(e?.message ?? e)); setCarregando(false) } })
    return () => { cancel = true }
  }, [ativo, accessToken, turma])

  // 2) Carrega a aba selecionada.
  useEffect(() => {
    if (!ativo || !accessToken || !abaSelecionada) { setDetalhes(null); return }
    let cancel = false
    setCarregando(true); setErro(null)
    fetchAba(SHEET_EVENTOS_ID, abaSelecionada, accessToken)
      .then(rows => {
        if (cancel) return
        if (!rows) { setErro('Não consegui ler essa aba da planilha.'); setDetalhes(null) }
        else setDetalhes(parseEventoDetalhes(rows, abaSelecionada))
        setCarregando(false)
      })
      .catch(e => { if (!cancel) { setErro(String(e?.message ?? e)); setCarregando(false) } })
    return () => { cancel = true }
  }, [ativo, accessToken, abaSelecionada])

  return { conectado, logando, conectar, abas, abaSelecionada, setAbaSelecionada, detalhes, carregando, erro, autoCasou }
}
