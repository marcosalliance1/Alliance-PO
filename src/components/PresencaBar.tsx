import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Barra de presença ao vivo (tipo Google Sheets): mostra avatares de quem está
// na mesma página agora. Usa Supabase Realtime Presence — efêmero, sem tabela.
// Reutilizável: passe um `canal` único por documento e o `usuario` logado.

export interface UsuarioPresenca {
  nome: string
  avatar: string | null
  email: string
}

interface Pessoa extends UsuarioPresenca {
  key: string
}

function iniciais(nome: string): string {
  const p = nome.trim().split(/\s+/).filter(Boolean)
  const s = (p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')
  return s.toUpperCase() || '?'
}

function corDe(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = seed.charCodeAt(i) + ((h << 5) - h)
  const cores = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']
  return cores[Math.abs(h) % cores.length]
}

function Avatar({ pessoa }: { pessoa: Pessoa }) {
  const titulo = pessoa.nome || 'Convidado'
  if (pessoa.avatar) {
    return (
      <img
        src={pessoa.avatar}
        alt={titulo}
        title={titulo}
        className="w-7 h-7 rounded-full border-2 border-white/10 object-cover"
      />
    )
  }
  return (
    <div
      title={titulo}
      className="w-7 h-7 rounded-full border-2 border-white/10 flex items-center justify-center text-[10px] font-semibold text-white"
      style={{ background: corDe(pessoa.email || pessoa.nome) }}
    >
      {iniciais(titulo)}
    </div>
  )
}

export function PresencaBar({ canal, usuario }: { canal: string; usuario: UsuarioPresenca | null }) {
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [minhaKey, setMinhaKey] = useState('')

  useEffect(() => {
    if (!supabase) return
    // Chave única: e-mail se logado; senão um id anônimo estável nesta aba.
    const key = usuario?.email || `anon-${Math.random().toString(36).slice(2, 9)}`
    setMinhaKey(key)

    const ch = supabase.channel(canal, { config: { presence: { key } } })
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState() as Record<string, Array<Partial<UsuarioPresenca>>>
      const lista: Pessoa[] = []
      for (const [k, metas] of Object.entries(state)) {
        const m = metas[0]
        lista.push({ key: k, nome: m?.nome ?? 'Convidado', avatar: m?.avatar ?? null, email: m?.email ?? '' })
      }
      setPessoas(lista)
    })
    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await ch.track({
          nome: usuario?.nome ?? 'Convidado',
          avatar: usuario?.avatar ?? null,
          email: usuario?.email ?? '',
        })
      }
    })
    return () => { supabase.removeChannel(ch) }
  }, [canal, usuario?.email, usuario?.nome, usuario?.avatar])

  // Mostra os OUTROS (exclui você) — é o que interessa: "quem mais está aqui".
  const outros = pessoas.filter((p) => p.key !== minhaKey)
  if (outros.length === 0) return null

  return (
    <div className="flex items-center gap-2" title="Pessoas nesta página agora">
      <div className="flex -space-x-2">
        {outros.slice(0, 5).map((p) => <Avatar key={p.key} pessoa={p} />)}
      </div>
      {outros.length > 5 && <span className="text-xs text-gray-400">+{outros.length - 5}</span>}
      <span className="text-xs text-gray-400 hidden sm:inline">
        {outros.length === 1 ? `${outros[0].nome} também está aqui` : `${outros.length} pessoas aqui`}
      </span>
    </div>
  )
}
