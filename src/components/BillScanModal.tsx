import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Check, FileText, Loader2, ScanLine, Trash2, Upload } from 'lucide-react'
import { Modal, Field } from '@/components/ui/Modal'
import { PURCHASE_CATEGORIES, readFileAsDataUrl, scanBill, type ScannedItem } from '@/lib/gemini'
import { convert, money, TODAY } from '@/lib/format'
import type { Currency, Purchase } from '@/types'

const STATUSES: Purchase['status'][] = ['Planned', 'Ordered', 'Delivered', 'Returned']
const MAX_MB = 8

interface Row extends ScannedItem {
  id: string
  include: boolean
}

export function BillScanModal({
  open,
  onClose,
  people,
  onAdd,
}: {
  open: boolean
  onClose: () => void
  people: string[]
  /** Called once per confirmed line item. */
  onAdd: (p: Omit<Purchase, 'id'>) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [meta, setMeta] = useState({ store: '', date: '', currency: 'AED' as Currency, total: 0 })
  const [person, setPerson] = useState(people[0] ?? 'Me')
  const [status, setStatus] = useState<Purchase['status']>('Delivered')
  const abort = useRef<AbortController | null>(null)

  // Reset when the modal closes, and drop any in-flight request.
  useEffect(() => {
    if (open) return
    abort.current?.abort()
    setFile(null)
    setPreview(null)
    setRows(null)
    setError(null)
    setBusy(false)
    setMeta({ store: '', date: '', currency: 'AED', total: 0 })
  }, [open])

  useEffect(() => setPerson(people[0] ?? 'Me'), [people])

  const choose = async (f: File | undefined) => {
    if (!f) return
    setError(null)
    setRows(null)
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(`That file is ${(f.size / 1024 / 1024).toFixed(1)}MB — please use one under ${MAX_MB}MB.`)
      return
    }
    setFile(f)
    try {
      setPreview(await readFileAsDataUrl(f))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const extract = async () => {
    if (!file || !preview) return
    setBusy(true)
    setError(null)
    abort.current = new AbortController()
    try {
      const bill = await scanBill(preview, file.type || 'image/jpeg', abort.current.signal)
      const known = ['AED', 'INR', 'USD'] as const
      setMeta({
        store: bill.store ?? '',
        date: bill.date ?? '',
        currency: known.includes(bill.currency as Currency) ? (bill.currency as Currency) : 'AED',
        total: Number(bill.total) || 0,
      })
      setRows(
        (bill.items ?? []).map((it, i) => ({
          id: `r${i}`,
          include: true,
          item: it.item ?? '',
          category: (PURCHASE_CATEGORIES as readonly string[]).includes(it.category) ? it.category : 'Other',
          qty: Number(it.qty) || 1,
          price: Number(it.price) || 0,
        })),
      )
      if (!bill.items?.length) setError('No line items were found on that image. Try a sharper, straight-on photo.')
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError(e instanceof Error ? e.message : String(e))
    }
    setBusy(false)
  }

  const patch = (id: string, p: Partial<Row>) =>
    setRows((rs) => (rs ? rs.map((r) => (r.id === id ? { ...r, ...p } : r)) : rs))

  const chosen = rows?.filter((r) => r.include && r.item.trim() && r.price > 0) ?? []
  /** Purchases are stored in AED, so convert whatever the receipt was priced in. */
  const toAed = (n: number) => Math.round(convert(n, meta.currency, 'AED') * 100) / 100
  const chosenTotal = chosen.reduce((a, r) => a + toAed(r.price) * r.qty, 0)

  const confirm = () => {
    for (const r of chosen) {
      onAdd({
        item: r.item.trim(),
        store: meta.store.trim() || '—',
        category: r.category,
        price: toAed(r.price),
        qty: r.qty,
        date: meta.date || TODAY,
        person,
        status,
        notes: `Scanned from ${file?.name ?? 'a bill'}`,
      })
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Scan a Bill"
      subtitle="Upload a receipt photo and Gemini reads the line items"
      width="max-w-3xl"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          {rows ? (
            <button className="btn-primary disabled:opacity-50" disabled={!chosen.length} onClick={confirm}>
              <Check size={15} /> Add {chosen.length} purchase{chosen.length === 1 ? '' : 's'}
              {chosen.length > 0 ? ` · ${money(chosenTotal)}` : ''}
            </button>
          ) : (
            <button className="btn-primary disabled:opacity-50" disabled={!file || busy} onClick={extract}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : <ScanLine size={15} />}
              {busy ? 'Reading bill…' : 'Extract details'}
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
            <Upload size={15} /> {file ? 'Choose another' : 'Choose bill image'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/heic,application/pdf"
              className="hidden"
              onChange={(e) => choose(e.target.files?.[0])}
            />
          </label>
          {file && (
            <span className="text-[12px] text-slate-500 inline-flex items-center gap-1.5">
              <FileText size={13} /> {file.name} · {(file.size / 1024).toFixed(0)} KB
            </span>
          )}
        </div>

        {preview && file?.type.startsWith('image/') && (
          <img
            src={preview}
            alt="Bill preview"
            className="max-h-56 rounded-xl border border-[#e8edf5] object-contain bg-slate-50"
          />
        )}

        {!rows && !busy && (
          <p className="text-[12px] text-slate-500 leading-relaxed">
            Works with a photo or screenshot of a receipt, invoice or delivery note. Every extracted row is editable
            before anything is saved.
          </p>
        )}

        {rows && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Field label="Store">
                <input className="input" value={meta.store} onChange={(e) => setMeta({ ...meta, store: e.target.value })} />
              </Field>
              <Field label="Date">
                <input className="input" type="date" value={meta.date} onChange={(e) => setMeta({ ...meta, date: e.target.value })} />
              </Field>
              <Field label="Bill currency">
                <select
                  className="input"
                  value={meta.currency}
                  onChange={(e) => setMeta({ ...meta, currency: e.target.value as Currency })}
                >
                  <option>AED</option>
                  <option>INR</option>
                  <option>USD</option>
                </select>
              </Field>
              <Field label="Status">
                <select className="input" value={status} onChange={(e) => setStatus(e.target.value as Purchase['status'])}>
                  {STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <Field label="Person" className="w-44">
                <select className="input" value={person} onChange={(e) => setPerson(e.target.value)}>
                  {(people.length ? people : ['Me', 'Family', 'Others']).map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </Field>
              {meta.total > 0 && (
                <p className="text-[11.5px] text-slate-500 pb-2.5">
                  Bill total read as <b className="text-slate-700">{money(meta.total, meta.currency)}</b>
                  {meta.currency !== 'AED' ? ` · ${money(toAed(meta.total))} at current rates` : ''}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-[#e8edf5] overflow-x-auto scroll-thin">
              <table className="w-full min-w-[560px]">
                <thead className="bg-slate-50/70">
                  <tr>
                    <th className="th w-10"></th>
                    <th className="th">Item</th>
                    <th className="th">Category</th>
                    <th className="th text-right w-20">Qty</th>
                    <th className="th text-right w-28">Unit price</th>
                    <th className="th w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {rows.map((r) => (
                    <tr key={r.id} className={r.include ? '' : 'opacity-40'}>
                      <td className="td">
                        <input
                          type="checkbox"
                          checked={r.include}
                          onChange={() => patch(r.id, { include: !r.include })}
                          className="accent-brand-600 h-4 w-4 cursor-pointer"
                        />
                      </td>
                      <td className="td">
                        <input
                          className="input h-8 text-[12.5px]"
                          value={r.item}
                          onChange={(e) => patch(r.id, { item: e.target.value })}
                        />
                      </td>
                      <td className="td">
                        <select
                          className="input h-8 text-[12.5px]"
                          value={r.category}
                          onChange={(e) => patch(r.id, { category: e.target.value })}
                        >
                          {PURCHASE_CATEGORIES.map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      </td>
                      <td className="td">
                        <input
                          className="input h-8 text-[12.5px] text-right"
                          type="number"
                          min="1"
                          value={r.qty}
                          onChange={(e) => patch(r.id, { qty: Number(e.target.value) || 1 })}
                        />
                      </td>
                      <td className="td">
                        <input
                          className="input h-8 text-[12.5px] text-right"
                          type="number"
                          value={r.price}
                          onChange={(e) => patch(r.id, { price: Number(e.target.value) || 0 })}
                        />
                      </td>
                      <td className="td">
                        <button
                          onClick={() => setRows((rs) => (rs ? rs.filter((x) => x.id !== r.id) : null))}
                          className="h-7 w-7 grid place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-[11.5px] text-slate-500">
              Check each row before saving — extraction is accurate but not guaranteed.
              {meta.currency !== 'AED' ? ' Prices are converted to AED on save.' : ''}
            </p>
          </>
        )}
      </div>
    </Modal>
  )
}
