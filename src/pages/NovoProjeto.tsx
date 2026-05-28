import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import type { TAP, TipoEscola } from '../types'
import { TAPForm } from '../components/projeto/TAPForm'
import { Header } from '../components/layout/Header'
import { ArrowLeft, Cloud, Loader, Link } from 'lucide-react'
import { useGoogleAuth } from '../contexts/GoogleAuthContext'
import { useAuth } from '../contexts/AuthContext'
import { lerTAPDeSheets, extrairSpreadsheetId } from '../utils/sheetsSync'

interface NovoProjetoProps {
  onCriar: (tap: TAP, sheetsUrl?: string) => Promise<{ id: string }>
  ipcaPadrao: number
}

function tapInicial(ipca: number): TAP {
  return {
    instituicao: '',
    curso: '',
    turma: '',
    tipoEscola: 'MEDIO' as TipoEscola,
    anoOrcamento: new Date().getFullYear(),
    anoRealizacao: new Date().getFullYear() + 1,
    modeloContrato: '',
    qtdFormandos: 0,
    pacoteBase: '',
    adesoesPrevistas: 0,
    qtdConvidadosBaile: 0,
    qtdConvidadosPosBaile: 0,
    ipca,
    parcelas: 12,
    tempoContrato: '',
    tempoDeFesta: '',
    pacotes: [],
    dataEvento: '',
    local: '',
  }
}

export function NovoProjeto({ onCriar, ipcaPadrao }: NovoProjetoProps) {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const { accessToken, conectar, logando } = useGoogleAuth()

  if (!isAdmin) return <Navigate to="/projetos" replace />

  const [tap, setTap] = useState<TAP>(tapInicial(ipcaPadrao))
  const [tapVersion, setTapVersion] = useState(0)  // muda ao carregar do Sheets → força remount do TAPForm
  const [sheetsUrl, setSheetsUrl] = useState('')
  const [carregandoSheets, setCarregandoSheets] = useState(false)
  const [sheetsErro, setSheetsErro] = useState('')
  const [sheetsOk, setSheetsOk] = useState(false)

  async function carregarDoSheets() {
    const id = extrairSpreadsheetId(sheetsUrl)
    if (!id) { setSheetsErro('URL inválida. Cole o link completo da planilha Google Sheets.'); return }
    setSheetsErro('')

    if (!accessToken) { conectar(); return }

    setCarregandoSheets(true)
    try {
      const tapParcial = await lerTAPDeSheets(id, accessToken)

      const camposEncontrados = Object.keys(tapParcial).length
      if (camposEncontrados === 0) {
        setSheetsErro('Aba de TAP/Simulador não encontrada ou sem dados reconhecíveis.')
        return
      }

      // Merge: tapParcial só contém campos encontrados (sem zeros/vazios)
      // então o spread não apaga os defaults do tapInicial
      const tapAtualizado: TAP = { ...tapInicial(ipcaPadrao), ...tapParcial }
      setTap(tapAtualizado)
      setTapVersion(v => v + 1)  // força o TAPForm a remontar com os novos valores
      setSheetsOk(true)
    } catch (e) {
      setSheetsErro((e as Error).message ?? 'Erro ao ler planilha.')
    } finally {
      setCarregandoSheets(false)
    }
  }

  async function handleCriar() {
    if (!tap.instituicao.trim() && !tap.turma.trim()) {
      alert('Preencha ao menos a Instituição ou Turma.')
      return
    }
    const spreadsheetId = extrairSpreadsheetId(sheetsUrl)
    const p = await onCriar(tap, spreadsheetId ? sheetsUrl : undefined)
    navigate(`/projetos/${p.id}`)
  }

  return (
    <div>
      <Header
        title="Novo Projeto"
        actions={
          <>
            <button className="btn-secondary flex items-center gap-2" onClick={() => navigate('/projetos')}>
              <ArrowLeft size={15} /> Cancelar
            </button>
            <button className="btn-primary" onClick={handleCriar}>
              Criar Projeto
            </button>
          </>
        }
      />

      {/* Sheets URL */}
      <div className="card mb-6">
        <h3 className="text-sm font-semibold text-text-main mb-1 flex items-center gap-2">
          <Cloud size={15} className="text-primary" />
          Importar do Google Sheets (opcional)
        </h3>
        <p className="text-text-muted text-xs mb-3">
          Cole o link da planilha para preencher automaticamente o TAP, receitas e custos.
        </p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="url"
              value={sheetsUrl}
              onChange={e => { setSheetsUrl(e.target.value); setSheetsOk(false); setSheetsErro('') }}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="w-full bg-surface-2 border border-white/10 rounded-inner pl-8 pr-3 py-2 text-sm text-text-main focus:outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={carregarDoSheets}
            disabled={carregandoSheets || logando || !sheetsUrl.trim()}
            className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-40"
          >
            {carregandoSheets
              ? <><Loader size={13} className="animate-spin" /> Carregando...</>
              : !accessToken
                ? <><Cloud size={13} /> Conectar e Carregar</>
                : <><Cloud size={13} /> Carregar do Sheets</>
            }
          </button>
        </div>
        {sheetsErro && <p className="text-danger text-xs mt-2">{sheetsErro}</p>}
        {sheetsOk && <p className="text-success text-xs mt-2">✓ TAP carregado — revise os campos abaixo.</p>}
      </div>

      {/* key={tapVersion} força remount quando dados chegam do Sheets */}
      <TAPForm key={tapVersion} tap={tap} onChange={setTap} />
    </div>
  )
}
