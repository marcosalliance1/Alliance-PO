import { useMemo } from 'react'
import type { Projeto } from '../../types'
import { padronizarCaixa } from '../../utils/caixa'

// Seletor de turma agrupado por "ano de realização · ensino" (igual ao filtro do painel do SGE).
const ENSINO: Record<string, string> = { SUPERIOR: 'Superior', MEDIO: 'Médio', FUNDAMENTAL: 'Fundamental' }
const ORDEM = ['Superior', 'Médio', 'Fundamental']

export function SeletorProjeto({ projetos, atualId, onChange }: { projetos: Projeto[]; atualId: string; onChange: (id: string) => void }) {
  const grupos = useMemo(() => {
    const m = new Map<string, { ano: number; ens: string; rotulo: string; itens: Projeto[] }>()
    for (const p of projetos) {
      const ano = Number(p.tap.anoRealizacao) || 0
      const ens = ENSINO[String(p.tap.tipoEscola || '').toUpperCase()] ?? String(p.tap.tipoEscola || 'Outros')
      const k = `${ano}|${ens}`
      if (!m.has(k)) m.set(k, { ano, ens, rotulo: `${ano || 'Sem ano'} · ${ens}`, itens: [] })
      m.get(k)!.itens.push(p)
    }
    for (const g of m.values()) g.itens.sort((a, b) => (a.tap.turma || '').localeCompare(b.tap.turma || ''))
    return [...m.values()].sort((a, b) => a.ano - b.ano || ORDEM.indexOf(a.ens) - ORDEM.indexOf(b.ens))
  }, [projetos])

  return (
    <select
      value={atualId}
      onChange={e => onChange(e.target.value)}
      title="Trocar de turma — agrupadas por ano de realização e ensino"
      className="rounded-lg border border-[#cfd5df] bg-white px-3 py-2 text-[13px] font-semibold text-[#1e2430]"
      style={{ minWidth: 200, maxWidth: '100%' }}
    >
      {grupos.map(g => (
        <optgroup key={g.rotulo} label={g.rotulo}>
          {g.itens.map(p => <option key={p.id} value={p.id}>{padronizarCaixa(p.tap.turma || p.id)}</option>)}
        </optgroup>
      ))}
    </select>
  )
}
