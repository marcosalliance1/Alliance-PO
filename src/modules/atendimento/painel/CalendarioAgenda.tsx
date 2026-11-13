import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import type { Categoria } from './config'

// Calendário = Google Agenda da equipe embutida (como no painel original).
// O link fica num registro categoria 'config' em atendimento_registros.

// Mesma extração do painel original (aceita o <iframe ...> inteiro ou o link),
// mas só aceita links da Google Agenda — evita embutir qualquer site no painel.
function extrairLinkAgenda(entrada: string): string {
  const t = (entrada || '').trim()
  if (!t) return ''
  const m = t.match(/src="([^"]+)"/)
  const url = m ? m[1].replace(/&amp;/g, '&') : t
  return /^https:\/\/calendar\.google\.com\/calendar\/(u\/\d+\/)?embed\?/.test(url) ? url : ''
}

export function CalendarioAgenda({ cat }: { cat: Categoria }) {
  const [configId, setConfigId] = useState<string | null>(null)
  const [dadosConfig, setDadosConfig] = useState<Record<string, unknown>>({})
  const [link, setLink] = useState('')
  const [entrada, setEntrada] = useState('')
  const [editando, setEditando] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    supabase.from('atendimento_registros').select('id, dados').eq('categoria', 'config').limit(1).maybeSingle()
      .then(({ data, error }) => {
        if (error) setErro(`Não foi possível carregar: ${error.message}`)
        else if (data) {
          setConfigId(data.id)
          const d = (data.dados ?? {}) as Record<string, unknown>
          setDadosConfig(d)
          setLink(String(d.googleCalendarEmbedUrl ?? ''))
        }
        setCarregando(false)
      })
  }, [])

  async function gravar(novo: string) {
    setSalvando(true)
    setErro(null)
    const dados = { ...dadosConfig, googleCalendarEmbedUrl: novo }
    const q = configId
      ? supabase.from('atendimento_registros').update({ dados }).eq('id', configId).select('id').single()
      : supabase.from('atendimento_registros').insert({ categoria: 'config', dados }).select('id').single()
    const { data, error } = await q
    setSalvando(false)
    if (error) { setErro(`Não salvei: ${error.message}`); return }
    setConfigId(data.id)
    setDadosConfig(dados)
    setLink(novo)
    setEditando(false)
    setEntrada('')
  }

  function salvar() {
    const url = extrairLinkAgenda(entrada)
    if (!url) { setErro('Link inválido. Cole o código <iframe> ou o link que começa com https://calendar.google.com/calendar/embed?…'); return }
    gravar(url)
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-text-main">{cat.label}</h1>
          <p className="text-sm text-text-muted mt-1">{cat.subtitulo}</p>
        </div>
        {link && !editando && (
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => { setEditando(true); setEntrada(link) }}>Trocar agenda</button>
            <button className="btn-secondary" disabled={salvando} onClick={() => gravar('')}>Remover</button>
          </div>
        )}
      </div>

      {erro && <div className="mb-4 text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-4 py-3">{erro}</div>}

      {carregando ? (
        <div className="p-10 text-center text-sm text-text-muted">Carregando…</div>
      ) : link && !editando ? (
        <div className="bg-white rounded-[12px] overflow-hidden border border-white/10">
          <iframe title="Google Agenda" src={link} className="w-full h-[70vh] min-h-[480px] border-0" />
        </div>
      ) : (
        <div className="bg-surface rounded-[12px] border border-white/10 p-6 max-w-2xl">
          <h2 className="font-semibold text-text-main mb-1">Vincular Google Agenda</h2>
          <p className="text-sm text-text-muted mb-4">
            Na Google Agenda: Configurações → escolha a agenda → "Integrar agenda" → copie o "Código de incorporação" e cole aqui.
          </p>
          <textarea value={entrada} onChange={e => setEntrada(e.target.value)} rows={4}
            placeholder='<iframe src="https://calendar.google.com/calendar/embed?src=..." ...></iframe>'
            className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-text-main focus:outline-none focus:border-primary/60" />
          <div className="flex gap-2 mt-3">
            <button className="btn-primary disabled:opacity-50" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar'}</button>
            {editando && <button className="btn-secondary" onClick={() => { setEditando(false); setErro(null) }}>Cancelar</button>}
          </div>
        </div>
      )}
    </div>
  )
}
