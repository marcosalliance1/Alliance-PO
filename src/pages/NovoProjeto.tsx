import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { TAP, TipoEscola } from '../types'
import { TAPForm } from '../components/projeto/TAPForm'
import { Header } from '../components/layout/Header'
import { ArrowLeft } from 'lucide-react'

interface NovoProjetoProps {
  onCriar: (tap: TAP) => Promise<{ id: string }>
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
  const [tap, setTap] = useState<TAP>(tapInicial(ipcaPadrao))

  async function handleCriar() {
    if (!tap.instituicao.trim() && !tap.turma.trim()) {
      alert('Preencha ao menos a Instituição ou Turma.')
      return
    }
    const p = await onCriar(tap)
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
      <TAPForm tap={tap} onChange={setTap} />
    </div>
  )
}
