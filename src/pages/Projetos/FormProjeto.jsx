import { useState } from 'react'
import { Input, Select } from '../../components/UI/Input'
import Btn from '../../components/UI/Btn'

const TIPOS_ENSINO = ['Fundamental', 'Médio', 'Superior']
const MODELOS_CONTRATO = ['Assessoria', 'Produção']
const SEMESTRES = ['1', '2']

export default function FormProjeto({ projeto, onSalvar, onCancelar }) {
  const [form, setForm] = useState({
    tipoEnsino: projeto?.tipoEnsino || 'Superior',
    instituicao: projeto?.instituicao || '',
    curso: projeto?.curso || '',
    turma: projeto?.turma || '',
    anoOrcamento: projeto?.anoOrcamento || String(new Date().getFullYear()),
    anoRealizacao: projeto?.anoRealizacao || String(new Date().getFullYear() + 1),
    semestre: projeto?.semestre || '1',
    modeloContrato: projeto?.modeloContrato || 'Produção',
    totalAlunos: projeto?.totalAlunos || '',
    adesoesPrevistas: projeto?.adesoesPrevistas || '',
    pacoteBase: projeto?.pacoteBase || '',
    comissaoAlunos: projeto?.comissaoAlunos || '',
    cortesiasComissao: projeto?.cortesiasComissao || '',
    qtdConvidados: projeto?.qtdConvidados || '',
    convidadosPosBaile: projeto?.convidadosPosBaile || '0.7',
    ipcaAm: projeto?.ipcaAm || '0.0055',
    tempoContrato: projeto?.tempoContrato || '24',
    tempoFesta: projeto?.tempoFesta || '6',
    tempoPosBaile: projeto?.tempoPosBaile || '3',
    responsavelAlliance: projeto?.responsavelAlliance || '',
  })

  function set(campo, valor) {
    setForm(prev => ({ ...prev, [campo]: valor }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const nome = `${form.curso || 'Projeto'} — ${form.turma || form.anoRealizacao}`
    onSalvar({
      ...form,
      nome,
      totalAlunos: Number(form.totalAlunos) || 0,
      adesoesPrevistas: Number(form.adesoesPrevistas) || 0,
      pacoteBase: Number(form.pacoteBase) || 0,
      comissaoAlunos: Number(form.comissaoAlunos) || 0,
      cortesiasComissao: Number(form.cortesiasComissao) || 0,
      qtdConvidados: Number(form.qtdConvidados) || 0,
      convidadosPosBaile: Number(form.convidadosPosBaile) || 0.7,
      ipcaAm: Number(form.ipcaAm) || 0.0055,
      tempoContrato: Number(form.tempoContrato) || 24,
      tempoFesta: Number(form.tempoFesta) || 6,
      tempoPosBaile: Number(form.tempoPosBaile) || 3,
    })
  }

  return (
    <form onSubmit={handleSubmit} style={{ padding: 20 }}>
      <Secao titulo="Identificação">
        <Grid>
          <Select label="Tipo de Ensino *" value={form.tipoEnsino} onChange={v => set('tipoEnsino', v)} options={TIPOS_ENSINO} required />
          <Input label="Instituição de Ensino *" value={form.instituicao} onChange={v => set('instituicao', v)} required />
          <Input label="Curso *" value={form.curso} onChange={v => set('curso', v)} required />
          <Input label="Turma (OBS)" value={form.turma} onChange={v => set('turma', v)} />
        </Grid>
      </Secao>

      <Secao titulo="Datas e Contrato">
        <Grid>
          <Input label="Ano do Orçamento" value={form.anoOrcamento} onChange={v => set('anoOrcamento', v)} type="number" min="2020" max="2035" />
          <Input label="Ano de Realização (Previsto)" value={form.anoRealizacao} onChange={v => set('anoRealizacao', v)} type="number" min="2020" max="2035" />
          <Select label="Semestre (Previsto)" value={form.semestre} onChange={v => set('semestre', v)} options={SEMESTRES} />
          <Select label="Modelo de Contrato" value={form.modeloContrato} onChange={v => set('modeloContrato', v)} options={MODELOS_CONTRATO} />
          <Input label="Responsável Alliance" value={form.responsavelAlliance} onChange={v => set('responsavelAlliance', v)} />
        </Grid>
      </Secao>

      <Secao titulo="Dimensionamento">
        <Grid>
          <Input label="Total de Alunos na Turma" value={form.totalAlunos} onChange={v => set('totalAlunos', v)} type="number" min="0" />
          <Input label="Adesões Previstas" value={form.adesoesPrevistas} onChange={v => set('adesoesPrevistas', v)} type="number" min="0" />
          <Input label="Pacote Base p/ Cálculo" value={form.pacoteBase} onChange={v => set('pacoteBase', v)} type="number" min="0" />
          <Input label="Comissão Alunos" value={form.comissaoAlunos} onChange={v => set('comissaoAlunos', v)} type="number" min="0" />
          <Input label="Cortesias Comissão Alunos" value={form.cortesiasComissao} onChange={v => set('cortesiasComissao', v)} type="number" min="0" />
          <Input label="Qtde de Convidados Previstos" value={form.qtdConvidados} onChange={v => set('qtdConvidados', v)} type="number" min="0" />
          <Input label="Fator Convidados Pós Baile" value={form.convidadosPosBaile} onChange={v => set('convidadosPosBaile', v)} type="number" min="0" max="1" step="0.1" />
        </Grid>
      </Secao>

      <Secao titulo="Parâmetros Financeiros">
        <Grid>
          <Input label="IPCA a.m. (ex: 0.0055)" value={form.ipcaAm} onChange={v => set('ipcaAm', v)} type="number" min="0" max="0.1" step="0.0001" />
          <Input label="Tempo de Contrato (meses)" value={form.tempoContrato} onChange={v => set('tempoContrato', v)} type="number" min="1" max="120" />
          <Input label="Tempo de Festa (horas)" value={form.tempoFesta} onChange={v => set('tempoFesta', v)} type="number" min="1" max="24" />
          <Input label="Tempo de Pós Baile (horas)" value={form.tempoPosBaile} onChange={v => set('tempoPosBaile', v)} type="number" min="0" max="24" />
        </Grid>
      </Secao>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '16px 0 0', borderTop: '1px solid #2E3150', marginTop: 8 }}>
        <Btn variante="ghost" tipo="button" onClick={onCancelar}>Cancelar</Btn>
        <Btn tipo="submit">Salvar Projeto</Btn>
      </div>
    </form>
  )
}

function Secao({ titulo, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, borderBottom: '1px solid #2E3150', paddingBottom: 6 }}>
        {titulo}
      </div>
      {children}
    </div>
  )
}

function Grid({ children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
      {children}
    </div>
  )
}
