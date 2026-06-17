import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

// ── Types ─────────────────────────────────────────────────────────────────────

interface ItemCusto {
  fornecedor?: string
  valorOrcado?: number
  valorContratado?: number
  valorFinal?: number
}

interface Secao {
  itens?: ItemCusto[]
}

interface ReceitaLinha {
  contratado?: number
  pago?: number
}

interface TAP {
  instituicao?: string
  curso?: string
  turma?: string
  tipoEscola?: string
}

interface Projeto {
  id: string
  tap: TAP
  secoes: Secao[]
  receitas: Record<string, ReceitaLinha>
  status: string
  total_convidados_atual: number | null
}

interface BoletimRow {
  tipo: string
  v_lancamento: number
  d_competencia: string
}

interface CapHistRow {
  v_titulo: number
  d_competencia: string
}

interface CapFluxoRow {
  d_vencimento: string
  v_titulo: number
}

interface ProjetoMetrics {
  nome: string
  orcado: number
  contratado: number
  pago: number
  receitaContratada: number
  margem: number
}

interface FornecedorMetric {
  nome: string
  total: number
  numProjetos: number
  media: number
}

interface FluxoSemana {
  semana: string
  total: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function brl(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function getISOWeekStart(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = d.getUTCDay()
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day))
  return d
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + n)
  return d
}

function fmtD(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, "0")
  const d = String(date.getUTCDate()).padStart(2, "0")
  return `${d}/${m}/${y}`
}

function toYMD(date: Date): string {
  return date.toISOString().split("T")[0]
}

function varBadge(atual: number, anterior: number, invertido = false): string {
  if (anterior === 0) return `<span style="color:#888">—</span>`
  const diff = ((atual - anterior) / Math.abs(anterior)) * 100
  const positivo = invertido ? diff < 0 : diff >= 0
  const cor = positivo ? "#16a34a" : "#dc2626"
  const seta = diff >= 0 ? "↑" : "↓"
  const sign = diff >= 0 ? "+" : ""
  return `<span style="color:${cor};font-size:12px;">${seta} ${sign}${diff.toFixed(1)}%</span>`
}

