import { useState, useCallback } from 'react'

interface ConfirmState {
  open: boolean
  message: string
  onConfirm: () => void
}

export function useConfirm() {
  const [state, setState] = useState<ConfirmState>({
    open: false,
    message: '',
    onConfirm: () => {},
  })

  const confirm = useCallback((message: string, onConfirm: () => void) => {
    setState({ open: true, message, onConfirm })
  }, [])

  const accept = useCallback(() => {
    state.onConfirm()
    setState(s => ({ ...s, open: false }))
  }, [state])

  const cancel = useCallback(() => {
    setState(s => ({ ...s, open: false }))
  }, [])

  return { confirmState: state, confirm, accept, cancel }
}
