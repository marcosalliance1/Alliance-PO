# Spec — Visão da P.O. no Portal do Cliente (Comissão de Formatura)

> Gerado numa sessão do MarcosOS, pra colar no chat do Alliance-PO V2 e continuar a implementação. Baseado numa "Prestação de Contas Pós-Evento" real (UNIFENAS 45) que o Marcos compartilhou como referência do nível de detalhe/formato desejado.

## Contexto

Hoje o `DashboardPortal.tsx` (Portal do Cliente) já mostra dados financeiros bem granulares — mas é essencialmente a mesma visão interna, sem filtro pensado pro cliente. O objetivo agora é criar uma versão da P.O. pensada pra quem não é da Alliance: a Comissão de Formatura de cada turma, acessando só o próprio projeto (isolamento por `projeto_id`, já implementado via `portal_clientes`).

**Não são "3 níveis de acesso"** (isso era uma menção desatualizada no `documento_mestre.md` do contexto Alliance, já corrigida) — é isolamento simples: 1 comissão = 1 projeto = 1 credencial.

## O que muda na visão do cliente (vs. o que a equipe interna vê hoje)

1. **Esconder linhas de "Despesa Fee"** — no schema de custo da P.O., cada item tem uma "Def. de custo" que pode ser `Despesa Fee` ou `Custo Projeto`. `Despesa Fee` é custo interno da Alliance (comissão, fee, margem) — não afeta a saúde financeira do projeto do cliente, é comparável a um "benefício"/"presente" que a Alliance banca. **Filtrar essas linhas fora da visão do cliente.**

2. **Esconder itens vazios/não preenchidos** — a P.O. interna tem centenas de linhas de template, muitas com status "orçar" e valor R$ 0,00 (nunca usadas naquele projeto específico). Na visão do cliente, mostrar só itens com dado real preenchido — a P.O. completa é grande demais e "suja" pra esse público.

3. **Simplificar as colunas de valor por item** — a P.O. interna tem 4 estágios paralelos (Vendido pelo Comercial / Orçado / Contratado / Pago). Pro cliente, resumir em **Orçado x Pago** por item (ou uma barra de progresso de % pago) — não precisa dos 4 estágios internos.

4. **Duas receitas, lado a lado**:
   - **Receita Orçada** — já existe na P.O./"1. RESUMO GERAL" (o valor planejado/contratado de receita).
   - **Receita Atual** — puxada ao vivo do Everest (via o mesmo mecanismo de mirror/API que já usamos pra reconciliação Everest x P.O.), refletindo o que realmente entrou até agora.

5. **Inadimplência: fora de escopo por enquanto.** Não é falta de acesso da empresa — é que esse dado vive num sistema (SGE) que a responsável de atendimento está reformulando (ideia de futuro: integrar os sistemas). Não tentar puxar isso agora; deixar como um espaço reservado pra quando o novo sistema de atendimento existir.

## Formato de referência (da Prestação de Contas real)

A prestação de contas que o Marcos mostrou como padrão de "saúde do projeto" tem essa estrutura (útil como inspiração de layout, não pra copiar 1:1 — a parte de inadimplência nominal, por exemplo, fica de fora por causa do item 5 acima):
- Despesas agrupadas por categoria (Operação/Estrutura, Equipe, Atração, A&B, Extras, etc.), com subtotal por categoria e total geral.
- Separação entre despesas da festa específica e despesas administrativas do projeto todo.
- Resumo financeiro consolidado: receitas por origem, despesas por seção, e "cenários de saldo" (festa isolada vs. projeto completo).

## Pendências técnicas já identificadas (do levantamento anterior)

- Confirmar se existe RLS real nas tabelas `projetos`/`orcamentos` restringindo por `projeto_id` — hoje o portal acessa como `anon`, isolamento pode estar só no client-side.
- Exportação em PDF já existe como capacidade (`gerarRelatorioFinanceiro.ts`, jsPDF + autoTable) mas nunca foi conectada ao Portal do Cliente — reaproveitar em vez de criar do zero.

## Próximo passo

Implementar a versão filtrada/simplificada da P.O. no `DashboardPortal.tsx` (ou um componente novo específico), aplicando as 4 regras de exibição acima antes de renderizar pro cliente.
