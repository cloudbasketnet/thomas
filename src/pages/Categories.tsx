import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, FolderTree, Plus, Sparkles, Tag, Trash2 } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Card, CardHead, Empty, PageHeader, StatCard } from '@/components/ui/Primitives'
import { Modal, Field } from '@/components/ui/Modal'
import { categoriesOf, subcategoriesOf } from '@/lib/selectors'
import type { Category, CategoryKind } from '@/types'

const COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#eab308', '#64748b']

export default function Categories() {
  const {
    categories, subcategories, transactions,
    addCategory, updateCategory, removeCategory,
    addSubcategory, updateSubcategory, removeSubcategory,
    installDefaultCategories,
  } = useStore()

  const [kind, setKind] = useState<CategoryKind>('expense')
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [form, setForm] = useState({ name: '', icon: '📦', color: COLORS[0] })
  const [newSub, setNewSub] = useState<Record<string, string>>({})

  const list = useMemo(() => categoriesOf(categories, kind), [categories, kind])

  /** How many transactions each category name is used by — guards deletion. */
  const usage = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of transactions) {
      const key = `${t.type}:${t.category.trim().toLowerCase()}`
      m.set(key, (m.get(key) ?? 0) + 1)
    }
    return m
  }, [transactions])

  const usedBy = (c: Category) => usage.get(`${c.kind}:${c.name.trim().toLowerCase()}`) ?? 0

  const openNew = () => {
    setEditing(null)
    setForm({ name: '', icon: kind === 'income' ? '💰' : '📦', color: COLORS[0] })
    setModal(true)
  }

  const openEdit = (c: Category) => {
    setEditing(c)
    setForm({ name: c.name, icon: c.icon, color: c.color })
    setModal(true)
  }

  const save = () => {
    const name = form.name.trim()
    if (!name) return
    const clash = categories.some(
      (c) => c.kind === kind && c.id !== editing?.id && c.name.trim().toLowerCase() === name.toLowerCase(),
    )
    if (clash) {
      alert(`You already have a ${kind} category called "${name}".`)
      return
    }
    if (editing) updateCategory(editing.id, { name, icon: form.icon || '📦', color: form.color })
    else addCategory({ name, kind, icon: form.icon || '📦', color: form.color, sort: list.length })
    setModal(false)
  }

  const addSub = (categoryId: string) => {
    const name = (newSub[categoryId] ?? '').trim()
    if (!name) return
    const clash = subcategoriesOf(subcategories, categoryId).some(
      (s) => s.name.trim().toLowerCase() === name.toLowerCase(),
    )
    if (clash) return
    addSubcategory({ categoryId, name, sort: subcategoriesOf(subcategories, categoryId).length })
    setNewSub((s) => ({ ...s, [categoryId]: '' }))
  }

  const del = (c: Category) => {
    const n = usedBy(c)
    const subs = subcategoriesOf(subcategories, c.id).length
    const bits = [
      subs ? `${subs} sub-categor${subs === 1 ? 'y' : 'ies'} will be deleted too` : '',
      n ? `${n} existing transaction${n === 1 ? '' : 's'} use this name and will keep it as plain text` : '',
    ].filter(Boolean)
    if (!confirm(`Delete "${c.name}"?${bits.length ? '\n\n' + bits.join('.\n') + '.' : ''}`)) return
    removeCategory(c.id)
  }

  return (
    <div className="space-y-5 max-w-[1100px]">
      <PageHeader
        title="Categories"
        subtitle="Your own categories, each with its own sub-categories for the expense and income forms."
        actions={
          <>
            {categories.length === 0 && (
              <button className="btn-ghost" onClick={installDefaultCategories}>
                <Sparkles size={15} /> Add starter set
              </button>
            )}
            <button className="btn-primary" onClick={openNew}>
              <Plus size={15} /> New Category
            </button>
          </>
        }
      />

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <StatCard
          label="Expense Categories"
          value={String(categoriesOf(categories, 'expense').length)}
          icon={<Tag size={20} />}
          tint="#f43f5e"
          footer={<span className="text-slate-400">Used on the expense form</span>}
        />
        <StatCard
          label="Income Categories"
          value={String(categoriesOf(categories, 'income').length)}
          icon={<Tag size={20} />}
          tint="#22c55e"
          footer={<span className="text-slate-400">Used on the income form</span>}
        />
        <StatCard
          label="Sub-categories"
          value={String(subcategories.length)}
          icon={<FolderTree size={20} />}
          tint="#8b5cf6"
          footer={<span className="text-slate-400">Across every category</span>}
        />
      </div>

      <div className="flex gap-1 border-b border-[#e8edf5]">
        {(['expense', 'income'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={`px-4 h-10 text-[13px] font-semibold border-b-2 transition cursor-pointer capitalize ${
              kind === k ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {k} ({categoriesOf(categories, k).length})
          </button>
        ))}
      </div>

      <Card>
        <CardHead
          title={`${kind === 'expense' ? 'Expense' : 'Income'} Categories`}
          sub="Click a category to manage its sub-categories"
        />
        <div className="px-5 pb-5 space-y-2">
          {list.map((c) => {
            const subs = subcategoriesOf(subcategories, c.id)
            const isOpen = open[c.id] ?? false
            return (
              <div key={c.id} className="rounded-xl border border-[#eef2f8] overflow-hidden">
                <div className="flex items-center gap-3 px-3.5 py-2.5 bg-slate-50/60">
                  <button
                    onClick={() => setOpen((o) => ({ ...o, [c.id]: !isOpen }))}
                    className="h-6 w-6 grid place-items-center rounded text-slate-400 hover:bg-slate-200 cursor-pointer shrink-0"
                    aria-label={isOpen ? 'Collapse' : 'Expand'}
                  >
                    {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  </button>
                  <span
                    className="h-8 w-8 rounded-lg grid place-items-center text-[15px] shrink-0"
                    style={{ background: `${c.color}1a` }}
                  >
                    {c.icon}
                  </span>
                  <button
                    onClick={() => setOpen((o) => ({ ...o, [c.id]: !isOpen }))}
                    className="flex-1 text-left min-w-0 cursor-pointer"
                  >
                    <p className="text-[13px] font-bold text-slate-800 truncate">{c.name}</p>
                    <p className="text-[11px] text-slate-400">
                      {subs.length} sub-categor{subs.length === 1 ? 'y' : 'ies'}
                      {usedBy(c) > 0 ? ` · used ${usedBy(c)}×` : ''}
                    </p>
                  </button>
                  <button
                    onClick={() => openEdit(c)}
                    className="text-[12px] font-semibold text-brand-600 hover:text-brand-700 cursor-pointer px-2"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => del(c)}
                    className="h-7 w-7 grid place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer shrink-0"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {isOpen && (
                  <div className="px-3.5 py-3 space-y-2">
                    {subs.map((sc) => (
                      <div key={sc.id} className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-300 shrink-0 ml-1" />
                        <input
                          className="input h-8 text-[12.5px] flex-1"
                          value={sc.name}
                          onChange={(e) => updateSubcategory(sc.id, { name: e.target.value })}
                        />
                        <button
                          onClick={() => removeSubcategory(sc.id)}
                          className="h-7 w-7 grid place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer shrink-0"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    {subs.length === 0 && (
                      <p className="text-[12px] text-slate-400 pl-3">
                        No sub-categories yet — add the items you buy under {c.name}.
                      </p>
                    )}
                    <div className="flex items-center gap-2 pt-1">
                      <span className="w-1.5 shrink-0 ml-1" />
                      <input
                        className="input h-8 text-[12.5px] flex-1"
                        placeholder={`Add a sub-category under ${c.name}…`}
                        value={newSub[c.id] ?? ''}
                        onChange={(e) => setNewSub((s) => ({ ...s, [c.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Enter' && addSub(c.id)}
                      />
                      <button className="btn-soft h-8 px-3 text-[12px]" onClick={() => addSub(c.id)}>
                        <Plus size={13} /> Add
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {list.length === 0 && (
            <Empty
              text={
                categories.length === 0
                  ? 'No categories yet — add the starter set above, or create your own.'
                  : `No ${kind} categories yet.`
              }
            />
          )}
        </div>
      </Card>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? 'Edit Category' : `New ${kind === 'expense' ? 'Expense' : 'Income'} Category`}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setModal(false)}>
              Cancel
            </button>
            <button className="btn-primary" onClick={save}>
              {editing ? 'Save Changes' : 'Create Category'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Name" className="col-span-2">
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Groceries"
              autoFocus
            />
          </Field>
          <Field label="Icon (emoji)">
            <input
              className="input"
              value={form.icon}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
              maxLength={2}
            />
          </Field>
          <Field label="Colour">
            <div className="flex gap-2 flex-wrap pt-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setForm({ ...form, color: c })}
                  className={`h-7 w-7 rounded-lg cursor-pointer ${
                    form.color === c ? 'ring-2 ring-offset-2 ring-slate-400' : ''
                  }`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </Field>
        </div>
      </Modal>
    </div>
  )
}
