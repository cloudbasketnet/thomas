import { db } from '@/lib/supabase'
import { MAPPERS, TABLES, settingsMapper, type Collection } from '@/lib/mappers'
import type { Settings } from '@/types'
import {
  ACCOUNTS, BILLS, BUDGETS, DOCUMENTS, GOALS, LOANS, NOTES, PEOPLE, PRICE_WATCH, PURCHASES, SETTINGS, TRANSACTIONS,
} from '@/data/seed'

const COLLECTIONS = Object.keys(TABLES) as Collection[]

export interface RemoteData {
  settings: Settings
  accounts: any[]
  transactions: any[]
  budgets: any[]
  loans: any[]
  people: any[]
  bills: any[]
  documents: any[]
  notes: any[]
  goals: any[]
  purchases: any[]
  priceWatch: any[]
}

/** Read every table for the signed-in user. RLS scopes the rows, so no filter is needed. */
export async function pullAll(): Promise<RemoteData> {
  const client = db()

  const [settingsRes, ...rest] = await Promise.all([
    client.from('settings').select('*').maybeSingle(),
    ...COLLECTIONS.map((c) => client.from(TABLES[c]).select('*')),
  ])

  if (settingsRes.error) throw settingsRes.error

  const out: any = {
    settings: settingsRes.data ? settingsMapper.from(settingsRes.data) : SETTINGS,
  }

  rest.forEach((res, i) => {
    if (res.error) throw res.error
    const key = COLLECTIONS[i]
    out[key] = (res.data ?? []).map(MAPPERS[key].from)
  })

  return out as RemoteData
}

/** True when the account has no rows at all — i.e. a fresh sign-up. */
export async function isEmpty(): Promise<boolean> {
  const { count, error } = await db()
    .from('accounts')
    .select('id', { count: 'exact', head: true })
  if (error) throw error
  return (count ?? 0) === 0
}

/** Populate a brand-new account with the demo dataset so the app isn't blank. */
export async function seedRemote(userId: string): Promise<void> {
  const client = db()
  const stamp = (rows: any[], c: Collection) =>
    rows.map((r) => ({ ...MAPPERS[c].to(r), user_id: userId }))

  const payloads: [Collection, any[]][] = [
    ['accounts', ACCOUNTS],
    ['people', PEOPLE],
    ['transactions', TRANSACTIONS],
    ['budgets', BUDGETS],
    ['loans', LOANS],
    ['bills', BILLS],
    ['documents', DOCUMENTS],
    ['notes', NOTES],
    ['goals', GOALS],
    ['purchases', PURCHASES],
    ['priceWatch', PRICE_WATCH],
  ]

  await upsertSettings(SETTINGS, userId)

  for (const [collection, rows] of payloads) {
    const { error } = await client.from(TABLES[collection]).upsert(stamp(rows, collection))
    if (error) throw error
  }
}

export async function upsertRow(collection: Collection, item: any, userId: string) {
  const row = { ...MAPPERS[collection].to(item), user_id: userId }
  const { error } = await db().from(TABLES[collection]).upsert(row)
  if (error) throw error
}

export async function deleteRow(collection: Collection, id: string) {
  const { error } = await db().from(TABLES[collection]).delete().eq('id', id)
  if (error) throw error
}

export async function upsertSettings(settings: Settings, userId: string) {
  const { error } = await db()
    .from('settings')
    .upsert({ ...settingsMapper.to(settings), user_id: userId })
  if (error) throw error
}

/** Push the entire local dataset up — used by "Sync to cloud" in Settings. */
export async function pushAll(state: any, userId: string) {
  const client = db()
  await upsertSettings(state.settings, userId)
  for (const c of COLLECTIONS) {
    const rows = (state[c] ?? []).map((r: any) => ({ ...MAPPERS[c].to(r), user_id: userId }))
    if (!rows.length) continue
    const { error } = await client.from(TABLES[c]).upsert(rows)
    if (error) throw error
  }
}