// ── Main ──────────────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    console.log('RESEND_API_KEY exists:', !!resendApiKey)

    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY não configurado como secret na Edge Function' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // Referência temporal: semana ISO da data mais recente no boletim
    const { data: maxRow } = await supabase
      .from("financeiro_boletim")
      .select("d_competencia")
      .order("d_competencia", { ascending: false })
      .limit(1)
      .single()

    const refDate = new Date(maxRow!.d_competencia + "T12:00:00Z")
    const semAtualIni = getISOWeekStart(refDate)
    const semAtualFim = addDays(semAtualIni, 7)   // exclusive
    const semAntIni   = addDays(semAtualIni, -7)

    const semAtualIniStr = toYMD(semAtualIni)
    const semAtualFimStr = toYMD(semAtualFim)
    const semAntIniStr   = toYMD(semAntIni)

    // Busca paralela de todos os dados
    const [boletimRes, capHistRes, capFluxoRes, projetosRes] = await Promise.all([
      supabase
        .from("financeiro_boletim")
        .select("tipo, v_lancamento, d_competencia")
        .in("tipo", ["RECEITA", "DESPESA"])
        .gte("d_competencia", semAntIniStr)
        .lt("d_competencia", semAtualFimStr),

      supabase
        .from("financeiro_cap")
        .select("v_titulo, d_competencia")
        .gte("d_competencia", semAntIniStr)
        .lt("d_competencia", semAtualFimStr),

      supabase
        .from("financeiro_cap")
        .select("d_vencimento, v_titulo")
        .eq("situacao", "ATIVO")
        .gte("d_vencimento", toYMD(new Date()))
        .lte("d_vencimento", toYMD(addDays(new Date(), 90))),

      supabase
        .from("projetos")
        .select("id, tap, secoes, receitas, status, total_convidados_atual"),
    ])

    if (boletimRes.error) throw new Error(boletimRes.error.message)
    if (projetosRes.error) throw new Error(projetosRes.error.message)

    const boletim  = (boletimRes.data  ?? []) as BoletimRow[]
    const capHist  = (capHistRes.data  ?? []) as CapHistRow[]
    const capFluxo = (capFluxoRes.data ?? []) as CapFluxoRow[]
    const projetos = (projetosRes.data ?? []) as Projeto[]

    // ── Relatório 1: Resultado Semanal ──────────────────────────────────────

    function somaBoletim(tipo: string, ini: string, fim: string): number {
      return boletim
        .filter(r => r.tipo === tipo && r.d_competencia >= ini && r.d_competencia < fim)
        .reduce((s, r) => s + (r.v_lancamento || 0), 0)
    }
    function somaCAP(ini: string, fim: string): number {
      return capHist
        .filter(r => r.d_competencia >= ini && r.d_competencia < fim)
        .reduce((s, r) => s + (r.v_titulo || 0), 0)
    }

    const recAtual  = somaBoletim("RECEITA", semAtualIniStr, semAtualFimStr)
    const recAnt    = somaBoletim("RECEITA", semAntIniStr, semAtualIniStr)
    const despAtual = somaCAP(semAtualIniStr, semAtualFimStr)
    const despAnt   = somaCAP(semAntIniStr, semAtualIniStr)
    const resAtual  = recAtual - despAtual
    const resAnt    = recAnt - despAnt
    const margAtual = recAtual > 0 ? (resAtual / recAtual) * 100 : 0
    const margAnt   = recAnt > 0 ? (resAnt / recAnt) * 100 : 0
    const margDiff  = margAtual - margAnt

    // ── Relatório 2: Comparativo de Projetos ────────────────────────────────

    const r2: ProjetoMetrics[] = projetos.map(p => {
      const itens = (p.secoes ?? []).flatMap(s => s.itens ?? [])
      const orcado      = itens.reduce((s, i) => s + (i.valorOrcado      || 0), 0)
      const contratado  = itens.reduce((s, i) => s + (i.valorContratado  || 0), 0)
      const pago        = itens.reduce((s, i) => s + (i.valorFinal       || 0), 0)
      const recVals     = Object.values(p.receitas ?? {})
      const recContr    = recVals.reduce((s, r) => s + (r.contratado || 0), 0)
      const margem      = recContr > 0 ? ((recContr - contratado) / recContr) * 100 : 0
      const tap         = p.tap ?? {}
      return {
        nome: `${tap.instituicao || "—"} · ${tap.curso || ""} ${tap.turma || ""}`.trim().replace(/· $/, ""),
        orcado, contratado, pago, receitaContratada: recContr, margem,
      }
    }).sort((a, b) => b.contratado - a.contratado)

    // ── Relatório 3: Análise de Fornecedores ────────────────────────────────

    const fornMap = new Map<string, { total: number; projs: Set<string> }>()
    for (const p of projetos) {
      for (const s of (p.secoes ?? [])) {
        for (const i of (s.itens ?? [])) {
          const forn = (i.fornecedor ?? "").trim()
          if (!forn) continue
          if (!fornMap.has(forn)) fornMap.set(forn, { total: 0, projs: new Set() })
          const e = fornMap.get(forn)!
          e.total += i.valorFinal || 0
          e.projs.add(p.id)
        }
      }
    }
    const top10: FornecedorMetric[] = [...fornMap.entries()]
      .map(([nome, d]) => ({
        nome,
        total: d.total,
        numProjetos: d.projs.size,
        media: d.total / d.projs.size,
      }))
      .filter(f => f.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)

    // ── Relatório 4: Performance de Convidados ──────────────────────────────

    const ensinos: Record<string, { total: number; count: number }> = {
      FUNDAMENTAL: { total: 0, count: 0 },
      MEDIO:       { total: 0, count: 0 },
      SUPERIOR:    { total: 0, count: 0 },
    }
    let totalConv = 0
    for (const p of projetos) {
      if (!p.total_convidados_atual) continue
      const tipo = (p.tap?.tipoEscola ?? "").toUpperCase()
      if (ensinos[tipo]) {
        ensinos[tipo].total += p.total_convidados_atual
        ensinos[tipo].count++
      }
      totalConv += p.total_convidados_atual
    }

    // ── Relatório 5: Fluxo de Caixa 90 dias ─────────────────────────────────

    const fluxoMap = new Map<string, number>()
    for (const row of capFluxo) {
      const ws = toYMD(getISOWeekStart(new Date(row.d_vencimento + "T12:00:00Z")))
      fluxoMap.set(ws, (fluxoMap.get(ws) ?? 0) + (row.v_titulo || 0))
    }
    const fluxoSemanas: FluxoSemana[] = [...fluxoMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([semana, total]) => ({ semana, total }))
    const fluxoTotal = fluxoSemanas.reduce((s, r) => s + r.total, 0)

    // ── Montar e enviar email ────────────────────────────────────────────────

    const geradoEm  = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
    const periodoRef = `${fmtD(semAtualIni)} a ${fmtD(addDays(semAtualFim, -1))}`
    const periodoAnt = `${fmtD(semAntIni)} a ${fmtD(addDays(semAtualIni, -1))}`
    const dataCurta  = new Date().toLocaleDateString("pt-BR")

    const html = buildHtml({
      geradoEm, periodoRef, periodoAnt,
      recAtual, recAnt, despAtual, despAnt, resAtual, resAnt,
      margAtual, margAnt, margDiff,
      r2, top10, ensinos, totalConv, totalProjetos: projetos.length,
      fluxoSemanas, fluxoTotal,
    })

    const { data: destinatarios, error: destErr } = await supabase
      .from("relatorio_destinatarios")
      .select("email, nome")
      .eq("ativo", true)

    if (destErr) throw new Error(destErr.message)

    if (!destinatarios || destinatarios.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum destinatário ativo encontrado em relatorio_destinatarios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const ids: string[] = []
    for (const dest of destinatarios) {
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendApiKey}` },
        body: JSON.stringify({
          from: "relatorios@padraoalliance.app.br",
          to: [dest.email],
          subject: `Relatório Semanal Alliance — ${dataCurta}`,
          html,
        }),
      })

      if (!emailRes.ok) {
        const err = await emailRes.text()
        console.log('Resend error status:', emailRes.status, 'body:', err, 'to:', dest.email)
        return new Response(JSON.stringify({ error: `Resend ${emailRes.status}: ${err}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      const result = await emailRes.json()
      ids.push(result.id)
    }

    return new Response(JSON.stringify({ ok: true, sent: ids.length, ids }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})

