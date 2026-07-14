import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

// ── Config ────────────────────────────────────────────────────────────────────

const BOARD_ID = "8225814416"
const MONDAY_API_URL = "https://api.monday.com/v2"
const MONDAY_API_VERSION = "2024-10"
const PAGE_LIMIT = 500

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface MondayColumnValue {
  id: string
  text: string | null
  value: string | null
}

interface MondayGroup {
  id: string
  title: string
}

interface MondayItem {
  id: string
  name: string
  updated_at: string | null
  group: MondayGroup
  column_values: MondayColumnValue[]
}

interface ItemsPage {
  cursor: string | null
  items: MondayItem[]
}

interface StatusColumnSettings {
  labels?: Record<string, string>
  color_mapping?: Record<string, number>
  done_colors?: number[]
}

interface DemandaRow {
  id: number
  group_id: string
  nome: string
  cliente_extraido: string
  status: string
  status_is_done: boolean
  prioridade: string | null
  data_inicio: string | null
  data_fim: string | null
  monday_updated_at: string | null
  synced_at: string
}

interface ResponsavelRow {
  item_id: number
  person_id: number
  person_name: string
}

// ── Monday API helpers ──────────────────────────────────────────────────────────

async function mondayRequest(token: string, query: string, variables?: Record<string, unknown>): Promise<any> {
  const maxAttempts = 3
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(MONDAY_API_URL, {
      method: "POST",
      headers: {
        "Authorization": token,
        "Content-Type": "application/json",
        "API-Version": MONDAY_API_VERSION,
      },
      body: JSON.stringify({ query, variables }),
    })

    if (res.status === 429) {
      if (attempt === maxAttempts) throw new Error("Monday API: rate limit (429) excedido após 3 tentativas")
      await new Promise((r) => setTimeout(r, 5000 * attempt))
      continue
    }

    const json = await res.json()
    if (json.errors) {
      throw new Error(`Monday API GraphQL error: ${JSON.stringify(json.errors)}`)
    }
    return json.data
  }
  throw new Error("Monday API: falha inesperada após retries")
}

const ITEM_FIELDS = `
  id
  name
  updated_at
  group { id title }
  column_values(ids: ["project_status", "project_owner", "project_timeline", "project_priority"]) {
    id
    text
    value
  }
`

async function fetchBoardMeta(token: string): Promise<{ statusSettings: StatusColumnSettings; groups: MondayGroup[] }> {
  const data = await mondayRequest(
    token,
    `query {
      boards(ids: [${BOARD_ID}]) {
        columns(ids: ["project_status"]) { id settings_str }
        groups { id title }
      }
    }`
  )
  const board = data.boards?.[0]
  const settingsStr = board?.columns?.[0]?.settings_str ?? "{}"
  let statusSettings: StatusColumnSettings = {}
  try {
    statusSettings = JSON.parse(settingsStr)
  } catch {
    statusSettings = {}
  }
  const groups: MondayGroup[] = board?.groups ?? []
  return { statusSettings, groups }
}

async function fetchFirstPage(token: string): Promise<ItemsPage> {
  const data = await mondayRequest(
    token,
    `query {
      boards(ids: [${BOARD_ID}]) {
        items_page(limit: ${PAGE_LIMIT}) {
          cursor
          items { ${ITEM_FIELDS} }
        }
      }
    }`
  )
  return data.boards?.[0]?.items_page as ItemsPage
}

async function fetchNextPage(token: string, cursor: string): Promise<ItemsPage> {
  const data = await mondayRequest(
    token,
    `query ($cursor: String!) {
      next_items_page(limit: ${PAGE_LIMIT}, cursor: $cursor) {
        cursor
        items { ${ITEM_FIELDS} }
      }
    }`,
    { cursor }
  )
  return data.next_items_page as ItemsPage
}

// ── Parsing helpers ───────────────────────────────────────────────────────────

function buildDoneMap(settings: StatusColumnSettings): Map<string, boolean> {
  const doneColors = new Set(settings.done_colors ?? [])
  const colorMapping = settings.color_mapping ?? {}
  const map = new Map<string, boolean>()
  for (const idx of Object.keys(settings.labels ?? {})) {
    // Quando o índice não aparece em color_mapping, o próprio índice é o color id
    // (mapeamento identidade) — não significa "sem cor".
    const colorId = colorMapping[idx] !== undefined ? colorMapping[idx] : Number(idx)
    map.set(idx, doneColors.has(colorId))
  }
  return map
}

function getColumnValue(item: MondayItem, columnId: string): MondayColumnValue | undefined {
  return item.column_values.find((c) => c.id === columnId)
}

function extrairCliente(nome: string): string {
  const antes = nome.split(" - ")[0].trim()
  const semPrefixo = antes.replace(/^\d+[ºo°]\s*(ano\s*)?/i, "").trim()
  const resultado = semPrefixo.length > 0 ? semPrefixo : antes
  return resultado.toUpperCase()
}

