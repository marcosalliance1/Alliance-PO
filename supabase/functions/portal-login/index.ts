// Edge Function: portal-login
// Valida o login da Comissão (Portal do Cliente) NO SERVIDOR, usando service_role.
// Antes, o login lia `portal_clientes` direto do navegador (role anon) e comparava
// o bcrypt no client — o que exigia que os hashes de senha + e-mails de TODAS as
// comissões ficassem legíveis pro anon (vazamento crítico). Esta função confere a
// senha server-side e devolve só a sessão daquela comissão. O `senha_hash` nunca
// sai do banco. Com isso, a leitura pública de `portal_clientes` pode ser fechada.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import bcrypt from 'npm:bcryptjs@3.0.3'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
    const { email, password } = await req.json()
    if (!email || !password) {
      return json({ error: 'Email e senha são obrigatórios.' }, 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data, error } = await supabase
      .from('portal_clientes')
      .select('id, projeto_id, email, nome_contato, senha_hash, ativo')
      .eq('email', String(email).toLowerCase().trim())
      .eq('ativo', true)
      .maybeSingle()

    if (error) return json({ error: 'Erro ao validar acesso.' }, 500)
    // Mensagens mantidas iguais às do fluxo antigo pra não mudar a UX.
    if (!data) return json({ error: 'Email não encontrado ou acesso inativo' }, 401)

    const ok = await bcrypt.compare(String(password), data.senha_hash as string)
    if (!ok) return json({ error: 'Senha incorreta' }, 401)

    return json({
      clienteId: data.id,
      projetoId: data.projeto_id,
      email: data.email,
      nomeContato: data.nome_contato ?? null,
    })
  } catch (_e) {
    return json({ error: 'Requisição inválida.' }, 400)
  }
})
