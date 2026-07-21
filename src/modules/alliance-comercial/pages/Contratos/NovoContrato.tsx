import { useRef, useState } from 'react'
import type { ReactNode, FormEvent } from 'react'
import { useGoogleLogin } from '@react-oauth/google'
import { supabaseComercial } from '../../lib/supabase'
import type { ProjetoData, PacoteData } from '../../lib/gerarContratos'
import { gerarTermoAdesao, gerarContratoComissao, downloadBlob } from '../../lib/gerarContratos'
import type { ResultadoImportacao } from '../../lib/googleSheets'
import { extrairSheetId, importarDadosTAP } from '../../lib/googleSheets'

type TipoDocumento = 'termo_adesao' | 'contrato_comissao' | 'ata_eleicao'

// ─── Tipos ────────────────────────────────────────────────────────────────

interface ProjetoForm {
  nome: string; instituicao: string; curso: string; turma: string
  semestre: string; tipo_contrato: string
  fee_percentual: string; fee_percentual_extenso: string; fee_valor_minimo: string
  fee_valor_minimo_extenso: string; fee_parcelas: string
  fee_valor_parcela: string; fee_valor_parcela_extenso: string
  fee_acrescimo_percentual: string; fee_acrescimo_percentual_extenso: string
  formandos_minimo: string
  local_data_extenso: string
  vigencia_meses_extenso: string
  retencao_faixa1_percentual: string
  retencao_faixa2_percentual: string
  retencao_faixa3_percentual: string
  retencao_faixa4_percentual: string
  retencao_faixa5_percentual: string
  retencao_faixa6_percentual: string
  valor_gatilho_irregularidade: string
  valor_gatilho_irregularidade_extenso: string
  data_assinatura: string
  verba_cerimonia: string
  verba_colacao: string
  preevento1_nome: string; preevento1_verba_pa: string; preevento1_verba_meta: string
  preevento2_nome: string; preevento2_verba_pa: string; preevento2_verba_meta: string
  preevento3_nome: string; preevento3_verba_pa: string; preevento3_verba_meta: string
  preevento4_nome: string; preevento4_verba_pa: string; preevento4_verba_meta: string
  preevento5_nome: string
}

interface LinhaPacote {
  nome: string
  valor: string
  arrecadacao_paralela: string
  valor_total_sem_ap: string
  mensalidade: string
  valor_total_estendido: string
  valor_total_estendido_12x_sem_ap: string
  mensalidade_estendida_12x: string
  valor_total_estendido_18x: string
  valor_total_estendido_18x_sem_ap: string
  mensalidade_estendida_18x: string
  qtd_parcelas: string
  eventos_inclusos: string
  valor_extenso: string
  is_base: boolean
}

const projetoInicial: ProjetoForm = {
  nome: '', instituicao: '', curso: '', turma: '', semestre: '',
  tipo_contrato: 'assessoria', fee_percentual: '', fee_percentual_extenso: '', fee_valor_minimo: '',
  fee_valor_minimo_extenso: '', fee_parcelas: '', fee_valor_parcela: '',
  fee_valor_parcela_extenso: '', fee_acrescimo_percentual: '', fee_acrescimo_percentual_extenso: '',
  formandos_minimo: '', local_data_extenso: '',
  vigencia_meses_extenso: 'sessenta e quatro',
  retencao_faixa1_percentual: '0.95',
  retencao_faixa2_percentual: '1.10',
  retencao_faixa3_percentual: '1.20',
  retencao_faixa4_percentual: '1.30',
  retencao_faixa5_percentual: '1.40',
  retencao_faixa6_percentual: '1.50',
  valor_gatilho_irregularidade: '30000',
  valor_gatilho_irregularidade_extenso: 'trinta mil reais', data_assinatura: '',
  verba_cerimonia: '', verba_colacao: '',
  preevento1_nome: '', preevento1_verba_pa: '', preevento1_verba_meta: '',
  preevento2_nome: '', preevento2_verba_pa: '', preevento2_verba_meta: '',
  preevento3_nome: '', preevento3_verba_pa: '', preevento3_verba_meta: '',
  preevento4_nome: '', preevento4_verba_pa: '', preevento4_verba_meta: '',
  preevento5_nome: '',
}

const linhaVazia: LinhaPacote = {
  nome: '', valor: '', arrecadacao_paralela: '', valor_total_sem_ap: '',
  mensalidade: '', valor_total_estendido: '', valor_total_estendido_12x_sem_ap: '',
  mensalidade_estendida_12x: '', valor_total_estendido_18x: '',
  valor_total_estendido_18x_sem_ap: '', mensalidade_estendida_18x: '',
  qtd_parcelas: '', eventos_inclusos: '', valor_extenso: '', is_base: false,
}

// ─── UI helpers ───────────────────────────────────────────────────────────