// ── HTML ──────────────────────────────────────────────────────────────────────

interface HtmlParams {
  geradoEm: string
  periodoRef: string
  periodoAnt: string
  recAtual: number
  recAnt: number
  despAtual: number
  despAnt: number
  resAtual: number
  resAnt: number
  margAtual: number
  margAnt: number
  margDiff: number
  r2: ProjetoMetrics[]
  top10: FornecedorMetric[]
  ensinos: Record<string, { total: number; count: number }>
  totalConv: number
  totalProjetos: number
  fluxoSemanas: FluxoSemana[]
  fluxoTotal: number
}

function buildHtml(d: HtmlParams): string {
  const RED    = "#E63329"
  const DARK   = "#111827"
  const TH     = `text-align:left;padding:9px 12px;font-size:11px;font-weight:700;letter-spacing:0.5px;color:#6b7280;background:#f9fafb;border-bottom:1px solid #e5e7eb;text-transform:uppercase;`
  const TD     = `padding:10px 12px;font-size:13px;border-bottom:1px solid #f3f4f6;vertical-align:middle;`
  const TDR    = `${TD}text-align:right;`
  const TDC    = `${TD}text-align:center;`
  const CARD   = `border-left:4px solid`
  const SECBDR = `border-left:4px solid ${RED};padding:0 0 0 14px;margin:0 0 6px;`

  // ── Cartões do relatório 1
  function card(label: string, valor: number, badge: string, borderColor: string, negativo = false): string {
    const cor = negativo && valor < 0 ? "#dc2626" : "#0f172a"
    return `<td width="25%" style="padding:4px;">
      <div style="${CARD} ${borderColor};background:#fafafa;padding:14px 16px;border-radius:4px;">
        <div style="font-size:10px;font-weight:700;letter-spacing:1px;color:#9ca3af;text-transform:uppercase;margin-bottom:8px;">${label}</div>
        <div style="font-size:19px;font-weight:800;color:${cor};margin-bottom:6px;">${brl(valor)}</div>
        <div>${badge}</div>
      </div>
    </td>`
  }

  // ── Linhas do relatório 2
  const r2Rows = d.r2.map(p => {
    const acimaOrc   = p.pago > p.orcado && p.orcado > 0
    const baixaMarg  = p.margem > 0 && p.margem < 15
    const rowBg      = acimaOrc ? "#fff5f5" : baixaMarg ? "#fefce8" : "transparent"
    const margCor    = acimaOrc ? "#dc2626" : baixaMarg ? "#ca8a04" : p.margem >= 30 ? "#16a34a" : "#0f172a"
    const flag       = acimaOrc ? `<span style="color:#dc2626;font-size:10px;font-weight:700;">▲ ACIMA ORC.</span>` : baixaMarg ? `<span style="color:#ca8a04;font-size:10px;font-weight:700;">⚠ MARGEM BAIXA</span>` : ""
    return `<tr style="background:${rowBg};">
      <td style="${TD}">
        <div style="font-weight:600;color:#0f172a;font-size:13px;">${p.nome}</div>
        ${flag ? `<div style="margin-top:2px;">${flag}</div>` : ""}
      </td>
      <td style="${TDR}">${brl(p.orcado)}</td>
      <td style="${TDR}">${brl(p.contratado)}</td>
      <td style="${TDR}">${brl(p.pago)}</td>
      <td style="${TDR};font-weight:700;color:${margCor};">${p.receitaContratada > 0 ? `${p.margem.toFixed(1)}%` : "—"}</td>
    </tr>`
  }).join("")

  // ── Linhas do relatório 3
  const top10Rows = d.top10.map((f, i) => `<tr>
    <td style="${TD}">
      <span style="display:inline-block;width:22px;height:22px;border-radius:50%;background:${i < 3 ? RED : "#e5e7eb"};color:${i < 3 ? "#fff" : "#374151"};font-size:11px;font-weight:700;text-align:center;line-height:22px;margin-right:8px;">${i + 1}</span>
      ${f.nome}
    </td>
    <td style="${TDR};font-weight:600;">${brl(f.total)}</td>
    <td style="${TDC}">${f.numProjetos}</td>
    <td style="${TDR}">${brl(f.media)}</td>
  </tr>`).join("")

  // ── Linhas do relatório 4
  const ensinoLabel: Record<string, string> = { FUNDAMENTAL: "Fundamental", MEDIO: "Médio", SUPERIOR: "Superior" }
  const ensinoRows = Object.entries(d.ensinos).map(([tipo, e]) => `<tr>
    <td style="${TD};font-weight:500;">${ensinoLabel[tipo] ?? tipo}</td>
    <td style="${TDC}">${e.count}</td>
    <td style="${TDC};font-weight:600;">${e.total.toLocaleString("pt-BR")}</td>
    <td style="${TDC}">${e.count > 0 ? Math.round(e.total / e.count).toLocaleString("pt-BR") : "—"}</td>
  </tr>`).join("")

  // ── Linhas do relatório 5
  const fluxoRows = d.fluxoSemanas.map((row, i) => {
    const ws = new Date(row.semana + "T12:00:00Z")
    const we = addDays(ws, 6)
    const isFirst = i === 0
    return `<tr style="${isFirst ? "background:#fff5f5;" : ""}">
      <td style="${TD};${isFirst ? "font-weight:600;" : ""}">${fmtD(ws)} — ${fmtD(we)}${isFirst ? " <span style='font-size:11px;color:#dc2626;'>← esta semana</span>" : ""}</td>
      <td style="${TDR};font-weight:${isFirst ? "700" : "500"};color:${isFirst ? RED : "#0f172a"};">${brl(row.total)}</td>
    </tr>`
  }).join("")

  // ── Bloco de margem semanal
  const margBadge = d.margDiff === 0
    ? `<span style="color:#888">—</span>`
    : `<span style="color:${d.margDiff >= 0 ? "#16a34a" : "#dc2626"};font-size:12px;">${d.margDiff >= 0 ? "↑" : "↓"} ${Math.abs(d.margDiff).toFixed(1)}pp vs semana ant.</span>`

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Relatório Semanal Alliance</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
<tr><td align="center">
<table width="700" cellpadding="0" cellspacing="0" style="max-width:700px;width:100%;">

  <!-- HEADER ──────────────────────────────────────────────────── -->
  <tr>
    <td style="background:${DARK};padding:32px 36px;border-radius:8px 8px 0 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <div style="font-size:10px;font-weight:700;letter-spacing:3px;color:${RED};text-transform:uppercase;margin-bottom:8px;">Alliance Cerimonial</div>
            <div style="font-size:26px;font-weight:800;color:#ffffff;margin-bottom:6px;">Relatório Semanal</div>
            <div style="font-size:13px;color:#94a3b8;">Período de referência: <strong style="color:#e2e8f0;">${d.periodoRef}</strong></div>
            <div style="font-size:12px;color:#64748b;margin-top:4px;">Semana anterior: ${d.periodoAnt}</div>
          </td>
          <td align="right" style="vertical-align:top;">
            <div style="width:52px;height:52px;background:${RED};border-radius:10px;text-align:center;line-height:52px;font-size:26px;font-weight:900;color:#fff;">A</div>
          </td>
        </tr>
      </table>
      <div style="margin-top:16px;padding-top:16px;border-top:1px solid #1e2937;font-size:11px;color:#475569;">Gerado em ${d.geradoEm}</div>
    </td>
  </tr>

  <!-- BODY ────────────────────────────────────────────────────── -->
  <tr>
    <td style="background:#ffffff;padding:32px 36px;">
    <table width="100%" cellpadding="0" cellspacing="0">

      <!-- ─── R1: Resultado Semanal ─────────────────────────── -->
      <tr><td colspan="99" style="padding-bottom:16px;">
        <div style="${SECBDR}">
          <div style="font-size:16px;font-weight:800;color:#0f172a;">Resultado Semanal</div>
          <div style="font-size:12px;color:#9ca3af;margin-top:2px;">Comparativo semana atual vs semana anterior</div>
        </div>
      </td></tr>
      <tr><td colspan="99" style="padding-bottom:28px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            ${card("Receitas", d.recAtual, varBadge(d.recAtual, d.recAnt), "#22c55e")}
            ${card("Despesas (CAP)", d.despAtual, varBadge(d.despAtual, d.despAnt, true), "#ef4444")}
            ${card("Resultado", d.resAtual, varBadge(d.resAtual, d.resAnt), d.resAtual >= 0 ? "#0ea5e9" : "#ef4444", true)}
            <td width="25%" style="padding:4px;">
              <div style="${CARD} #a855f7;background:#fafafa;padding:14px 16px;border-radius:4px;">
                <div style="font-size:10px;font-weight:700;letter-spacing:1px;color:#9ca3af;text-transform:uppercase;margin-bottom:8px;">Margem</div>
                <div style="font-size:19px;font-weight:800;color:#0f172a;margin-bottom:6px;">${d.margAtual.toFixed(1)}%</div>
                <div>${margBadge}</div>
              </div>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- ─── R2: Comparativo de Projetos ──────────────────── -->
      <tr><td colspan="99" style="padding-bottom:16px;">
        <div style="${SECBDR}">
          <div style="font-size:16px;font-weight:800;color:#0f172a;">Comparativo de Projetos</div>
          <div style="font-size:12px;color:#9ca3af;margin-top:2px;">Orçado × Contratado × Pago — margem sobre receita contratada</div>
        </div>
      </td></tr>
      <tr><td colspan="99" style="padding-bottom:28px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
          <thead>
            <tr>
              <th style="${TH}">Projeto</th>
              <th style="${TH}text-align:right;">Orçado</th>
              <th style="${TH}text-align:right;">Contratado</th>
              <th style="${TH}text-align:right;">Pago</th>
              <th style="${TH}text-align:right;">Margem</th>
            </tr>
          </thead>
          <tbody>${r2Rows}</tbody>
        </table>
      </td></tr>

      <!-- ─── R3: Top 10 Fornecedores ──────────────────────── -->
      <tr><td colspan="99" style="padding-bottom:16px;">
        <div style="${SECBDR}">
          <div style="font-size:16px;font-weight:800;color:#0f172a;">Top 10 Fornecedores</div>
          <div style="font-size:12px;color:#9ca3af;margin-top:2px;">Por valor total pago na carteira de projetos</div>
        </div>
      </td></tr>
      <tr><td colspan="99" style="padding-bottom:28px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
          <thead>
            <tr>
              <th style="${TH}">Fornecedor</th>
              <th style="${TH}text-align:right;">Total Pago</th>
              <th style="${TH}text-align:center;">Projetos</th>
              <th style="${TH}text-align:right;">Média / Projeto</th>
            </tr>
          </thead>
          <tbody>${top10Rows}</tbody>
        </table>
      </td></tr>

      <!-- ─── R4: Performance de Convidados ────────────────── -->
      <tr><td colspan="99" style="padding-bottom:16px;">
        <div style="${SECBDR}">
          <div style="font-size:16px;font-weight:800;color:#0f172a;">Performance de Convidados</div>
          <div style="font-size:12px;color:#9ca3af;margin-top:2px;">Total geral da carteira: <strong style="color:#0f172a;">${d.totalConv.toLocaleString("pt-BR")}</strong> convidados em ${d.totalProjetos} projetos</div>
        </div>
      </td></tr>
      <tr><td colspan="99" style="padding-bottom:28px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
          <thead>
            <tr>
              <th style="${TH}">Segmento</th>
              <th style="${TH}text-align:center;">Projetos</th>
              <th style="${TH}text-align:center;">Total Convidados</th>
              <th style="${TH}text-align:center;">Média / Projeto</th>
            </tr>
          </thead>
          <tbody>
            ${ensinoRows}
            <tr style="background:#f9fafb;">
              <td style="${TD}font-weight:700;color:#0f172a;">TOTAL</td>
              <td style="${TDC}font-weight:700;">${d.totalProjetos}</td>
              <td style="${TDC}font-weight:700;">${d.totalConv.toLocaleString("pt-BR")}</td>
              <td style="${TDC}">—</td>
            </tr>
          </tbody>
        </table>
      </td></tr>

      <!-- ─── R5: Fluxo de Caixa 90 dias ───────────────────── -->
      <tr><td colspan="99" style="padding-bottom:16px;">
        <div style="${SECBDR}">
          <div style="font-size:16px;font-weight:800;color:#0f172a;">Fluxo de Caixa — Próximos 90 dias</div>
          <div style="font-size:12px;color:#9ca3af;margin-top:2px;">Títulos ATIVO com vencimento até ${fmtD(addDays(new Date(), 90))} · Total: <strong style="color:${RED};">${brl(d.fluxoTotal)}</strong></div>
        </div>
      </td></tr>
      <tr><td colspan="99">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
          <thead>
            <tr>
              <th style="${TH}">Semana de Vencimento</th>
              <th style="${TH}text-align:right;">Total a Pagar</th>
            </tr>
          </thead>
          <tbody>
            ${fluxoRows}
            <tr style="background:#111827;">
              <td style="${TD}font-weight:700;color:#f9fafb;">TOTAL 90 DIAS</td>
              <td style="${TDR}font-weight:800;color:${RED};">${brl(d.fluxoTotal)}</td>
            </tr>
          </tbody>
        </table>
      </td></tr>

    </table>
    </td>
  </tr>

  <!-- FOOTER ──────────────────────────────────────────────────── -->
  <tr>
    <td style="background:${DARK};padding:20px 36px;border-radius:0 0 8px 8px;text-align:center;">
      <div style="font-size:13px;font-weight:600;color:#e2e8f0;margin-bottom:4px;">Alliance Cerimonial — Relatório Semanal Automático</div>
      <div style="font-size:11px;color:#475569;">Este relatório é gerado automaticamente pelo sistema de gestão. Não responda a este e-mail.</div>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`
}
