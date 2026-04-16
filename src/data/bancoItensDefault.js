// Seed inicial do Banco de Itens — Alliance P.O.
export const BANCO_ITENS_DEFAULT = [
  // 2.1 — Custo Produção
  { id: 'bi-001', secao: '2.1', area: 'Produção', subCategoria: 'Aluguel', item: 'Aluguel do Espaço', moscow: 'M', defCusto: 'Custo Variável', fornecedores: [] },
  { id: 'bi-002', secao: '2.1', area: 'Produção', subCategoria: 'Aluguel', item: 'Taxa de Serviço do Espaço', moscow: 'M', defCusto: 'Custo Variável', fornecedores: [] },
  { id: 'bi-003', secao: '2.1', area: 'Legalização', subCategoria: 'Legalização', item: 'Alvará de Funcionamento', moscow: 'M', defCusto: 'Custo Fixo', fornecedores: [] },
  { id: 'bi-004', secao: '2.1', area: 'Legalização', subCategoria: 'Legalização', item: 'ECAD', moscow: 'M', defCusto: 'Custo Fixo', fornecedores: [] },
  { id: 'bi-005', secao: '2.1', area: 'Legalização', subCategoria: 'Legalização', item: 'Bombeiro / AVCB', moscow: 'M', defCusto: 'Custo Fixo', fornecedores: [] },
  { id: 'bi-006', secao: '2.1', area: 'Decoração', subCategoria: 'Decoração', item: 'Decoração Geral', moscow: 'M', defCusto: 'Custo Variável', fornecedores: [] },
  { id: 'bi-007', secao: '2.1', area: 'Decoração', subCategoria: 'Decoração', item: 'Flores e Arranjos', moscow: 'S', defCusto: 'Custo Variável', fornecedores: [] },
  { id: 'bi-008', secao: '2.1', area: 'Decoração', subCategoria: 'Decoração', item: 'Iluminação Decorativa', moscow: 'S', defCusto: 'Custo Variável', fornecedores: [] },
  { id: 'bi-009', secao: '2.1', area: 'Palco/Som/Luz', subCategoria: 'Palco, Som e Luz', item: 'Palco', moscow: 'M', defCusto: 'Custo Fixo', fornecedores: [] },
  { id: 'bi-010', secao: '2.1', area: 'Palco/Som/Luz', subCategoria: 'Palco, Som e Luz', item: 'Sistema de Som', moscow: 'M', defCusto: 'Custo Fixo', fornecedores: [] },
  { id: 'bi-011', secao: '2.1', area: 'Palco/Som/Luz', subCategoria: 'Palco, Som e Luz', item: 'Iluminação de Show', moscow: 'M', defCusto: 'Custo Fixo', fornecedores: [] },
  { id: 'bi-012', secao: '2.1', area: 'Palco/Som/Luz', subCategoria: 'Palco, Som e Luz', item: 'Telão e Projeção', moscow: 'S', defCusto: 'Custo Fixo', fornecedores: [] },
  { id: 'bi-013', secao: '2.1', area: 'Infraestrutura', subCategoria: 'Infraestrutura', item: 'Gerador', moscow: 'M', defCusto: 'Custo Fixo', fornecedores: [] },
  { id: 'bi-014', secao: '2.1', area: 'Infraestrutura', subCategoria: 'Infraestrutura', item: 'Segurança Patrimonial', moscow: 'M', defCusto: 'Custo Fixo', fornecedores: [] },
  { id: 'bi-015', secao: '2.1', area: 'Infraestrutura', subCategoria: 'Infraestrutura', item: 'Estacionamento', moscow: 'S', defCusto: 'Custo Variável', fornecedores: [] },
  { id: 'bi-016', secao: '2.1', area: 'Infraestrutura', subCategoria: 'Infraestrutura', item: 'Climatização', moscow: 'M', defCusto: 'Custo Fixo', fornecedores: [] },
  { id: 'bi-017', secao: '2.1', area: 'Experiência', subCategoria: 'Experiência do Cliente', item: 'Mesa de Boas-Vindas', moscow: 'S', defCusto: 'Custo Variável', fornecedores: [] },
  { id: 'bi-018', secao: '2.1', area: 'Experiência', subCategoria: 'Experiência do Cliente', item: 'Recepção / Anfitriãs', moscow: 'S', defCusto: 'Custo Variável', fornecedores: [] },

  // 2.2 — Custo Artístico
  { id: 'bi-019', secao: '2.2', area: 'Artístico', subCategoria: 'Atração Principal', item: 'Banda / DJ Principal', moscow: 'M', defCusto: 'Custo Fixo', fornecedores: [] },
  { id: 'bi-020', secao: '2.2', area: 'Artístico', subCategoria: 'Atração Principal', item: 'Cachê Artístico', moscow: 'M', defCusto: 'Custo Fixo', fornecedores: [] },
  { id: 'bi-021', secao: '2.2', area: 'Artístico', subCategoria: 'Atração Complementar', item: 'DJ Abertura', moscow: 'S', defCusto: 'Custo Fixo', fornecedores: [] },
  { id: 'bi-022', secao: '2.2', area: 'Artístico', subCategoria: 'Atração Complementar', item: 'Coral / Músicos Cerimônia', moscow: 'S', defCusto: 'Custo Fixo', fornecedores: [] },
  { id: 'bi-023', secao: '2.2', area: 'Artístico', subCategoria: 'Pós Baile', item: 'Atração Pós Baile', moscow: 'C', defCusto: 'Custo Fixo', fornecedores: [] },

  // 2.3 — Custo Equipe
  { id: 'bi-024', secao: '2.3', area: 'Equipe', subCategoria: 'Coordenação', item: 'Coordenador Geral', moscow: 'M', defCusto: 'Custo Fixo', fornecedores: [] },
  { id: 'bi-025', secao: '2.3', area: 'Equipe', subCategoria: 'Coordenação', item: 'Assistente de Coordenação', moscow: 'M', defCusto: 'Custo Fixo', fornecedores: [] },
  { id: 'bi-026', secao: '2.3', area: 'Equipe', subCategoria: 'Operacional', item: 'Auxiliares de Produção', moscow: 'M', defCusto: 'Custo Variável', fornecedores: [] },
  { id: 'bi-027', secao: '2.3', area: 'Equipe', subCategoria: 'Operacional', item: 'Mestre de Cerimônias', moscow: 'S', defCusto: 'Custo Fixo', fornecedores: [] },
  { id: 'bi-028', secao: '2.3', area: 'Equipe', subCategoria: 'Técnica', item: 'Operador de Som e Luz', moscow: 'M', defCusto: 'Custo Fixo', fornecedores: [] },

  // 2.4 — Custo Bar & Food
  { id: 'bi-029', secao: '2.4', area: 'Bar & Food', subCategoria: 'Bebidas', item: 'Open Bar Destilados', moscow: 'M', defCusto: 'Custo Variável', fornecedores: [] },
  { id: 'bi-030', secao: '2.4', area: 'Bar & Food', subCategoria: 'Bebidas', item: 'Cerveja e Chope', moscow: 'M', defCusto: 'Custo Variável', fornecedores: [] },
  { id: 'bi-031', secao: '2.4', area: 'Bar & Food', subCategoria: 'Bebidas', item: 'Refrigerantes e Água', moscow: 'M', defCusto: 'Custo Variável', fornecedores: [] },
  { id: 'bi-032', secao: '2.4', area: 'Bar & Food', subCategoria: 'Alimentos', item: 'Coquetel de Entrada', moscow: 'S', defCusto: 'Custo Variável', fornecedores: [] },
  { id: 'bi-033', secao: '2.4', area: 'Bar & Food', subCategoria: 'Alimentos', item: 'Jantar / Buffet', moscow: 'M', defCusto: 'Custo Variável', fornecedores: [] },
  { id: 'bi-034', secao: '2.4', area: 'Bar & Food', subCategoria: 'Alimentos', item: 'Mesa de Frios', moscow: 'S', defCusto: 'Custo Variável', fornecedores: [] },
  { id: 'bi-035', secao: '2.4', area: 'Bar & Food', subCategoria: 'Alimentos', item: 'Bolo de Formatura', moscow: 'M', defCusto: 'Custo Variável', fornecedores: [] },
  { id: 'bi-036', secao: '2.4', area: 'Bar & Food', subCategoria: 'Equipe', item: 'Garçons', moscow: 'M', defCusto: 'Custo Variável', fornecedores: [] },
  { id: 'bi-037', secao: '2.4', area: 'Bar & Food', subCategoria: 'Equipe', item: 'Barman', moscow: 'M', defCusto: 'Custo Fixo', fornecedores: [] },

  // 2.5 — Pré-Eventos / Cerimônia
  { id: 'bi-038', secao: '2.5', area: 'Pré-Eventos', subCategoria: 'Bolsa Folia', item: 'Viagem / Balada', moscow: 'S', defCusto: 'Custo Variável', fornecedores: [] },
  { id: 'bi-039', secao: '2.5', area: 'Pré-Eventos', subCategoria: 'Bolsa Folia', item: 'Estrutura Bolsa Folia', moscow: 'S', defCusto: 'Custo Fixo', fornecedores: [] },
  { id: 'bi-040', secao: '2.5', area: 'Pré-Eventos', subCategoria: 'Jantar de Gala', item: 'Jantar de Gala', moscow: 'C', defCusto: 'Custo Fixo', fornecedores: [] },

  // 2.6 — Cerimônia Religiosa
  { id: 'bi-041', secao: '2.6', area: 'Cerimônia', subCategoria: 'Cerimônia Religiosa', item: 'Celebrante / Padre', moscow: 'M', defCusto: 'Custo Fixo', fornecedores: [] },
  { id: 'bi-042', secao: '2.6', area: 'Cerimônia', subCategoria: 'Cerimônia Religiosa', item: 'Decoração Igreja', moscow: 'S', defCusto: 'Custo Variável', fornecedores: [] },
  { id: 'bi-043', secao: '2.6', area: 'Cerimônia', subCategoria: 'Cerimônia Religiosa', item: 'Som Cerimônia', moscow: 'M', defCusto: 'Custo Fixo', fornecedores: [] },

  // 2.7 — Colação de Grau
  { id: 'bi-044', secao: '2.7', area: 'Colação', subCategoria: 'Colação de Grau', item: 'Locação Espaço Colação', moscow: 'M', defCusto: 'Custo Fixo', fornecedores: [] },
  { id: 'bi-045', secao: '2.7', area: 'Colação', subCategoria: 'Colação de Grau', item: 'Coquetel Colação', moscow: 'S', defCusto: 'Custo Variável', fornecedores: [] },
  { id: 'bi-046', secao: '2.7', area: 'Colação', subCategoria: 'Colação de Grau', item: 'Produção Colação', moscow: 'M', defCusto: 'Custo Fixo', fornecedores: [] },

  // 2.8 — Custos Administrativos
  { id: 'bi-047', secao: '2.8', area: 'ADM', subCategoria: 'Despesas ADM', item: 'Marketing e Divulgação', moscow: 'S', defCusto: 'Custo Fixo', fornecedores: [] },
  { id: 'bi-048', secao: '2.8', area: 'ADM', subCategoria: 'Despesas ADM', item: 'Logística e Transporte', moscow: 'S', defCusto: 'Custo Variável', fornecedores: [] },
  { id: 'bi-049', secao: '2.8', area: 'ADM', subCategoria: 'Despesas ADM', item: 'Material de Escritório', moscow: 'C', defCusto: 'Custo Fixo', fornecedores: [] },
  { id: 'bi-050', secao: '2.8', area: 'ADM', subCategoria: 'Despesas ADM', item: 'Foto e Vídeo', moscow: 'S', defCusto: 'Custo Fixo', fornecedores: [] },
  { id: 'bi-051', secao: '2.8', area: 'ADM', subCategoria: 'Despesas Fee', item: 'Fee de Assessoria Alliance', moscow: 'M', defCusto: 'Custo Fixo', fornecedores: [] },
  { id: 'bi-052', secao: '2.8', area: 'ADM', subCategoria: 'Despesas Fee', item: 'Fee de Produção Alliance', moscow: 'M', defCusto: 'Custo Fixo', fornecedores: [] },
]

export const NOMES_SECOES = {
  '2.1': 'Custo Produção',
  '2.2': 'Custo Artístico',
  '2.3': 'Custo Equipe',
  '2.4': 'Custo Bar & Food',
  '2.5': 'Pré-Eventos / Cerimônia',
  '2.6': 'Cerimônia Religiosa',
  '2.7': 'Colação de Grau',
  '2.8': 'Custos Administrativos',
}

export const ORDEM_SECOES = ['2.1', '2.2', '2.3', '2.4', '2.5', '2.6', '2.7', '2.8']
