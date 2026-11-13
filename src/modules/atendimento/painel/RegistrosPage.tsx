import { useCallback, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { Copy, FileDown, Filter, Pencil, Plus, Search, Trash2, Paperclip } from 'lucide-react'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { Toast } from '../../../components/ui/Toast'
import { categoriaPorSlug, corTag, type Campo, type Categoria } from './config'
import { RegistroModal } from './RegistroModal'
import { CalendarioAgenda } from './CalendarioAgenda'
import { nomeTurma, useProjetosOpcoes, useRegistros, type ProjetoOpcao, type Registro } from './useRegistros'

export function RegistrosPage() {
  const { slug } = useParams()
  const cat = categoriaPorSlug(slug)
  if (!cat) return <Navigate to="/atendimento" replace />
  if (cat.calendario) return <CalendarioAgenda cat={cat} />
  return <Lista key={cat.id} cat={cat} />
}

function formatarData(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

function textoCampo(r: Registro, c: Campo, projetos: ProjetoOpcao[]): string {
  if (c.type === 'turma') return nomeTurma(r, projetos)
  const v = r.dados[c.key]
  if (v == null || v === '') return ''
  if (c.type === 'memberList') return Array.isArray(v) && v.length ? `${v.length} membro${v.length > 1 ? 's' : ''}` : ''
  if (c.type === 'image') return 'anexado'
  // Aniversário sem ano (veio da planilha só com dia/mês): gravado como 1900-MM-DD, mostrado como DD/MM
  if (c.type === 'date' && String(v).startsWith('1900-')) return formatarData(String(v)).slice(0, 5)
  if (c.type === 'date') return formatarData(String(v))
  return String(v)
}

function Celula({ r, c, projetos }: { r: Registro; c: Campo; projetos: ProjetoOpcao[] }) {
  const t = textoCampo(r, c, projetos)
  if (!t) return <span className="text-text-muted/50">—</span>
  if (c.type === 'select') return <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${corTag(t, c)}`}>{t}</span>
  if (c.type === 'image') return <span className="inline-flex items-center gap-1 text-xs text-amber-400"><Paperclip size={12} /> anexado</span>
  if (c.type === 'textarea') return <span className="line-clamp-2 whitespace-pre-wrap">{t}</span>
  return <>{t}</>
}

function Lista({ cat }: { cat: Categoria }) {
  const { registros, carregando, erro, salvar, excluir } = useRegistros(cat)
  const projetos = useProjetosOpcoes()
  const [busca, setBusca] = useState('')
  const [filtros, setFiltros] = useState<Record<string, Set<string>>>({})
  const [filtroAberto, setFiltroAberto] = useState<string | null>(null)
  const [editando, setEditando] = useState<Registro | 'novo' | null>(null)
  const [apagando, setApagando] = useState<Registro | null>(null)
  const [toast, setToast] = useState<{ msg: string; tipo: 'sucesso' | 'erro' } | null>(null)

  const colunas = useMemo(() => cat.campos.filter(c => c.naTabela !== false), [cat])
  const fecharToast = useCallback(() => setToast(null), [])
  const filtraveis = (c: Campo) => c.type === 'select' || c.type === 'turma'

  const visiveis = useMemo(() => {
    let lista = registros
    const q = busca.trim().toLowerCase()
    if (q) lista = lista.filter(r => cat.campos.some(c => textoCampo(r, c, projetos).toLowerCase().includes(q)))
    for (const [key, valores] of Object.entries(filtros)) {
      const c = cat.campos.find(x => x.key === key)
      if (c && valores.size) lista = lista.filter(r => valores.has(textoCampo(r, c, projetos) || '(vazio)'))
    }
    if (cat.porAniversario) {
      lista = [...lista].sort((a, b) =>
        String(a.dados.aniversario ?? '').slice(5).padEnd(5, '9').localeCompare(String(b.dados.aniversario ?? '').slice(5).padEnd(5, '9')))
    }
    if (cat.fixavel) lista = [...lista].sort((a, b) => Number(b.fixado) - Number(a.fixado))
    return lista
  }, [registros, busca, filtros, cat, projetos])

  const ehFinalizado = (r: Registro) => !!cat.finalizados && !!r.status && cat.finalizados.includes(r.status)
  const abertos = visiveis.filter(r => !ehFinalizado(r))
  const finalizados = visiveis.filter(ehFinalizado)

  // Exportar PDF — igual ao painel original: abre uma janela de impressão com a tabela
  // da aba (o que está filtrado na tela) e a pessoa escolhe "Salvar como PDF".
  function exportarPdf() {
    const linhas = visiveis
    if (!linhas.length) { setToast({ msg: 'Não há dados nessa aba para exportar.', tipo: 'erro' }); return }
    const janela = window.open('', '_blank')
    if (!janela) { setToast({ msg: 'O navegador bloqueou a janela de impressão. Libere pop-ups para este site.', tipo: 'erro' }); return }
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const campos = cat.campos
    const cab = campos.map(c => `<th>${esc(c.label)}</th>`).join('')
    const corpo = linhas.map(r => `<tr>${campos.map(c => {
      const t = c.type === 'image' ? (r.dados[c.key] ? 'Anexado' : '') : textoCampo(r, c, projetos)
      return `<td>${t ? esc(t).replace(/\n/g, '<br>') : '—'}</td>`
    }).join('')}</tr>`).join('')
    const hoje = new Date().toLocaleDateString('pt-BR')
    janela.document.open()
    janela.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${esc(cat.label)} — Alliance</title>
<style>
  *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;margin:20px;color:#22262B}
  h1{font-size:19px;margin:0 0 2px;color:#E4212B} h2{font-size:14px;margin:0 0 4px;font-weight:600}
  .meta{font-size:11px;color:#666;margin-bottom:18px}
  table{width:100%;border-collapse:collapse;font-size:10.5px}
  th,td{border:1px solid #ddd;padding:6px 8px;text-align:left;vertical-align:top;word-break:break-word}
  th{background:#141414;color:#fff;font-weight:600} tr:nth-child(even) td{background:#FAFAFA}
  @media print{body{margin:10mm} @page{size:landscape;margin:10mm}}
</style></head><body>
<h1>Alliance</h1><h2>${esc(cat.label)}</h2>
<div class="meta">Exportado em ${hoje} · ${linhas.length} registro(s)</div>
<table><thead><tr>${cab}</tr></thead><tbody>${corpo}</tbody></table>
<script>window.onload=function(){window.focus();window.print()}</script>
</body></html>`)
    janela.document.close()
    setToast({ msg: 'Na janela que abriu, escolha "Salvar como PDF".', tipo: 'sucesso' })
  }

  async function copiar(texto: string) {
    try { await navigator.clipboard.writeText(texto); setToast({ msg: 'Texto copiado.', tipo: 'sucesso' }) }
    catch { setToast({ msg: 'Não foi possível copiar.', tipo: 'erro' }) }
  }

  async function confirmarExclusao() {
    if (!apagando) return
    try { await excluir(apagando); setToast({ msg: 'Registro excluído.', tipo: 'sucesso' }) }
    catch (e) { setToast({ msg: `Erro ao excluir: ${e instanceof Error ? e.message : e}`, tipo: 'erro' }) }
    setApagando(null)
  }

  function opcoesFiltro(c: Campo): string[] {
    return [...new Set(registros.map(r => textoCampo(r, c, projetos) || '(vazio)'))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }

  function alternarFiltro(key: string, valor: string) {
    setFiltros(f => {
      const s = new Set(f[key] ?? [])
      if (s.has(valor)) s.delete(valor); else s.add(valor)
      return { ...f, [key]: s }
    })
  }

  const acoes = (r: Registro) => (
    <div className="flex items-center gap-1 justify-end">
      {cat.copiavel && !!r.dados[cat.copiavel] && (
        <button title="Copiar texto" className="p-1.5 rounded-md text-text-muted hover:text-text-main hover:bg-white/5"
          onClick={e => { e.stopPropagation(); copiar(String(r.dados[cat.copiavel!])) }}><Copy size={15} /></button>
      )}
      <button title="Editar" className="p-1.5 rounded-md text-text-muted hover:text-text-main hover:bg-white/5"
        onClick={e => { e.stopPropagation(); setEditando(r) }}><Pencil size={15} /></button>
      <button title="Excluir" className="p-1.5 rounded-md text-text-muted hover:text-danger hover:bg-white/5"
        onClick={e => { e.stopPropagation(); setApagando(r) }}><Trash2 size={15} /></button>
    </div>
  )

  const tabela = (lista: Registro[]) => (
    <>
      {/* PC: tabela */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10.5px] uppercase tracking-wider text-text-muted border-b border-white/10">
              {colunas.map(c => (
                <th key={c.key} className="text-left font-semibold px-3 py-2.5 whitespace-nowrap relative">
                  <span className="inline-flex items-center gap-1">
                    {c.label}
                    {filtraveis(c) && (
                      <button title="Filtrar" onClick={() => setFiltroAberto(a => (a === c.key ? null : c.key))}
                        className={`p-0.5 rounded ${filtros[c.key]?.size ? 'text-primary bg-primary/15' : 'text-text-muted/60 hover:text-text-main'}`}>
                        <Filter size={11} />
                      </button>
                    )}
                  </span>
                  {filtroAberto === c.key && (
                    <div className="absolute z-30 top-full left-2 mt-1 w-56 max-h-72 overflow-y-auto bg-surface border border-white/10 rounded-lg shadow-card p-2 normal-case tracking-normal text-xs font-normal text-text-main">
                      <div className="flex gap-1 pb-2 mb-1 border-b border-white/10">
                        <button className="flex-1 px-2 py-1 rounded bg-white/5 hover:bg-white/10" onClick={() => setFiltros(f => ({ ...f, [c.key]: new Set() }))}>Limpar</button>
                        <button className="flex-1 px-2 py-1 rounded bg-white/5 hover:bg-white/10" onClick={() => setFiltroAberto(null)}>Fechar</button>
                      </div>
                      {opcoesFiltro(c).map(o => (
                        <label key={o} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-white/5 cursor-pointer">
                          <input type="checkbox" checked={!!filtros[c.key]?.has(o)} onChange={() => alternarFiltro(c.key, o)} />
                          <span className="truncate">{o}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {lista.map(r => (
              <tr key={r.id} onClick={() => setEditando(r)}
                className={`border-b border-white/5 last:border-0 cursor-pointer ${r.fixado ? 'bg-primary/10 hover:bg-primary/15' : 'hover:bg-white/[0.03]'}`}>
                {colunas.map((c, i) => (
                  <td key={c.key} className="px-3 py-2.5 align-top max-w-[240px] text-text-main">
                    {i === 0 && r.fixado && '📌 '}<Celula r={r} c={c} projetos={projetos} />
                  </td>
                ))}
                <td className="px-2 py-2 align-top">{acoes(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Celular: cartões */}
      <div className="md:hidden divide-y divide-white/5">
        {lista.map(r => (
          <div key={r.id} onClick={() => setEditando(r)} className={`p-3 ${r.fixado ? 'bg-primary/10' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="font-semibold text-text-main text-sm">
                {r.fixado && '📌 '}{textoCampo(r, colunas[0], projetos) || '—'}
              </div>
              {acoes(r)}
            </div>
            <div className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              {colunas.slice(1).map(c => textoCampo(r, c, projetos) ? (
                <div key={c.key} className="contents">
                  <span className="text-text-muted">{c.label}</span>
                  <span className="text-text-main min-w-0 break-words"><Celula r={r} c={c} projetos={projetos} /></span>
                </div>
              ) : null)}
            </div>
          </div>
        ))}
      </div>
    </>
  )

  const filtrosAtivos = Object.values(filtros).some(s => s.size)

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-text-main">{cat.label}</h1>
          <p className="text-sm text-text-muted mt-1 max-w-xl">{cat.subtitulo}</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-60">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar..."
              className="w-full bg-surface border border-white/10 rounded-lg pl-8 pr-3 py-2 text-sm text-text-main focus:outline-none focus:border-primary/60" />
          </div>
          <button className="btn-secondary inline-flex items-center gap-1 shrink-0" title="Exportar PDF" onClick={exportarPdf}>
            <FileDown size={15} /> <span className="hidden sm:inline">PDF</span>
          </button>
          <button className="btn-primary inline-flex items-center gap-1 shrink-0" onClick={() => setEditando('novo')}>
            <Plus size={15} /> Novo
          </button>
        </div>
      </div>

      {filtrosAtivos && (
        <div className="mb-3 text-xs text-text-muted flex items-center gap-2">
          Filtros ativos.
          <button className="text-primary hover:underline" onClick={() => setFiltros({})}>Limpar todos</button>
        </div>
      )}

      {erro && <div className="mb-4 text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-4 py-3">{erro}</div>}

      <div className="bg-surface rounded-[12px] border border-white/10 overflow-visible">
        {carregando && registros.length === 0 ? (
          <div className="p-10 text-center text-sm text-text-muted">Carregando…</div>
        ) : abertos.length === 0 ? (
          <div className="p-10 text-center">
            {!registros.length ? (
              <>
                <p className="text-text-main font-semibold">Nenhum registro ainda</p>
                <p className="text-sm text-text-muted mt-1">Clique em "+ Novo" para começar.</p>
              </>
            ) : busca.trim() || filtrosAtivos ? (
              <>
                <p className="text-text-main font-semibold">Nada encontrado</p>
                <p className="text-sm text-text-muted mt-1">Ajuste a busca ou os filtros.</p>
              </>
            ) : (
              <>
                <p className="text-text-main font-semibold">Nenhum registro em aberto</p>
                <p className="text-sm text-text-muted mt-1">Os concluídos estão em "Finalizados", logo abaixo.</p>
              </>
            )}
          </div>
        ) : tabela(abertos)}
      </div>

      {finalizados.length > 0 && (
        <details className="mt-4 bg-surface rounded-[12px] border border-white/10 overflow-hidden group">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-text-muted flex items-center gap-2">
            <span className="transition-transform group-open:rotate-90">▸</span>
            Finalizados
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5">{finalizados.length}</span>
          </summary>
          <div className="border-t border-white/10 opacity-90">{tabela(finalizados)}</div>
        </details>
      )}

      {editando && (
        <RegistroModal
          cat={cat}
          registro={editando === 'novo' ? null : editando}
          projetos={projetos}
          onFechar={() => setEditando(null)}
          onSalvar={async (dados, turma, fixado) => {
            await salvar(editando === 'novo' ? null : editando.id, dados, turma, fixado)
            setToast({ msg: editando === 'novo' ? 'Registro criado.' : 'Alterações salvas.', tipo: 'sucesso' })
          }}
        />
      )}

      <ConfirmDialog
        open={!!apagando}
        title="Excluir registro"
        message="Tem certeza? O registro e os anexos dele serão apagados e não dá para desfazer."
        confirmLabel="Excluir"
        danger
        onConfirm={confirmarExclusao}
        onCancel={() => setApagando(null)}
      />

      {toast && <Toast mensagem={toast.msg} tipo={toast.tipo} onFechar={fecharToast} />}
    </div>
  )
}