function parseStatus(item: MondayItem, doneMap: Map<string, boolean>): { status: string; isDone: boolean } {
  const col = getColumnValue(item, "project_status")
  const status = col?.text ?? ""
  let isDone = false
  if (col?.value) {
    try {
      const parsed = JSON.parse(col.value)
      const idx = String(parsed.index)
      isDone = doneMap.get(idx) ?? false
    } catch {
      isDone = false
    }
  }
  return { status, isDone }
}

function parsePriority(item: MondayItem): string | null {
  const col = getColumnValue(item, "project_priority")
  const text = (col?.text ?? "").trim()
  return text.length > 0 ? text : null
}

function parseTimeline(item: MondayItem): { inicio: string | null; fim: string | null } {
  const col = getColumnValue(item, "project_timeline")
  if (!col?.value) return { inicio: null, fim: null }
  try {
    const parsed = JSON.parse(col.value)
    return { inicio: parsed.from ?? null, fim: parsed.to ?? null }
  } catch {
    return { inicio: null, fim: null }
  }
}

function parseResponsaveis(item: MondayItem): { id: number; name: string }[] {
  const col = getColumnValue(item, "project_owner")
  if (!col?.value) return []
  let parsed: any
  try {
    parsed = JSON.parse(col.value)
  } catch {
    return []
  }
  const persons = (parsed.personsAndTeams ?? []).filter((p: any) => p.kind === "person")
  const names = (col.text ?? "").split(",").map((s: string) => s.trim()).filter(Boolean)
  return persons.map((p: any, i: number) => ({ id: p.id, name: names[i] ?? `Usuário ${p.id}` }))
}

// ── Main ──────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  const errors: string[] = []

  try {
    const mondayToken = Deno.env.get("MONDAY_API_TOKEN")
    if (!mondayToken) {
      return new Response(JSON.stringify({ error: "MONDAY_API_TOKEN não configurado como secret na Edge Function" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // ── Metadados do board: labels de status (is_done) e grupos ─────────────
    const { statusSettings, groups } = await fetchBoardMeta(mondayToken)
    const doneMap = buildDoneMap(statusSettings)

    if (groups.length > 0) {
      const { error: groupsErr } = await supabase
        .from("marketing_grupos")
        .upsert(
          groups.map((g) => ({ group_id: g.id, nome: g.title, is_arquivo: false })),
          { onConflict: "group_id", ignoreDuplicates: true }
        )
      if (groupsErr) errors.push(`Upsert grupos: ${groupsErr.message}`)
    }

    // ── Paginação dos itens ──────────────────────────────────────────────────
    let synced = 0
    let page: ItemsPage = await fetchFirstPage(mondayToken)

    while (true) {
      const demandas: DemandaRow[] = []
      const responsaveis: ResponsavelRow[] = []
      const nowIso = new Date().toISOString()

      for (const item of page.items) {
        try {
          const { status, isDone } = parseStatus(item, doneMap)
          const prioridade = parsePriority(item)
          const { inicio, fim } = parseTimeline(item)
          const pessoas = parseResponsaveis(item)
          const itemId = Number(item.id)

          demandas.push({
            id: itemId,
            group_id: item.group.id,
            nome: item.name,
            cliente_extraido: extrairCliente(item.name),
            status,
            status_is_done: isDone,
            prioridade,
            data_inicio: inicio,
            data_fim: fim,
            monday_updated_at: item.updated_at,
            synced_at: nowIso,
          })

          for (const p of pessoas) {
            responsaveis.push({ item_id: itemId, person_id: p.id, person_name: p.name })
          }
        } catch (itemErr) {
          errors.push(`Item ${item.id}: ${String(itemErr)}`)
        }
      }

      if (demandas.length > 0) {
        const { error: upsertErr } = await supabase
          .from("marketing_demandas")
          .upsert(demandas, { onConflict: "id" })
        if (upsertErr) {
          errors.push(`Upsert demandas (página): ${upsertErr.message}`)
        } else {
          synced += demandas.length

          const itemIds = demandas.map((d) => d.id)
          const { error: delErr } = await supabase
            .from("marketing_demandas_responsaveis")
            .delete()
            .in("item_id", itemIds)
          if (delErr) errors.push(`Delete responsaveis (página): ${delErr.message}`)

          if (responsaveis.length > 0) {
            const { error: insErr } = await supabase
              .from("marketing_demandas_responsaveis")
              .insert(responsaveis)
            if (insErr) errors.push(`Insert responsaveis (página): ${insErr.message}`)
          }
        }
      }

      if (!page.cursor) break
      page = await fetchNextPage(mondayToken, page.cursor)
    }

    return new Response(
      JSON.stringify({ synced, groups: groups.length, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err), errors }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
