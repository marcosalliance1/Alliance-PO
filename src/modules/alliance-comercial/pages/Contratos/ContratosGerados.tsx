import { useEffect, useState } from 'react'
import { supabaseComercial } from '../../lib/supabase'
import type { ProjetoData, PacoteData } from '../../lib/gerarContratos'
import {
  gerarTermoAdesao,
  gerarContratoComissao,
  downloadBlob,
} from '../../lib/gerarContratos'

interface CardData {
  projeto_id: string
  gerado_em: string
  projeto: ProjetoData
}

const btnOutline =
  'flex items-center gap-1.5 px-4 py-2 border-2 border-primary text-primary hover:bg-primary hover:text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

export default function ContratosGerados() {
  const [cards, setCards]         = useState<CardData[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro]           = useState<string | null>(null)
  const [baixandoId, setBaixandoId] = useState<string | null>(null)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setCarregando(true); setErro(null)
    const { data, error } = await supabaseComercial
      .from('documentos_gerados')
      .select(`
        projeto_id,
        gerado_em,
        projetos (
          id, nome, instituicao, semestre,
          fee_percentual, fee_valor_minimo, fee_valor_minimo_extenso,
          fee_parcelas, fee_valor_parcela, fee_valor_parcela_extenso,
          fee_acrescimo_percentual, formandos_minimo, local_data_extenso
        )
      `)
      .order('gerado_em', { ascending: false })

    if (error) { setErro(`Erro ao carregar: ${error.message}`); setCarregando(false); return }

    // deduplicar por projeto_id, mantendo a entrada mais recente
    const seen = new Set<string>()
    const unique: CardData[] = []
    for (const row of (data as unknown as Array<{ projeto_id: string; gerado_em: string; projetos: ProjetoData }>)) {
      if (!seen.has(row.projeto_id) && row.projetos) {
        seen.add(row.projeto_id)
        unique.push({ projeto_id: row.projeto_id, gerado_em: row.gerado_em, projeto: row.projetos })
      }
    }
    setCards(unique)
    setCarregando(false)
  }

  async function baixar(card: CardData, tipo: 'termo' | 'contrato') {
    const chave = `${card.projeto_id}-${tipo}`
    setBaixandoId(chave)
    try {
      const slug = card.projeto.nome.replace(/\s+/g, '_')

      if (tipo === 'termo') {
        const { data: pacotesRaw, error: errP } = await supabaseComercial
          .from('pacotes')
          .select('id, nome, eventos_inclusos, valor, valor_extenso, qtd_parcelas')
          .eq('projeto_id', card.projeto_id)
          .order('ordem')
        if (errP) throw new Error(`Erro ao carregar pacotes: ${errP.message}`)
        const blob = await gerarTermoAdesao(card.projeto, pacotesRaw as PacoteData[])
        downloadBlob(blob, `Termo_Adesao_${slug}.docx`)
      } else {
        const blob = await gerarContratoComissao(card.projeto)
        downloadBlob(blob, `Contrato_Comissao_${slug}.docx`)
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao gerar documento.')
    } finally {
      setBaixandoId(null)
    }
  }

  function formatarData(iso: string) {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-24 text-text-muted text-sm">
        Carregando contratos…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <button onClick={carregar}
          className="text-xs text-text-muted hover:text-text-main underline">
          Atualizar
        </button>
      </div>

      {erro && (
        <div className="bg-danger/10 border border-danger/30 text-danger rounded-md px-4 py-3 text-sm">
          {erro}
        </div>
      )}

      {cards.length === 0 && !erro && (
        <div className="bg-surface rounded-xl border border-dashed border-white/10 p-12 text-center space-y-2">
          <p className="text-text-muted text-sm">Nenhum contrato gerado ainda.</p>
          <p className="text-text-muted/70 text-xs">
            Cadastre um projeto na aba "Novo Contrato" e clique em "Gerar Contratos".
          </p>
        </div>
      )}

      <div className="space-y-3">
        {cards.map(card => (
          <div key={card.projeto_id}
            className="bg-surface rounded-xl border border-white/10 p-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">

              {/* Info do projeto */}
              <div className="space-y-1 min-w-0">
                <h3 className="font-semibold text-text-main text-base leading-tight truncate">
                  {card.projeto.nome}
                </h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-muted">
                  <span>{card.projeto.instituicao}</span>
                  {card.projeto.semestre && (
                    <>
                      <span className="text-text-muted/50">·</span>
                      <span>{card.projeto.semestre}</span>
                    </>
                  )}
                </div>
                <p className="text-xs text-text-muted/70">
                  Gerado em {formatarData(card.gerado_em)}
                </p>
              </div>

              {/* Botões de download */}
              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  onClick={() => baixar(card, 'termo')}
                  disabled={baixandoId !== null}
                  className={btnOutline}
                >
                  {baixandoId === `${card.projeto_id}-termo` ? (
                    <span>Gerando…</span>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Termo de Adesão
                    </>
                  )}
                </button>

                <button
                  onClick={() => baixar(card, 'contrato')}
                  disabled={baixandoId !== null}
                  className={btnOutline}
                >
                  {baixandoId === `${card.projeto_id}-contrato` ? (
                    <span>Gerando…</span>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Contrato Comissão
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
