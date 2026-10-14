import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import EspelhoAcomp from './EspelhoAcomp'
import type { GradeAcomp } from '../../utils/espelhoAcomp'

// Aba "Acomp. Atendimento": espelho da aba de mesmo nome da planilha do projeto. O dado vem da tabela
// projeto_acomp, gravada pelo sync automático (sync_pos.js) — o botão "Sincronizar" do navegador não a
// atualiza. Edição é sempre na planilha (cada bloco tem o link).

interface Linha { grade: { rows: GradeAcomp['rows']; merges: GradeAcomp['merges'] }; gid: number; sheet_id: string; atualizado_em: string }

function haQuanto(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (min < 2) return 'agora há pouco'
  if (min < 60) return `há ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.round(h / 24)
  return `há ${d} ${d === 1 ? 'dia' : 'dias'}`
}

export function AbaAcompAtendimento({ projetoId, sheetsUrl }: { projetoId: string; sheetsUrl?: string }) {
  const [estado, setEstado] = useState<'carregando' | 'ok' | 'vazio' | 'erro'>('carregando')
  const [dados, setDados] = useState<Linha | null>(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    let vivo = true
    setEstado('carregando')
    supabase
      .from('projeto_acomp')
      .select('grade, gid, sheet_id, atualizado_em')
      .eq('projeto_id', projetoId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!vivo) return
        if (error) { setMsg(error.message); setEstado('erro'); return }
        if (!data) { setEstado('vazio'); return }
        setDados(data as Linha)
        setEstado('ok')
      })
    return () => { vivo = false }
  }, [projetoId])

  const caixa = 'rounded-md border border-[#e2e6ec] bg-white px-4 py-6 text-[13px] text-[#1e2430]'

  if (estado === 'carregando') return <div className={caixa}>Carregando o espelho…</div>
  if (estado === 'erro') return <div className={caixa} style={{ color: '#c0392b' }}>Não consegui ler o espelho: {msg}</div>
  if (estado === 'vazio' || !dados) {
    return (
      <div className={caixa}>
        <p className="font-semibold">O espelho deste projeto ainda não foi gerado.</p>
        <p className="mt-1 text-[12px] text-[#64707f]">
          Ele é criado pela sincronização automática das planilhas (a cada ~3h30, com o computador ligado) e aparece aqui na próxima rodada.
          {sheetsUrl ? ' Enquanto isso, a aba continua na planilha.' : ' Este projeto também não tem planilha vinculada.'}
        </p>
        {sheetsUrl && (
          <a href={sheetsUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-[12px] font-semibold text-[#4a72b0] underline">Abrir a planilha</a>
        )}
      </div>
    )
  }

  const grade: GradeAcomp = { rows: dados.grade.rows, merges: dados.grade.merges, gid: dados.gid, sheetId: dados.sheet_id }
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-[#64707f]">
        Espelho da planilha, atualizado {haQuanto(dados.atualizado_em)} pela sincronização automática. Para editar, use o link de cada bloco.
      </p>
      <EspelhoAcomp grade={grade} tema="claro" />
    </div>
  )
}
