import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Check, CopyCheck, FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import { Modal, Field } from '@/components/ui/Modal'
import { useStore } from '@/store/useStore'
import { parseStatement, parseStatementText, readFileAsDataUrl } from '@/lib/gemini'
import { buildIndex, suggestFromHistory, validate } from '@/lib/categorise'
import { categoriesOf } from '@/lib/selectors'
import { summarise, toCandidates, type CandidateRow } from '@/lib/statement'
import { fmtDate, money } from '@/lib/format'
import type { Currency, Transaction, TxnType } from '@/types'

const MAX_MB = 12
const TEXT_TYPES = ['text/csv', 'text/plain', 'application/csv', 'text/tab-separated-values']

const FALLBACK: Record<TxnType, string[]> = {
  expense: ['Groceries', 'Home / Rent', 'Utilities', 'Transport', 'Health', 'Restaurants', 'Shopping', 'Other'],
  income: ['Salary', 'Business Income', 'Investment', 'Other Income'],
}

export function StatementImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { accounts, categories, subcategories, transactions, addTransaction } = useStore()

  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<CandidateRow[] | null>(null)
  const [meta, setMeta] = useState<{ account?: string; from?: string; to?: string }>({})
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [currency, setCurrency] = useState<Currency>('AED')
  const abort = useRef<AbortController | null>(null)

  useEffect(() => {
    if (open) return
    abort.current?.abort()
    setFile(null)
    setRows(null)
    setError(null)
    setBusy(false)
    setMeta({})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => setAccountId((id) => id || accounts[0]?.id || ''), [accounts])

  /** Category names available for each direction, falling back before setup. */
  const optionsFor = (type: TxnType) => {
    const owned = categoriesOf(categories, type)
    return owned.length ? owned.map((c) => c.name) : FALLBACK[type]
  }

  const indexes = useMemo(
    () => ({ expense: buildIndex(transactions, 'expense'), income: buildIndex(transactions, 'income') }),
    [transactions],
  )

  /** Guess a category locally. The model is not asked per row — a statement can
   *  hold hundreds, and the daily quota would be gone in one import. */
  const categorise = (description: string, type: TxnType) => {
    const guess = validate(
      suggestFromHistory(description, indexes[type]),
      categories, subcategories, type, FALLBACK[type],
    )
    return {
      category: guess?.category ?? optionsFor(type)[optionsFor(type).length - 1] ?? 'Other',
      subcategory: guess?.subcategory,
    }
  }

  const choose = async (f: File | undefined) => {
    if (!f) return
    setError(null)
    setRows(null)
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(`That file is ${(f.size / 1024 / 1024).toFixed(1)}MB — please use one under ${MAX_MB}MB.`)
      return
    }
    setFile(f)
  }

  const extract = async () => {
    if (!file) return
    setBusy(true)
    setError(null)
    abort.current = new AbortController()
    try {
      const isText = TEXT_TYPES.includes(file.type) || /\.(csv|tsv|txt)$/i.test(file.name)
      const parsed = isText
        ? await parseStatementText(await file.text(), abort.current.signal)
        : await parseStatement(await readFileAsDataUrl(file), file.type || 'application/pdf', abort.current.signal)

      setMeta({ account: parsed.account, from: parsed.periodStart, to: parsed.periodEnd })
      if (parsed.currency && ['AED', 'INR', 'USD'].includes(parsed.currency)) {
        setCurrency(parsed.currency as Currency)
      }

      const candidates = toCandidates(parsed.rows, transactions, categorise)
      setRows(candidates)
      if (!candidates.length) {
        setError('No transaction rows were found. If this is a scanned statement, try a clearer copy or the CSV export.')
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError(e instanceof Error ? e.message : String(e))
    }
    setBusy(false)
  }

  const patch = (id: string, p: Partial<CandidateRow>) =>
    setRows((rs) => (rs ? rs.map((r) => (r.id === id ? { ...r, ...p } : r)) : rs))

  const setAll = (include: boolean, onlyNew = false) =>
    setRows((rs) => (rs ? rs.map((r) => (onlyNew && r.duplicateOf ? r : { ...r, include })) : rs))

  const stats = rows ? summarise(rows) : null

  const confirm = () => {
    for (const r of rows ?? []) {
      if (!r.include) continue
      const payload: Omit<Transaction, 'id'> = {
        type: r.type,
        date: r.date,
        description: r.description,
        category: r.category,
        subcategory: r.subcategory,
        accountId,
        amount: r.amount,
        currency,
        person: 'Me',
        method: 'Bank Transfer',
        notes: `Imported from ${file?.name ?? 'a statement'}`,
      }
      addTransaction(payload)
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Import a Statement"
      subtitle="Read a bank or card statement and add every transaction at once"
      width="max-w-5xl"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          {rows ? (
            <button
              className="btn-primary disabled:opacity-50"
              disabled={!stats?.selected || !accountId}
              onClick={confirm}
            >
              <Check size={15} /> Import {stats?.selected ?? 0} transaction{stats?.selected === 1 ? '' : 's'}
            </button>
          ) : (
            <button className="btn-primary disabled:opacity-50" disabled={!file || busy} onClick={extract}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />}
              {busy ? 'Reading statement…' : 'Read statement'}
            </button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 flex items-start gap-2">
            <AlertCircle size={15} className="text-amber-600 mt-0.5 shrink-0" />
            <p className="text-[12px] text-amber-900">{error}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <label className="btn-ghost cursor-pointer">
            <Upload size={15} /> {file ? 'Choose another' : 'Choose statement'}
            <input
              type="file"
              accept="application/pdf,text/csv,text/plain,image/png,image/jpeg,image/webp,.csv,.tsv"
              className="hidden"
              onChange={(e) => choose(e.target.files?.[0])}
            />
          </label>
          {file && (
            <span className="text-[12px] text-slate-500">
              {file.name} · {(file.size / 1024).toFixed(0)} KB
            </span>
          )}
        </div>

        {!rows && !busy && (
          <p className="text-[12px] text-slate-500 leading-relaxed">
            PDF, CSV or a photo of a statement. Every row is matched against what you already have, so re-importing an
            overlapping period will not double anything up. Nothing is saved until you confirm.
          </p>
        )}

        {busy && (
          <p className="text-[12px] text-slate-500">
            A long statement can take up to a minute — it is being read page by page.
          </p>
        )}

        {rows && rows.length > 0 && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Field label="Into account">
                <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  {accounts.length === 0 && <option value="">No accounts yet — add one first</option>}
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Currency">
                <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
                  <option>AED</option>
                  <option>INR</option>
                  <option>USD</option>
                </select>
              </Field>
              <div className="col-span-2 self-end pb-1 text-[11.5px] text-slate-500 leading-relaxed">
                {meta.account ? (
                  <>
                    Read <b className="text-slate-700">{meta.account}</b>
                    {meta.from && meta.to ? `, ${fmtDate(meta.from)} – ${fmtDate(meta.to)}` : ''}.{' '}
                  </>
                ) : null}
                {stats?.duplicates ? (
                  <>
                    <b className="text-slate-700">{stats.duplicates}</b> row
                    {stats.duplicates === 1 ? '' : 's'} already recorded, left unticked.
                  </>
                ) : (
                  'Nothing here looks already recorded.'
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button className="btn-ghost h-8 px-3 text-[12px]" onClick={() => setAll(true, true)}>
                <CopyCheck size={13} /> Select all new
              </button>
              <button className="btn-ghost h-8 px-3 text-[12px]" onClick={() => setAll(true)}>
                Select everything
              </button>
              <button className="btn-ghost h-8 px-3 text-[12px]" onClick={() => setAll(false)}>
                Clear
              </button>
              {stats && (
                <span className="text-[11.5px] text-slate-500 ml-auto">
                  {stats.selected} of {stats.total} selected · in {money(stats.income, currency)} · out{' '}
                  {money(stats.expense, currency)}
                </span>
              )}
            </div>

            <div className="rounded-xl border border-[#e8edf5] overflow-x-auto scroll-thin max-h-[46vh]">
              <table className="w-full min-w-[720px]">
                <thead className="bg-slate-50/70 sticky top-0">
                  <tr>
                    <th className="th w-10"></th>
                    <th className="th">Date</th>
                    <th className="th">Description</th>
                    <th className="th">Category</th>
                    <th className="th">In / Out</th>
                    <th className="th text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {rows.map((r) => (
                    <tr key={r.id} className={r.duplicateOf ? 'bg-amber-50/40' : ''}>
                      <td className="td">
                        <input
                          type="checkbox"
                          checked={r.include}
                          onChange={() => patch(r.id, { include: !r.include })}
                          className="accent-brand-600 h-4 w-4 cursor-pointer"
                        />
                      </td>
                      <td className="td text-slate-500 whitespace-nowrap">{fmtDate(r.date)}</td>
                      <td className="td">
                        <input
                          className="input h-8 text-[12.5px]"
                          value={r.description}
                          onChange={(e) => patch(r.id, { description: e.target.value })}
                        />
                        {r.duplicateOf && (
                          <p className="text-[10.5px] text-amber-700 mt-1">
                            Already recorded as “{r.duplicateOf.description}” on {fmtDate(r.duplicateOf.date)}
                          </p>
                        )}
                      </td>
                      <td className="td">
                        <select
                          className="input h-8 text-[12.5px]"
                          value={r.category}
                          onChange={(e) => patch(r.id, { category: e.target.value, subcategory: undefined })}
                        >
                          {optionsFor(r.type).map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      </td>
                      <td className="td">
                        <select
                          className="input h-8 text-[12.5px] w-24"
                          value={r.type}
                          onChange={(e) => patch(r.id, { type: e.target.value as TxnType, category: optionsFor(e.target.value as TxnType)[0] })}
                        >
                          <option value="expense">Out</option>
                          <option value="income">In</option>
                        </select>
                      </td>
                      <td
                        className={`td text-right font-bold tabular-nums whitespace-nowrap ${
                          r.type === 'income' ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {r.type === 'income' ? '+' : '−'}
                        {money(r.amount, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-[11.5px] text-slate-500">
              Categories are guessed from your own history, so they get better the more you record. Everything stays
              editable here and afterwards.
            </p>
          </>
        )}
      </div>
    </Modal>
  )
}
