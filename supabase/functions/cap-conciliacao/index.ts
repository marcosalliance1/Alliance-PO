// Edge Function: cap-conciliacao
// Devolve os títulos do CAP (Everest) de UMA turma + conta gerencial, usando
// service_role (server-side). Mantém a view financeiro_cap_completo fechada pra
// `anon` — o app (viewer, sem sessão Supabase) chama esta função em vez de ler a
// view direto. Expõe só o recorte pedido, nunca a base inteira.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function norm(s: string | null | undefined): string {
  return (s ?? '').toLowerCase()
    .replace(/[áàâãä]/g, 'a').replace(/[éèêë]/g, 'e').replace(/[íìîï]/g, 'i')
    .replace(/[óòôõö]/g, 'o').replace(/[úùûü]/g, 'u').replace(/ç/g, 'c')
    .replace(/[.\s]+/g, ' ')
    .trim()
}

// Cada token do termo precisa aparecer no centro de custo (tolera o ano anexado
// pelo Everest: "UNIFENAS 42" casa "UNIFENAS 42 2029").
function matchCentroCusto(centroCusto: string | null | undefined, termo: string): boolean {
  const c = norm(centroCusto).replace(/[^a-z0-9]+/g, ' ').trim()
  const termos = norm(termo).replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean)
  if (termos.length === 0 || !c) return false
  return termos.every(t => c.includes(t))
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)

  try {
    const { turma, contaGerencial } = await req.json()
    if (!turma || !contaGerencial) {
      return json({ error: 'Parâmetros "turma" e "contaGerencial" são obrigatórios.' }, 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Pré-filtro no SQL por TODOS os tokens da turma (não só o maior): o PostgREST
    // teta em 1000 linhas por request, então um filtro largo (ex "%cmmg%" traz
    // todas as turmas CMMG) estoura o teto e corta linhas silenciosamente. Exigir
    // cada token (cmmg AND 82 AND 2030) reduz ao centro de custo certo.
    const termos = norm(turma).replace(/[^a-z0-9]+/g, ' ').split(' ').filter(Boolean)
    const alvo = norm(contaGerencial)

    let query = supabase
      .from('financeiro_cap_completo')
      .select('fantasia_fornecedor,desc_conta_gerencial,desc_centro_custo,v_titulo,d_vencimento,situacao')
    for (const t of termos) query = query.ilike('desc_centro_custo', `%${t}%`)
    const { data, error } = await query.limit(5000)

    if (error) return json({ error: error.message }, 500)

    const titulos = (data ?? [])
      .filter((r) => matchCentroCusto(r.desc_centro_custo, turma) && norm(r.desc_conta_gerencial) === alvo)
      .map((r) => ({
        fornecedor:     (r.fantasia_fornecedor ?? '').trim(),
        contaGerencial: (r.desc_conta_gerencial ?? '').trim(),
        centroCusto:    (r.desc_centro_custo ?? '').trim(),
        valor:          r.v_titulo ?? 0,
        vencimento:     r.d_vencimento,
        situacao:       (r.situacao ?? '').trim(),
      }))

    return json({ titulos, encontrados: titulos.length })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
