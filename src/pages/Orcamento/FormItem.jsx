import { useState } from 'react'
import { Input, Select } from '../../components/UI/Input'
import Btn from '../../components/UI/Btn'
import { calcularProjetado } from '../../utils/calculadora'

const MOSCOW_OPTIONS = ['M', 'S', 'C', 'W']
const DEF_CUSTO_OPTIONS = ['Custo Fixo', 'Custo Variável']
const STATUS_OPTIONS = ['Em aberto', 'Orçando', 'Estimado', 'Fechado']

export default function FormItem({ item, secao, projeto, onSalvar, onCancelar }) {
  const [form, setForm] = useState({
    codigo: item?.codigo || '',
    area: item?.area || '',
    moscow: item?.moscow || 'M',
    defCusto: item?.defCusto || 'Custo Variável',
    subCategoria: item?.subCategoria || '',
    item: item?.item || '',
    fornecedor: item?.fornecedor || '',
    qtde: item?.qtde || 1,
    valorUnitarioAtual: item?.valorUnitarioAtual || 0,
    qtdeOrcada: item?.qtdeOrcada || 0,
    valorUnitarioOrcado: item?.valorUnitarioOrcado || 0,
    qtdeContratada: item?.qtdeContratada || 0,
    valorUnitarioContratado: item?.valorUnitarioContratado || 0,
    responsavel: item?.responsavel || '',
    status: item?.status || 'Em aberto',
    valorPago: item?.valorPago || 0,
  })

  function set(campo, valor) {
    setForm(prev => ({ ...prev, [campo]: valor }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const valorProjetado = calcularProjetado(form.valorUnitarioAtual, projeto?.ipcaAm, projeto?.tempoContrato)
    onSalvar({
      id: item?.id,
      ...form,
      qtde: Number(form.qtde) || 0,
      valorUnitarioAtual: Number(form.valorUnitarioAtual) || 0,
      valorProjetado,
      totalAtual: (Number(form.qtde) || 0) * (Number(form.valorUnitarioAtual) || 0),
      totalProjetado: (Number(form.qtde) || 0) * valorProjetado,
      qtdeOrcada: Number(form.qtdeOrcada) || 0,
      valorUnitarioOrcado: Number(form.valorUnitarioOrcado) || 0,
      valorOrcado: (Number(form.qtdeOrcada) || 0) * (Number(form.valorUnitarioOrcado) || 0),
      qtdeContratada: Number(form.qtdeContratada) || 0,
      valorUnitarioContratado: Number(form.valorUnitarioContratado) || 0,
      valorContratado: (Number(form.qtdeContratada) || 0) * (Number(form.valorUnitarioContratado) || 0),
      valorPago: Number(form.valorPago) || 0,
    })
  }

  return (
    <form onSubmit={handleSubmit} style={{ padding: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
        <Input label="Código" value={form.codigo} onChange={v => set('codigo', v)} />
        <Input label="Área" value={form.area} onChange={v => set('area', v)} />
        <Select label="MoSCoW" value={form.moscow} onChange={v => set('moscow', v)} options={MOSCOW_OPTIONS} />
        <Select label="Def. Custo" value={form.defCusto} onChange={v => set('defCusto', v)} options={DEF_CUSTO_OPTIONS} />
        <Input label="Sub Categoria" value={form.subCategoria} onChange={v => set('subCategoria', v)} />
        <div style={{ gridColumn: 'span 2' }}>
          <Input label="Item *" value={form.item} onChange={v => set('item', v)} required />
        </div>
        <Input label="Fornecedor" value={form.fornecedor} onChange={v => set('fornecedor', v)} />
      </div>

      <div style={{ fontSize: 11, fontWeight: 600, color: '#1E3A8A', background: '#EFF6FF', padding: '4px 10px', borderRadius: 4, marginBottom: 10 }}>VENDIDO PELO COMERCIAL</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        <Input label="Qtde" value={form.qtde} onChange={v => set('qtde', v)} type="number" min="0" step="1" />
        <Input label="$ Unit. Atual" value={form.valorUnitarioAtual} onChange={v => set('valorUnitarioAtual', v)} type="number" min="0" step="0.01" />
      </div>

      <div style={{ fontSize: 11, fontWeight: 600, color: '#92400E', background: '#FFFBEB', padding: '4px 10px', borderRadius: 4, marginBottom: 10 }}>ORÇADO</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        <Input label="Qtde Orçada" value={form.qtdeOrcada} onChange={v => set('qtdeOrcada', v)} type="number" min="0" step="1" />
        <Input label="Valor Unit. Orçado" value={form.valorUnitarioOrcado} onChange={v => set('valorUnitarioOrcado', v)} type="number" min="0" step="0.01" />
      </div>

      <div style={{ fontSize: 11, fontWeight: 600, color: '#14532D', background: '#F0FDF4', padding: '4px 10px', borderRadius: 4, marginBottom: 10 }}>CONTRATADO</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
        <Input label="Qtde Contratada" value={form.qtdeContratada} onChange={v => set('qtdeContratada', v)} type="number" min="0" step="1" />
        <Input label="Valor Unit. Contratado" value={form.valorUnitarioContratado} onChange={v => set('valorUnitarioContratado', v)} type="number" min="0" step="0.01" />
        <Input label="Valor Pago" value={form.valorPago} onChange={v => set('valorPago', v)} type="number" min="0" step="0.01" />
        <Input label="Responsável" value={form.responsavel} onChange={v => set('responsavel', v)} />
        <Select label="Status" value={form.status} onChange={v => set('status', v)} options={STATUS_OPTIONS} />
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid #2E3150', paddingTop: 16 }}>
        <Btn variante="ghost" tipo="button" onClick={onCancelar}>Cancelar</Btn>
        <Btn tipo="submit">Salvar Item</Btn>
      </div>
    </form>
  )
}
