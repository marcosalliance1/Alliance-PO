# Levantamento — Sincronização automática de P.O.s + card "Orçado"

> Gerado numa sessão do MarcosOS (contexto Kyra/conciliação Everest), pra colar no chat dedicado ao Alliance-PO V2. Cola isso lá que o Claude já entende o estado atual sem precisar re-explorar o código.

## O que o Marcos quer

1. **Separar dois estados no card de P.O.** ("Receita Orç." / "Custo Orç." / "Margem Orç." em `ListaProjetos.tsx`):
   - P.O. **sem orçamento preenchido ainda** → não faz sentido calcular margem orçada (dá número enganoso ou zero). Mostrar algo tipo "Custo Everest já lançado: R$ X" (dado real, sem margem calculada por falta de baseline de receita).
   - P.O. **com orçamento preenchido** → mantém o card atual (Receita/Custo/Margem Orç.).
   - Hoje não existe uma flag dedicada pra isso — precisa inferir (ex: checar se `secoes[].itens` tem algum item com `valorOrcado > 0`, ou se `receitas` está vazio).

2. **Trocar sincronização manual (1 P.O. por vez, botão "Sincronizar" em cada card) por sincronização automática diária de TODAS as P.O.s** — mesmo espírito do script `diagnostico_diario_cap.js` que já roda via Windows Task Scheduler em outro projeto do Marcos (não-interativo, roda sozinho de manhã).

## Estado atual do mecanismo de sync (levantado por exploração do código)

- **Botão "Sincronizar"**: `src/pages/ListaProjetos.tsx` (~linhas 292-300 e 419-427) → `handleSincronizar(p)` (linha 176) → `executarSync(projeto)` (linha 133) → `sincronizarComSheets(...)` em `src/utils/sheetsSync.ts` (linha 539) → depois `onSincronizar` (prop de `App.tsx:241` = `sincronizarSecoes` de `src/hooks/useProjetos.ts:257`).

- **NÃO é integração direta com o Everest.** É fetch **client-side** pra Google Sheets API — o browser lê as abas da planilha vinculada à P.O. e faz upsert no Supabase (`projetos.secoes`, `.tap`, `.receitas`, `.conciliacao_everest`, `.resumo_comercial`). O campo "Conciliação Everest" é digitado manualmente (`atualizarConciliacao`, `useProjetos.ts:234`), não puxa do Everest sozinho.

- **Autenticação**: `src/contexts/GoogleAuthContext.tsx`, `useGoogleLogin` do `@react-oauth/google` — OAuth implícito via popup no browser. `access_token` vive só em memória do React. **Não tem refresh token persistido nem service account server-side.** Esse é o obstáculo real pra automatizar, não a lógica de sync em si.

- **Identificação da P.O.**: por `spreadsheetId` extraído de `projeto.sheetsUrl` (coluna `sheets_url` na tabela `projetos`). Tecnicamente generalizável (iterar todos os `projetos` com `sheets_url` preenchido).

- **Já existe precedente de cron no projeto** (mas pra outro fluxo): `supabase/migrations/20260714000001_marketing_monday_cron.sql` usa `pg_cron` + `pg_net` chamando a Edge Function `supabase/functions/sync-marketing-monday/index.ts` a cada 30 min. Nenhum cron existe hoje pra P.O./Sheets/Everest.

- **Origem dos números do card**: tudo calculado client-side a partir de JSONB (`calcResumoProjeto` / `calcPercentFechados` em `src/utils/calculos.ts`), usando `projetos.secoes` (array de itens com `qtdeOrcada`/`valorOrcado`/`status`) e `projetos.receitas`. "Fechados %" = itens com `status === 'fechado'` / total.

- **Schema `projetos`** (sem migration própria versionada): `id, tap (jsonb), secoes (jsonb), receitas (jsonb), custos_adicionais, conciliacao_everest (jsonb), resumo_comercial, sheets_url, sheet_layout, status, criado_em, atualizado_em`. Tudo embutido em JSONB por projeto, sem tabelas relacionais de orçamento.

## O que precisa pra automatizar de verdade

Não é só "generalizar o botão" — é reengenharia da autenticação:

1. Trocar OAuth interativo por **service account** do Google com acesso às planilhas das P.O.s (sem popup).
2. Portar `sincronizarComSheets` pra uma **Supabase Edge Function** (Deno), chamável via `service_role`, iterando todos os `projetos` com `sheets_url` preenchido.
3. Agendar com `pg_cron` + `pg_net` (mesmo padrão do `sync-marketing-monday`) — ou script Node externo via Task Scheduler chamando a function por HTTP, se preferir manter fora do Supabase.

## Ponto em aberto (decisão de produto, não técnica)

Como definir "P.O. sem orçamento" de forma confiável — hoje não tem flag, só inferência heurística (itens com `valorOrcado > 0` / `receitas` vazio). Vale considerar adicionar uma coluna/flag explícita (`orcamento_preenchido: boolean`) em vez de inferir toda vez, já que isso também vai ser usado pra decidir se mostra o card de margem ou não.