function Campo({ label, required, full, children }: {
  label: string; required?: boolean; full?: boolean; children: ReactNode
}) {
  return (
    <div className={`flex flex-col gap-1${full ? ' sm:col-span-2' : ''}`}>
      <label className="text-sm font-medium text-text-muted">
        {label}{required && <span className="text-primary ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

const base = 'border border-white/10 bg-bg text-text-main placeholder:text-text-muted rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary'
const cellInput = 'border border-white/10 bg-bg text-text-main rounded px-1.5 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-primary'
const cellInputWarn = 'border border-warning bg-warning/10 text-text-main rounded px-1.5 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-warning'
const btnPrimary = 'px-6 py-2 bg-primary hover:bg-primary/90 disabled:bg-primary/40 text-white font-medium rounded-md text-sm transition-colors'
const btnSecondary = 'px-4 py-2 border border-white/10 hover:border-white/20 text-text-muted hover:text-text-main rounded-md text-sm transition-colors'

type Step = 'projeto' | 'pacotes' | 'gerar'

function formToProjetoData(id: string, f: ProjetoForm): ProjetoData {
  const num = (s: string) => s.trim() ? parseFloat(s) : null
  const int = (s: string) => s.trim() ? parseInt(s, 10) : null
  const data = (s: string) => s.trim() || null
  return {
    id, nome: f.nome.trim(), instituicao: f.instituicao.trim(),
    turma: f.turma.trim() || null,
    semestre: f.semestre.trim() || null,
    fee_percentual: num(f.fee_percentual), fee_percentual_extenso: f.fee_percentual_extenso.trim() || null,
    fee_valor_minimo: num(f.fee_valor_minimo),
    fee_valor_minimo_extenso: f.fee_valor_minimo_extenso.trim() || null,
    fee_parcelas: int(f.fee_parcelas), fee_valor_parcela: num(f.fee_valor_parcela),
    fee_valor_parcela_extenso: f.fee_valor_parcela_extenso.trim() || null,
    fee_acrescimo_percentual: num(f.fee_acrescimo_percentual),
    fee_acrescimo_percentual_extenso: f.fee_acrescimo_percentual_extenso.trim() || null,
    formandos_minimo: int(f.formandos_minimo),
    local_data_extenso: f.local_data_extenso.trim() || null,
    vigencia_meses_extenso: f.vigencia_meses_extenso.trim() || null,
    retencao_faixa1_percentual: num(f.retencao_faixa1_percentual),
    retencao_faixa2_percentual: num(f.retencao_faixa2_percentual),
    retencao_faixa3_percentual: num(f.retencao_faixa3_percentual),
    retencao_faixa4_percentual: num(f.retencao_faixa4_percentual),
    retencao_faixa5_percentual: num(f.retencao_faixa5_percentual),
    retencao_faixa6_percentual: num(f.retencao_faixa6_percentual),
    valor_gatilho_irregularidade: num(f.valor_gatilho_irregularidade),
    valor_gatilho_irregularidade_extenso: f.valor_gatilho_irregularidade_extenso.trim() || null,
    data_assinatura: data(f.data_assinatura),
    verba_cerimonia: num(f.verba_cerimonia),
    verba_colacao: num(f.verba_colacao),
    preevento1_nome: f.preevento1_nome.trim() || null,
    preevento1_verba_pa: num(f.preevento1_verba_pa),
    preevento1_verba_meta: num(f.preevento1_verba_meta),
    preevento2_nome: f.preevento2_nome.trim() || null,
    preevento2_verba_pa: num(f.preevento2_verba_pa),
    preevento2_verba_meta: num(f.preevento2_verba_meta),
    preevento3_nome: f.preevento3_nome.trim() || null,
    preevento3_verba_pa: num(f.preevento3_verba_pa),
    preevento3_verba_meta: num(f.preevento3_verba_meta),
    preevento4_nome: f.preevento4_nome.trim() || null,
    preevento4_verba_pa: num(f.preevento4_verba_pa),
    preevento4_verba_meta: num(f.preevento4_verba_meta),
    preevento5_nome: f.preevento5_nome.trim() || null,
  }
}

// ─── Componente ───────────────────────────────────────────────────────────

export default function NovoContrato({ onGerado }: { onGerado: () => void }) {
  const [step, setStep]           = useState<Step>('projeto')
  const [projeto, setProjeto]     = useState<ProjetoForm>(projetoInicial)
  const [projetoId, setProjetoId] = useState<string>('')
  const [linhas, setLinhas]       = useState<LinhaPacote[]>([{ ...linhaVazia }])
  const [pacotes, setPacotes]     = useState<PacoteData[]>([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumento>('termo_adesao')

  const [linkPlanilha, setLinkPlanilha]       = useState('')
  const [importando, setImportando]           = useState(false)
  const [avisoImportacao, setAvisoImportacao] = useState<string | null>(null)
  const [pacotesComErro, setPacotesComErro]   = useState<string[]>([])
  const [accessToken, setAccessToken]         = useState<string | null>(null)

  // ── Autenticação Google (Sheets readonly) ──────────────────────────────

  const tokenResolveRef = useRef<((token: string) => void) | null>(null)
  const tokenRejectRef  = useRef<((err: Error) => void) | null>(null)

  const loginGoogle = useGoogleLogin({
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    onSuccess: (resp) => tokenResolveRef.current?.(resp.access_token),
    onError: () => tokenRejectRef.current?.(new Error('Autenticação Google cancelada ou falhou.')),
  })

  function obterAccessToken(): Promise<string> {
    return new Promise((resolve, reject) => {
      tokenResolveRef.current = resolve
      tokenRejectRef.current = reject
      loginGoogle()
    })
  }

  // ── Importação ────────────────────────────────────────────────────────

  async function importarPlanilha() {
    setAvisoImportacao(null); setPacotesComErro([]); setError(null)

    const sheetId = extrairSheetId(linkPlanilha.trim())
    if (!sheetId) {
      setError('Link inválido. Cole um link completo do Google Sheets (docs.google.com/spreadsheets/d/...).')
      return
    }

    setImportando(true)
    try {
      let token = accessToken
      if (!token) { token = await obterAccessToken(); setAccessToken(token) }

      let resultado: ResultadoImportacao
      try {
        resultado = await importarDadosTAP(sheetId, token)
      } catch (apiErr) {
        if (apiErr instanceof Error && apiErr.message === 'TOKEN_EXPIRADO') {
          token = await obterAccessToken()
          setAccessToken(token)
          resultado = await importarDadosTAP(sheetId, token)
        } else {
          throw apiErr
        }
      }

      const d = resultado.dados
      setProjeto(p => ({
        ...p,
        ...(d.instituicao       ? { instituicao:       d.instituicao       } : {}),
        ...(d.curso             ? { curso:             d.curso             } : {}),
        ...(d.turma             ? { turma:             d.turma             } : {}),
        ...(d.semestre          ? { semestre:          d.semestre          } : {}),
        ...(d.tipo_contrato     ? { tipo_contrato:     d.tipo_contrato     } : {}),
        ...(d.fee_percentual    ? { fee_percentual:    d.fee_percentual    } : {}),
        ...(d.fee_parcelas      ? { fee_parcelas:      d.fee_parcelas      } : {}),
        ...(d.fee_valor_parcela ? { fee_valor_parcela: d.fee_valor_parcela } : {}),
        ...(d.formandos_minimo  ? { formandos_minimo:  d.formandos_minimo  } : {}),
        ...(d.verba_cerimonia   ? { verba_cerimonia:   d.verba_cerimonia   } : {}),
        ...(d.verba_colacao     ? { verba_colacao:     d.verba_colacao     } : {}),
      }))

      if (resultado.preeventos.length > 0) {
        const [pe1, pe2, pe3, pe4, pe5] = resultado.preeventos
        setProjeto(p => ({
          ...p,
          ...(pe1 ? { preevento1_nome: pe1.nome, preevento1_verba_pa: pe1.verba_pa ?? '', preevento1_verba_meta: pe1.verba_meta ?? '' } : {}),
          ...(pe2 ? { preevento2_nome: pe2.nome, preevento2_verba_pa: pe2.verba_pa ?? '', preevento2_verba_meta: pe2.verba_meta ?? '' } : {}),
          ...(pe3 ? { preevento3_nome: pe3.nome, preevento3_verba_pa: pe3.verba_pa ?? '', preevento3_verba_meta: pe3.verba_meta ?? '' } : {}),
          ...(pe4 ? { preevento4_nome: pe4.nome, preevento4_verba_pa: pe4.verba_pa ?? '', preevento4_verba_meta: pe4.verba_meta ?? '' } : {}),
          ...(pe5 ? { preevento5_nome: pe5.nome } : {}),
        }))
      }

      if (resultado.pacotes.length > 0) {
        setLinhas(resultado.pacotes.map(p => ({
          nome: p.nome,
          valor:                          p.valor                          ?? '',
          arrecadacao_paralela:           p.arrecadacao_paralela           ?? '',
          valor_total_sem_ap:             p.valor_total_sem_ap             ?? '',
          mensalidade:                    p.mensalidade                    ?? '',
          valor_total_estendido:          p.valor_total_estendido          ?? '',
          valor_total_estendido_12x_sem_ap: p.valor_total_estendido_12x_sem_ap ?? '',
          mensalidade_estendida_12x:      p.mensalidade_estendida_12x      ?? '',
          valor_total_estendido_18x:      p.valor_total_estendido_18x      ?? '',
          valor_total_estendido_18x_sem_ap: p.valor_total_estendido_18x_sem_ap ?? '',
          mensalidade_estendida_18x:      p.mensalidade_estendida_18x      ?? '',
          qtd_parcelas: d.fee_parcelas ?? '',
          eventos_inclusos: '',
          valor_extenso: '',
          is_base: false,
        })))
      }

      const avisos: string[] = []
      if (d.camposNaoEncontrados.length > 0) {
        avisos.push(`Não encontrado: ${d.camposNaoEncontrados.join(', ')}.`)
      }
      if (resultado.pacotes.length === 0) {
        avisos.push('Tabela de pacotes não localizada — preencha manualmente na Etapa 2.')
      }
      setAvisoImportacao(avisos.length > 0 ? avisos.join(' ') : null)
      setPacotesComErro(resultado.pacotes.filter(p => p.temErro).map(p => p.nome))

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido na importação.')
    } finally {
      setImportando(false)
    }
  }

  // ── Step 1: salvar projeto ────────────────────────────────────────────

  async function salvarProjeto(e: FormEvent) {
    e.preventDefault(); setError(null)
    if (!projeto.nome.trim() || !projeto.instituicao.trim()) {
      setError('Preencha Nome do Projeto e Instituição.'); return
    }
    setLoading(true)
    const num = (s: string) => s.trim() ? parseFloat(s) : null
    const int = (s: string) => s.trim() ? parseInt(s, 10) : null
    const data_ = (s: string) => s.trim() || null
    const { data, error: err } = await supabaseComercial
      .from('projetos')
      .insert({
        nome: projeto.nome.trim(),
        instituicao: projeto.instituicao.trim(),
        curso: projeto.curso.trim() || null,
        turma: projeto.turma.trim() || null,
        semestre: projeto.semestre.trim() || null,
        tipo_contrato: projeto.tipo_contrato || null,
        fee_percentual:            num(projeto.fee_percentual),
        fee_percentual_extenso:    projeto.fee_percentual_extenso.trim() || null,
        fee_valor_minimo:          num(projeto.fee_valor_minimo),
        fee_valor_minimo_extenso:  projeto.fee_valor_minimo_extenso.trim() || null,
        fee_parcelas:              int(projeto.fee_parcelas),
        fee_valor_parcela:         num(projeto.fee_valor_parcela),
        fee_valor_parcela_extenso: projeto.fee_valor_parcela_extenso.trim() || null,
        fee_acrescimo_percentual:  num(projeto.fee_acrescimo_percentual),
        fee_acrescimo_percentual_extenso: projeto.fee_acrescimo_percentual_extenso.trim() || null,
        formandos_minimo:          int(projeto.formandos_minimo),
        local_data_extenso:        projeto.local_data_extenso.trim() || null,
        vigencia_meses_extenso:    projeto.vigencia_meses_extenso.trim() || null,
        retencao_faixa1_percentual:  num(projeto.retencao_faixa1_percentual),
        retencao_faixa2_percentual:  num(projeto.retencao_faixa2_percentual),
        retencao_faixa3_percentual:  num(projeto.retencao_faixa3_percentual),
        retencao_faixa4_percentual:  num(projeto.retencao_faixa4_percentual),
        retencao_faixa5_percentual:  num(projeto.retencao_faixa5_percentual),
        retencao_faixa6_percentual:  num(projeto.retencao_faixa6_percentual),
        valor_gatilho_irregularidade: num(projeto.valor_gatilho_irregularidade),
        valor_gatilho_irregularidade_extenso: projeto.valor_gatilho_irregularidade_extenso.trim() || null,
        data_assinatura:              data_(projeto.data_assinatura),
        verba_cerimonia:              num(projeto.verba_cerimonia),
        verba_colacao:                num(projeto.verba_colacao),
        preevento1_nome:              projeto.preevento1_nome.trim() || null,
        preevento1_verba_pa:          num(projeto.preevento1_verba_pa),
        preevento1_verba_meta:        num(projeto.preevento1_verba_meta),
        preevento2_nome:              projeto.preevento2_nome.trim() || null,
        preevento2_verba_pa:          num(projeto.preevento2_verba_pa),
        preevento2_verba_meta:        num(projeto.preevento2_verba_meta),
        preevento3_nome:              projeto.preevento3_nome.trim() || null,
        preevento3_verba_pa:          num(projeto.preevento3_verba_pa),
        preevento3_verba_meta:        num(projeto.preevento3_verba_meta),
        preevento4_nome:              projeto.preevento4_nome.trim() || null,
        preevento4_verba_pa:          num(projeto.preevento4_verba_pa),
        preevento4_verba_meta:        num(projeto.preevento4_verba_meta),
        preevento5_nome:              projeto.preevento5_nome.trim() || null,
      })
      .select('id')
      .single()
    setLoading(false)
    if (err) { setError(`Erro ao salvar projeto: ${err.message}`); return }
    setProjetoId(data.id)
    setStep('pacotes')
  }

  // ── Step 2: pacotes ────────────────────────────────────────────────────

  function atualizar(idx: number, campo: keyof LinhaPacote, valor: string) {
    setLinhas(prev => prev.map((l, i) => i === idx ? { ...l, [campo]: valor } : l))
  }

  function marcarComoBase(idx: number) {
    setLinhas(prev => prev.map((l, i) => ({ ...l, is_base: i === idx })))
  }

  async function salvarPacotes(e: FormEvent) {
    e.preventDefault(); setError(null)
    const validas = linhas.filter(l => l.nome.trim() && l.valor.trim())
    if (!validas.length) { setError('Adicione pelo menos um pacote com Nome e Valor Total.'); return }
    const invalido = validas.find(l => isNaN(parseFloat(l.valor)))
    if (invalido) { setError(`Valor Total inválido no pacote "${invalido.nome}".`); return }
    setLoading(true)
    const num = (s: string) => s.trim() ? parseFloat(s) : null
    const { data, error: err } = await supabaseComercial
      .from('pacotes')
      .insert(validas.map((l, idx) => ({
        projeto_id:                    projetoId,
        nome:                          l.nome.trim(),
        valor:                         parseFloat(l.valor),
        arrecadacao_paralela:          num(l.arrecadacao_paralela),
        valor_total_sem_ap:            num(l.valor_total_sem_ap),
        mensalidade:                   num(l.mensalidade),
        valor_total_estendido:         num(l.valor_total_estendido),
        valor_total_estendido_12x_sem_ap: num(l.valor_total_estendido_12x_sem_ap),
        mensalidade_estendida_12x:     num(l.mensalidade_estendida_12x),
        valor_total_estendido_18x:     num(l.valor_total_estendido_18x),
        valor_total_estendido_18x_sem_ap: num(l.valor_total_estendido_18x_sem_ap),
        mensalidade_estendida_18x:     num(l.mensalidade_estendida_18x),
        eventos_inclusos:              l.eventos_inclusos.trim() || null,
        valor_extenso:                 l.valor_extenso.trim() || null,
        qtd_parcelas:                  l.qtd_parcelas.trim() ? parseInt(l.qtd_parcelas, 10) : null,
        ordem:                         idx + 1,
        is_base:                       l.is_base,
      })))
      .select('id, nome, eventos_inclusos, valor, valor_extenso, qtd_parcelas, is_base')
    setLoading(false)
    if (err) { setError(`Erro ao salvar pacotes: ${err.message}`); return }
    setPacotes(data as PacoteData[])
    setStep('gerar')
  }

  // ── Step 3: gerar ─────────────────────────────────────────────────────

  async function gerarEBaixar() {
    setError(null); setLoading(true)
    const slug = projeto.nome.trim().replace(/\s+/g, '_')
    try {
      const pd = formToProjetoData(projetoId, projeto)

      if (tipoDocumento === 'termo_adesao') {
        const termoBlob = await gerarTermoAdesao(pd, pacotes)
        downloadBlob(termoBlob, `Termo_Adesao_${slug}.docx`)
        await supabaseComercial.from('documentos_gerados').insert(
          { projeto_id: projetoId, tipo_documento: 'termo_adesao', tipo_contrato: projeto.tipo_contrato },
        )
      } else if (tipoDocumento === 'contrato_comissao') {
        const contratoBlob = await gerarContratoComissao(pd, pacotes)
        downloadBlob(contratoBlob, `Contrato_Comissao_${slug}.docx`)
        await supabaseComercial.from('documentos_gerados').insert(
          { projeto_id: projetoId, tipo_documento: 'contrato_comissao', tipo_contrato: projeto.tipo_contrato },
        )
      }

      onGerado()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar documentos.')
    } finally {
      setLoading(false)
    }
  }

  function reiniciar() {
    setProjeto(projetoInicial); setLinhas([{ ...linhaVazia }]); setPacotes([])
    setProjetoId(''); setError(null); setLinkPlanilha('')
    setAvisoImportacao(null); setPacotesComErro([]); setStep('projeto')
    setTipoDocumento('termo_adesao')
  }

  // ── Render ────────────────────────────────────────────────────────────

  const badgeAtivo     = 'px-3 py-1 rounded-full text-sm font-medium bg-primary text-white'
  const badgeConcluido = 'px-3 py-1 rounded-full text-sm font-medium bg-success/15 text-success'
  const badgePendente  = 'px-3 py-1 rounded-full text-sm font-medium bg-white/5 text-text-muted'
  const card  = 'bg-surface rounded-xl border border-white/10 p-6 space-y-5'
  const secTitle = 'text-xs font-semibold text-text-main uppercase tracking-wider border-b border-white/10 pb-2'
  const th = 'px-2 py-1.5 text-xs font-semibold text-text-muted whitespace-nowrap border-b border-r border-white/10 bg-white/5 text-right'
  const thLeft = 'px-2 py-1.5 text-xs font-semibold text-text-muted whitespace-nowrap border-b border-r border-white/10 bg-white/5 text-left'
  const td = 'px-1 py-1 border-r border-white/5'

  return (
    <div className="space-y-6">
      {/* Progresso */}
      <div className="flex flex-wrap gap-2">
        <span className={step === 'projeto' ? badgeAtivo : badgeConcluido}>
          {step === 'projeto' ? '1. Projeto' : '✓ Projeto'}
        </span>
        <span className={step === 'pacotes' ? badgeAtivo : step === 'gerar' ? badgeConcluido : badgePendente}>
          {step === 'gerar' ? '✓ Pacotes' : '2. Pacotes'}
        </span>
        <span className={step === 'gerar' ? badgeAtivo : badgePendente}>
          3. Gerar Contratos
        </span>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/30 text-danger rounded-md px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* ══ STEP 1: Projeto ══ */}
      {step === 'projeto' && (
        <form onSubmit={salvarProjeto} className={card}>
          <h2 className="text-lg font-semibold text-text-main">Dados do Projeto</h2>

          {/* Importação */}
          <div className="bg-surface-2 border border-primary/20 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm font-semibold text-text-main">
                Importar dados da planilha P.O. <span className="font-normal text-text-muted">(opcional)</span>
              </p>
            </div>
            <div className="flex gap-2">
              <input
                className="border border-white/10 bg-bg text-text-main placeholder:text-text-muted rounded-md px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-primary"
                value={linkPlanilha}
                onChange={e => setLinkPlanilha(e.target.value)}
                placeholder="Cole o link do Google Sheets aqui…"
              />
              <button type="button" onClick={importarPlanilha}
                disabled={importando || !linkPlanilha.trim()}
                className="px-4 py-2 bg-primary hover:bg-primary/90 disabled:bg-primary/40 text-white font-medium rounded-md text-sm transition-colors whitespace-nowrap">
                {importando ? 'Importando…' : 'Importar dados'}
              </button>
            </div>
            {avisoImportacao && (
              <div className="bg-warning/10 border border-warning/30 rounded-md px-3 py-2 text-xs text-warning space-y-1">
                <p className="font-medium">Importação concluída com avisos:</p>
                <p>{avisoImportacao}</p>
              </div>
            )}
            {pacotesComErro.length > 0 && (
              <div className="bg-warning/10 border border-warning/30 rounded-md px-3 py-2 text-xs text-warning">
                <p className="font-medium mb-1">Campos com erro de fórmula na planilha (destacados na Etapa 2):</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {pacotesComErro.map((nome, i) => <li key={i}>{nome}</li>)}
                </ul>
              </div>
            )}
            {!avisoImportacao && !pacotesComErro.length && !importando && !linkPlanilha.trim() && (
              <p className="text-xs text-text-muted">
                Cole o link e clique em "Importar dados" para preencher o formulário automaticamente.
              </p>
            )}
          </div>

          {/* Identificação */}
          <p className={secTitle}>Identificação</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Campo label="Nome do Projeto" required>
              <input className={base} value={projeto.nome}
                onChange={e => setProjeto(p => ({ ...p, nome: e.target.value }))}
                placeholder="Ex: Turma Engenharia Civil 2026" />
            </Campo>
            <Campo label="Instituição" required>
              <input className={base} value={projeto.instituicao}
                onChange={e => setProjeto(p => ({ ...p, instituicao: e.target.value }))}
                placeholder="Ex: PUC Minas" />
            </Campo>
            <Campo label="Curso">
              <input className={base} value={projeto.curso}
                onChange={e => setProjeto(p => ({ ...p, curso: e.target.value }))}
                placeholder="Ex: Engenharia Civil" />
            </Campo>
            <Campo label="Turma / Obs">
              <input className={base} value={projeto.turma}
                onChange={e => setProjeto(p => ({ ...p, turma: e.target.value }))}
                placeholder="Ex: EC2026A" />
            </Campo>
            <Campo label="Semestre">
              <input className={base} value={projeto.semestre}
                onChange={e => setProjeto(p => ({ ...p, semestre: e.target.value }))}
                placeholder="Ex: 2026/1" />
            </Campo>
            <Campo label="Tipo de Contrato">
              <select className={base} value={projeto.tipo_contrato}
                onChange={e => setProjeto(p => ({ ...p, tipo_contrato: e.target.value }))}>
                <option value="assessoria">Assessoria</option>
                <option value="producao">Produção</option>
              </select>
            </Campo>
          </div>

          {/* FEE */}
          <p className={secTitle}>Condições do FEE</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Campo label="FEE (%)">
              <input type="number" step="0.01" min="0" className={base}
                value={projeto.fee_percentual}
                onChange={e => setProjeto(p => ({ ...p, fee_percentual: e.target.value }))}
                placeholder="Ex: 15.24" />
            </Campo>
            <Campo label="FEE (%) por extenso">
              <input className={base} value={projeto.fee_percentual_extenso}
                onChange={e => setProjeto(p => ({ ...p, fee_percentual_extenso: e.target.value }))}
                placeholder="Ex: quinze vírgula vinte e quatro por cento" />
            </Campo>
            <Campo label="Valor mínimo do FEE (R$)">
              <input type="number" step="0.01" min="0" className={base}
                value={projeto.fee_valor_minimo}
                onChange={e => setProjeto(p => ({ ...p, fee_valor_minimo: e.target.value }))}
                placeholder="Preenchimento manual" />
            </Campo>
            <Campo label="Valor mínimo por extenso" full>
              <input className={base} value={projeto.fee_valor_minimo_extenso}
                onChange={e => setProjeto(p => ({ ...p, fee_valor_minimo_extenso: e.target.value }))}
                placeholder="Ex: Quinze mil reais" />
            </Campo>
            <Campo label="Parcelas de Adesão">
              <input type="number" min="1" className={base}
                value={projeto.fee_parcelas}
                onChange={e => setProjeto(p => ({ ...p, fee_parcelas: e.target.value }))}
                placeholder="Ex: 9" />
            </Campo>
            <Campo label="Valor de Cada Adesão (R$)">
              <input type="number" step="0.01" min="0" className={base}
                value={projeto.fee_valor_parcela}
                onChange={e => setProjeto(p => ({ ...p, fee_valor_parcela: e.target.value }))}
                placeholder="Ex: 1500" />
            </Campo>
            <Campo label="Valor da Adesão por extenso" full>
              <input className={base} value={projeto.fee_valor_parcela_extenso}
                onChange={e => setProjeto(p => ({ ...p, fee_valor_parcela_extenso: e.target.value }))}
                placeholder="Ex: Um mil e quinhentos reais" />
            </Campo>
            <Campo label="Acréscimo última parcela (%)">
              <input type="number" step="0.01" min="0" className={base}
                value={projeto.fee_acrescimo_percentual}
                onChange={e => setProjeto(p => ({ ...p, fee_acrescimo_percentual: e.target.value }))}
                placeholder="Ex: 2" />
            </Campo>
            <Campo label="Acréscimo última parcela (%) por extenso">
              <input className={base} value={projeto.fee_acrescimo_percentual_extenso}
                onChange={e => setProjeto(p => ({ ...p, fee_acrescimo_percentual_extenso: e.target.value }))}
                placeholder="Ex: quatorze por cento" />
            </Campo>
            <Campo label="Mínimo de formandos (Adesões Previstas)">
              <input type="number" min="1" className={base}
                value={projeto.formandos_minimo}
                onChange={e => setProjeto(p => ({ ...p, formandos_minimo: e.target.value }))}
                placeholder="Ex: 80" />
            </Campo>
            <Campo label="Local e data de assinatura" full>
              <input className={base} value={projeto.local_data_extenso}
                onChange={e => setProjeto(p => ({ ...p, local_data_extenso: e.target.value }))}
                placeholder="Ex: Belo Horizonte, 23 de junho de 2026" />
            </Campo>
          </div>

          {/* Vigência e Retenção */}
          <p className={secTitle}>Vigência e Escala de Retenção (Cláusula 10 do Termo de Adesão)</p>
          <p className="text-xs text-text-muted -mt-3">
            O prazo de arrependimento (90 dias) e as datas de início/fim de cada faixa de
            retenção são calculados automaticamente no momento de gerar o documento: o prazo
            começa na data de hoje, e cada faixa é um bloco de 12 meses corridos a partir do
            fim do prazo de arrependimento. Só os percentuais abaixo são editáveis. A
            vigência do contrato é sempre igual ao "Parcelas de Adesão" definido em
            Condições do FEE — só informe abaixo como esse número é escrito por extenso.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Campo label="Vigência por extenso">
              <input className={base} value={projeto.vigencia_meses_extenso}
                onChange={e => setProjeto(p => ({ ...p, vigencia_meses_extenso: e.target.value }))}
                placeholder="Ex: sessenta e quatro" />
            </Campo>
          </div>

          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className={thLeft} style={{ minWidth: 90 }}>Faixa</th>
                  <th className={th} style={{ minWidth: 90 }}>% Retenção</th>
                </tr>
              </thead>
              <tbody>
                {([1, 2, 3, 4, 5, 6] as const).map(n => {
                  const kPct = `retencao_faixa${n}_percentual` as const
                  return (
                    <tr key={n} className={n % 2 === 0 ? 'bg-white/[0.02]' : ''}>
                      <td className={td}>Faixa {n}</td>
                      <td className={td}>
                        <input type="number" step="0.01" min="0" className={cellInput} value={projeto[kPct]}
                          onChange={e => setProjeto(p => ({ ...p, [kPct]: e.target.value }))} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Contrato Comissão (Piso Fixo) */}
          <p className={secTitle}>Contrato Comissão — Piso Fixo (reaproveita FEE/Meta acima)</p>
          <p className="text-xs text-text-muted -mt-3">
            As datas de vencimento das parcelas semestrais são calculadas automaticamente: a
            1ª parcela cai na "Data de assinatura" abaixo, e as seguintes a cada 6 meses, até
            completar o "Parcelas de Adesão" definido em Condições do FEE.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Campo label="Valor gatilho de irregularidade (R$)">
              <input type="number" step="0.01" min="0" className={base}
                value={projeto.valor_gatilho_irregularidade}
                onChange={e => setProjeto(p => ({ ...p, valor_gatilho_irregularidade: e.target.value }))} />
            </Campo>
            <Campo label="Valor gatilho de irregularidade por extenso">
              <input className={base} value={projeto.valor_gatilho_irregularidade_extenso}
                onChange={e => setProjeto(p => ({ ...p, valor_gatilho_irregularidade_extenso: e.target.value }))}
                placeholder="Ex: trinta mil reais" />
            </Campo>
            <Campo label="Data de assinatura do Contrato Comissão">
              <input type="date" className={base} value={projeto.data_assinatura}
                onChange={e => setProjeto(p => ({ ...p, data_assinatura: e.target.value }))} />
            </Campo>
          </div>

          {/* Anexo-Orçamentário: Verbas e Bolsa Folia */}
          <p className={secTitle}>Anexo-Orçamentário — Verbas e Bolsa Folia (Termo de Adesão)</p>
          <p className="text-xs text-text-muted -mt-3">
            Preenchidos automaticamente ao importar a planilha P.O. (verbas vêm de "Custo por
            formando" na aba RESUMO COMISSÃO; Bolsa Folia vem da seção PRÉ EVENTOS na aba
            REALIZAÇÃO ALLIANCE) — também editáveis manualmente.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Campo label="Verba Cerimônia Religiosa (R$)">
              <input type="number" step="0.01" min="0" className={base}
                value={projeto.verba_cerimonia}
                onChange={e => setProjeto(p => ({ ...p, verba_cerimonia: e.target.value }))} />
            </Campo>
            <Campo label="Verba Colação de Grau (R$)">
              <input type="number" step="0.01" min="0" className={base}
                value={projeto.verba_colacao}
                onChange={e => setProjeto(p => ({ ...p, verba_colacao: e.target.value }))} />
            </Campo>
          </div>

          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className={thLeft} style={{ minWidth: 90 }}>Pré-Evento</th>
                  <th className={thLeft} style={{ minWidth: 160 }}>Nome</th>
                  <th className={th} style={{ minWidth: 110 }}>Verba p/ Adesão</th>
                  <th className={th} style={{ minWidth: 110 }}>Verba Total na Meta</th>
                </tr>
              </thead>
              <tbody>
                {([1, 2, 3, 4] as const).map(n => {
                  const kNome = `preevento${n}_nome` as const
                  const kPa   = `preevento${n}_verba_pa` as const
                  const kMeta = `preevento${n}_verba_meta` as const
                  return (
                    <tr key={n} className={n % 2 === 0 ? 'bg-white/[0.02]' : ''}>
                      <td className={td}>Pré-Evento {n}</td>
                      <td className={td}>
                        <input className={cellInput} value={projeto[kNome]}
                          onChange={e => setProjeto(p => ({ ...p, [kNome]: e.target.value }))}
                          placeholder={`Nome do pré-evento ${n}`} />
                      </td>
                      <td className={td}>
                        <input type="number" step="0.01" min="0" className={cellInput} value={projeto[kPa]}
                          onChange={e => setProjeto(p => ({ ...p, [kPa]: e.target.value }))} />
                      </td>
                      <td className={td}>
                        <input type="number" step="0.01" min="0" className={cellInput} value={projeto[kMeta]}
                          onChange={e => setProjeto(p => ({ ...p, [kMeta]: e.target.value }))} />
                      </td>
                    </tr>
                  )
                })}
                <tr className="bg-white/[0.02]">
                  <td className={td}>Pré-Evento 5</td>
                  <td className={td}>
                    <input className={cellInput} value={projeto.preevento5_nome}
                      onChange={e => setProjeto(p => ({ ...p, preevento5_nome: e.target.value }))}
                      placeholder="Nome do pré-evento 5" />
                  </td>
                  <td className={td + ' text-text-muted'} colSpan={2}>cortesia Alliance</td>
                </tr>
              </tbody>
            </table>
          </div>

          <button type="submit" disabled={loading} className={btnPrimary}>
            {loading ? 'Salvando…' : 'Salvar Projeto →'}
          </button>
        </form>
      )}

      {/* ══ STEP 2: Pacotes ══ */}
      {step === 'pacotes' && (
        <form onSubmit={salvarPacotes} className={card}>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-text-main">Pacotes do Projeto</h2>
              <p className="text-xs text-text-muted mt-0.5">{projeto.nome} — {projeto.instituicao}</p>
            </div>
            <button type="button" onClick={reiniciar}
              className="text-xs text-text-muted hover:text-text-main underline">
              Novo contrato
            </button>
          </div>

          {linhas.some(l => l.nome.trim() && !l.valor.trim()) && (
            <div className="bg-warning/10 border border-warning/30 rounded-md px-3 py-2 text-xs text-warning">
              Campos destacados vieram com erro de fórmula na planilha. Preencha manualmente.
            </div>
          )}

          {/* Tabela de pacotes */}
          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className={th} style={{ minWidth: 50 }}>Base</th>
                  <th className={thLeft} style={{ minWidth: 160 }}>Pacote *</th>
                  <th className={th} style={{ minWidth: 90 }}>Total</th>
                  <th className={th} style={{ minWidth: 80 }}>A.P.</th>
                  <th className={th} style={{ minWidth: 90 }}>Total -A.P</th>
                  <th className={th} style={{ minWidth: 90 }}>Mensalidade</th>
                  <th className={th} style={{ minWidth: 90 }}>Total Ext.</th>
                  <th className={th} style={{ minWidth: 95 }}>Ext.12x -A.P</th>
                  <th className={th} style={{ minWidth: 80 }}>Mens.12x</th>
                  <th className={th} style={{ minWidth: 90 }}>Total 18x</th>
                  <th className={th} style={{ minWidth: 95 }}>18x -A.P</th>
                  <th className={th} style={{ minWidth: 80 }}>Mens.18x</th>
                  <th className={th} style={{ minWidth: 70 }}>Parcelas</th>
                  <th className={thLeft} style={{ minWidth: 170 }}>Eventos</th>
                  <th className={thLeft} style={{ minWidth: 140 }}>Por Extenso</th>
                  <th className="px-1 py-1.5 border-b border-white/10 bg-white/5" style={{ minWidth: 36 }}></th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l, idx) => {
                  const semValor = l.nome.trim() && !l.valor.trim()
                  return (
                    <tr key={idx} className={idx % 2 === 0 ? '' : 'bg-white/[0.02]'}>
                      <td className={td + ' text-center'}>
                        <input type="radio" name="pacote_base" checked={l.is_base}
                          onChange={() => marcarComoBase(idx)}
                          title="Usar como Pacote Base no Contrato Comissão" />
                      </td>
                      <td className={td}>
                        <input className={cellInput} value={l.nome}
                          onChange={e => atualizar(idx, 'nome', e.target.value)}
                          placeholder="Nome do pacote" />
                      </td>
                      <td className={td}>
                        <input className={semValor ? cellInputWarn : cellInput}
                          value={l.valor} onChange={e => atualizar(idx, 'valor', e.target.value)}
                          placeholder="0.00" />
                      </td>
                      <td className={td}>
                        <input className={cellInput} value={l.arrecadacao_paralela}
                          onChange={e => atualizar(idx, 'arrecadacao_paralela', e.target.value)}
                          placeholder="0.00" />
                      </td>
                      <td className={td}>
                        <input className={cellInput} value={l.valor_total_sem_ap}
                          onChange={e => atualizar(idx, 'valor_total_sem_ap', e.target.value)}
                          placeholder="0.00" />
                      </td>
                      <td className={td}>
                        <input className={cellInput} value={l.mensalidade}
                          onChange={e => atualizar(idx, 'mensalidade', e.target.value)}
                          placeholder="0.00" />
                      </td>
                      <td className={td}>
                        <input className={cellInput} value={l.valor_total_estendido}
                          onChange={e => atualizar(idx, 'valor_total_estendido', e.target.value)}
                          placeholder="0.00" />
                      </td>
                      <td className={td}>
                        <input className={cellInput} value={l.valor_total_estendido_12x_sem_ap}
                          onChange={e => atualizar(idx, 'valor_total_estendido_12x_sem_ap', e.target.value)}
                          placeholder="0.00" />
                      </td>
                      <td className={td}>
                        <input className={cellInput} value={l.mensalidade_estendida_12x}
                          onChange={e => atualizar(idx, 'mensalidade_estendida_12x', e.target.value)}
                          placeholder="0.00" />
                      </td>
                      <td className={td}>
                        <input className={cellInput} value={l.valor_total_estendido_18x}
                          onChange={e => atualizar(idx, 'valor_total_estendido_18x', e.target.value)}
                          placeholder="0.00" />
                      </td>
                      <td className={td}>
                        <input className={cellInput} value={l.valor_total_estendido_18x_sem_ap}
                          onChange={e => atualizar(idx, 'valor_total_estendido_18x_sem_ap', e.target.value)}
                          placeholder="0.00" />
                      </td>
                      <td className={td}>
                        <input className={cellInput} value={l.mensalidade_estendida_18x}
                          onChange={e => atualizar(idx, 'mensalidade_estendida_18x', e.target.value)}
                          placeholder="0.00" />
                      </td>
                      <td className={td}>
                        <input className={cellInput} value={l.qtd_parcelas}
                          onChange={e => atualizar(idx, 'qtd_parcelas', e.target.value)}
                          placeholder="9" />
                      </td>
                      <td className={td}>
                        <input className={cellInput} value={l.eventos_inclusos}
                          onChange={e => atualizar(idx, 'eventos_inclusos', e.target.value)}
                          placeholder="Jantar, Baile…" />
                      </td>
                      <td className={td}>
                        <input className={cellInput} value={l.valor_extenso}
                          onChange={e => atualizar(idx, 'valor_extenso', e.target.value)}
                          placeholder="Mil e duzentos reais" />
                      </td>
                      <td className="px-1 py-1 text-center">
                        {linhas.length > 1 && (
                          <button type="button"
                            onClick={() => setLinhas(prev => prev.filter((_, i) => i !== idx))}
                            className="text-danger/70 hover:text-danger text-xs leading-none">
                            ✕
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="button"
              onClick={() => setLinhas(prev => [...prev, { ...linhaVazia }])}
              className={btnSecondary}>
              + Adicionar pacote
            </button>
            <button type="submit" disabled={loading} className={btnPrimary}>
              {loading ? 'Salvando…' : 'Salvar Pacotes →'}
            </button>
          </div>
        </form>
      )}

      {/* ══ STEP 3: Gerar ══ */}
      {step === 'gerar' && (
        <div className={card}>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-text-main">Pronto para gerar</h2>
              <p className="text-xs text-text-muted mt-0.5">
                {projeto.nome} — {projeto.instituicao}
                {projeto.semestre && ` / ${projeto.semestre}`}
              </p>
            </div>
            <button type="button" onClick={reiniciar}
              className="text-xs text-text-muted hover:text-text-main underline">
              Novo contrato
            </button>
          </div>

          <div className="bg-bg rounded-lg p-4 space-y-2 border border-white/5">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">
              {pacotes.length} pacote{pacotes.length !== 1 ? 's' : ''} cadastrado{pacotes.length !== 1 ? 's' : ''}
            </p>
            <ul className="space-y-1">
              {pacotes.map(p => (
                <li key={p.id} className="text-sm text-text-main flex items-baseline gap-2">
                  <span className="font-medium text-text-main">{p.nome}</span>
                  <span className="text-text-muted">—</span>
                  <span>R$ {p.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  {p.qtd_parcelas && <span className="text-text-muted text-xs">({p.qtd_parcelas}x)</span>}
                </li>
              ))}
            </ul>
          </div>

          <Campo label="Tipo de documento">
            <select className={base} value={tipoDocumento}
              onChange={e => setTipoDocumento(e.target.value as TipoDocumento)}>
              <option value="termo_adesao">Termo de Adesão</option>
              <option value="contrato_comissao">Contrato Comissão</option>
              <option value="ata_eleicao" disabled>Ata Comissão (em breve)</option>
            </select>
          </Campo>

          <div className="border border-dashed border-white/10 rounded-lg p-4 space-y-1">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
              Mecanismo de geração
            </p>
            {tipoDocumento === 'termo_adesao' && (
              <p className="text-sm text-text-main">📄 Termo de Adesão — merge de placeholders (docxtemplater)</p>
            )}
            {tipoDocumento === 'contrato_comissao' && (
              <p className="text-sm text-text-main">📄 Contrato Comissão — merge de placeholders (docxtemplater), modelo Alliance × Comissão de Formatura</p>
            )}
          </div>

          <button onClick={gerarEBaixar} disabled={loading || tipoDocumento === 'ata_eleicao'}
            className="w-full py-3 bg-primary hover:bg-primary/90 disabled:bg-primary/40 text-white font-semibold rounded-lg text-sm transition-colors">
            {loading ? 'Gerando documento…' : '⬇  Gerar e Baixar'}
          </button>
        </div>
      )}
    </div>
  )
}
