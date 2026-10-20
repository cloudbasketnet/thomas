import { useMemo, useState } from 'react'
import {
  AlertCircle, BarChart3, Bot, Briefcase, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, Coins, Dumbbell,
  FileText, GraduationCap, Heart, House, Image as ImageIcon, MoreHorizontal, Pencil, Plane, Plus, Search,
  Settings as SettingsIcon, Sparkles, StickyNote, Target, Trash2, User,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useStore } from '@/store/useStore'
import { Card, CardHead, ColorChoice, Empty, PageHeader, Progress, StatCard } from '@/components/ui/Primitives'
import { Modal, Field } from '@/components/ui/Modal'
import { readFileAsDataUrl } from '@/lib/gemini'
import { resizeImage } from '@/lib/image'
import {
  ACTIVITY, ACTIVITY_KINDS, STATUS_TONE, blockMinutes, dayAnalysis, dreamProgress, duration, monthAnalysis, planTiming, planYear,
  sortedDreams, sortedSchedule,
} from '@/lib/vision'
import { TODAY, fmtDate } from '@/lib/format'
import type { ActivityKind, Dream, PlanCategory, ScheduleBlock, VisionWord } from '@/types'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const monthLabel = (key: string) => `${MONTH_NAMES[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`
const shiftMonth = (key: string, by: number) => {
  const d = new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1 + by, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function VisionBoard() {
  const {
    dreams, visionWords, scheduleBlocks, activityLog,
    addDream, updateDream, removeDream,
    addVisionWord, updateVisionWord, removeVisionWord,
    addScheduleBlock, updateScheduleBlock, removeScheduleBlock,
    logActivity, removeActivity,
  } = useStore()

  const [month, setMonth] = useState(TODAY.slice(0, 7))
  const [tab, setTab] = useState<'plans' | 'routine'>('plans')
  const [query, setQuery] = useState('')
  const [dreamModal, setDreamModal] = useState<Dream | 'new' | null>(null)
  const [wordModal, setWordModal] = useState<VisionWord | 'new' | null>(null)
  const [blockModal, setBlockModal] = useState<ScheduleBlock | 'new' | null>(null)

  const board = useMemo(() => sortedDreams(dreams), [dreams])
  const schedule = useMemo(() => sortedSchedule(scheduleBlocks), [scheduleBlocks])
  const today = useMemo(() => dayAnalysis(activityLog, TODAY), [activityLog])
  const mo = useMemo(() => monthAnalysis(activityLog, month, TODAY), [activityLog, month])
  const overall = dreamProgress(dreams)

  const quickAdd = (kind: ActivityKind, minutes: number) => logActivity({ date: TODAY, kind, minutes })

  return (
    <div className="space-y-5 max-w-[1600px]">
      <PageHeader
        title="Vision Board"
        subtitle="Turn your dreams into daily progress."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {tab === 'plans' && (
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="input h-10 w-56 pl-9" placeholder="Search plans…" value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
            )}
            <button className="btn-primary" onClick={() => setDreamModal('new')}>
              <Plus size={15} /> Add Plan
            </button>
          </div>
        }
      />

      <div className="flex gap-1.5">
        {([['plans', 'Plans'], ['routine', 'Daily routine']] as const).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`chip cursor-pointer transition ${tab === k ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === 'plans' && (
        <PlansView dreams={board} query={query} onEdit={(d) => setDreamModal(d)} onAdd={() => setDreamModal('new')} />
      )}

      {tab === 'routine' && (
        <>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Dreams" value={String(dreams.length)} icon={<Target size={20} />} tint="#ec4899"
          footer={<div><div className="text-[10px] text-slate-400 mb-1">{overall}% average progress</div><Progress value={overall} max={100} color="#ec4899" height={5} /></div>} />
        <StatCard label="Rest Today" value={duration(today.rest)} icon={<span className="text-[15px]">🌙</span>} tint="#6366f1"
          footer={<span className="text-slate-400">{today.restPct}% of the day</span>} />
        <StatCard label="Gym Today" value={duration(today.gym)} icon={<span className="text-[15px]">🏋️</span>} tint="#10b981"
          footer={<span className="text-slate-400">{today.gymPct}% of the day</span>} />
        <StatCard label="Gym This Month" value={duration(mo.gymMinutes)} icon={<BarChart3 size={20} />} tint="#2563eb"
          footer={<span className="text-slate-400">Avg {mo.gymHoursPerDay} h a day</span>} />
      </div>

      {/* ---- schedule + today + month ---- */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-12">
        <Card className="lg:col-span-4">
          <CardHead title="📅 My Daily Schedule" sub={fmtDate(TODAY)} right={<button className="btn-soft" onClick={() => setBlockModal('new')}><Plus size={13} /> Add</button>} />
          <div className="px-5 pb-5 space-y-1.5">
            {schedule.length === 0 && <Empty text="No blocks yet — lay out a typical day." />}
            {schedule.map((b) => (
              <div key={b.id} className="flex items-center gap-2.5 rounded-xl border border-[#eef2f8] px-3 py-2">
                <span className="text-[11px] font-semibold text-slate-400 tabular-nums w-[88px] shrink-0">{b.start} – {b.end}</span>
                <span className="text-[14px]">{ACTIVITY[b.kind].emoji}</span>
                <span className="flex-1 text-[12.5px] font-semibold text-slate-700 truncate">{b.label}</span>
                <span className="text-[10.5px] text-slate-400 tabular-nums">{duration(blockMinutes(b))}</span>
                <button onClick={() => setBlockModal(b)} className="h-6 w-6 grid place-items-center rounded-lg text-slate-300 hover:bg-brand-50 hover:text-brand-600 cursor-pointer"><Pencil size={11} /></button>
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-4">
          <CardHead title="⏱️ Today's Time Analysis" sub="Rest, gym and everything else across 24 hours" />
          <div className="px-5 pb-5">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-xl bg-indigo-50 px-3 py-2.5">
                <p className="text-[10.5px] text-slate-500">Rest Time</p>
                <p className="text-[17px] font-extrabold text-slate-900">{duration(today.rest)}</p>
              </div>
              <div className="rounded-xl bg-emerald-50 px-3 py-2.5">
                <p className="text-[10.5px] text-slate-500">Gym Time</p>
                <p className="text-[17px] font-extrabold text-slate-900">{duration(today.gym)}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4">
              {([['Rest', today.restPct, today.rest, '#6366f1'], ['Gym', today.gymPct, today.gym, '#10b981'], ['Other', today.otherPct, today.other, '#94a3b8']] as const).map(([label, pctv, mins, color]) => (
                <div key={label} className="text-center">
                  <Ring value={pctv} color={color} />
                  <p className="text-[12px] font-bold text-slate-700 mt-1">{label}</p>
                  <p className="text-[10px] text-slate-400">{duration(mins)} / 24h</p>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-4">
          <CardHead
            title="📊 This Month Overview"
            right={
              <div className="flex items-center gap-1">
                <button onClick={() => setMonth(shiftMonth(month, -1))} className="h-7 w-7 grid place-items-center rounded-lg border border-[#e8edf5] text-slate-500 hover:bg-slate-50 cursor-pointer"><ChevronLeft size={13} /></button>
                <span className="text-[11.5px] font-semibold text-slate-600 px-1 whitespace-nowrap">{monthLabel(month)}</span>
                <button onClick={() => setMonth(shiftMonth(month, 1))} className="h-7 w-7 grid place-items-center rounded-lg border border-[#e8edf5] text-slate-500 hover:bg-slate-50 cursor-pointer"><ChevronRight size={13} /></button>
              </div>
            }
          />
          <div className="px-5 pb-5">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-xl bg-indigo-50 px-3 py-2.5">
                <p className="text-[10.5px] text-slate-500">Total Rest</p>
                <p className="text-[15px] font-extrabold text-slate-900">{duration(mo.restMinutes)}</p>
                <p className="text-[10px] text-slate-400">Avg {mo.restHoursPerDay} h a day</p>
              </div>
              <div className="rounded-xl bg-emerald-50 px-3 py-2.5">
                <p className="text-[10.5px] text-slate-500">Total Gym</p>
                <p className="text-[15px] font-extrabold text-slate-900">{duration(mo.gymMinutes)}</p>
                <p className="text-[10px] text-slate-400">Avg {mo.gymHoursPerDay} h a day</p>
              </div>
            </div>
            <DayBars days={mo.days} />
          </div>
        </Card>
      </div>

      {/* ---- words + tools + quick add ---- */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <CardHead title="⭐ Important Words" right={<button className="btn-soft" onClick={() => setWordModal('new')}><Plus size={13} /> Add</button>} />
          <div className="px-5 pb-5">
            {visionWords.length === 0 ? (
              <Empty text="No words yet." />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {[...visionWords].sort((a, b) => a.order - b.order).map((w) => (
                  <button key={w.id} onClick={() => setWordModal(w)} className="rounded-2xl p-3 text-center cursor-pointer transition hover:-translate-y-0.5" style={{ background: `${w.color}1a` }}>
                    <div className="text-[20px] leading-none">{w.emoji}</div>
                    <p className="text-[12px] font-bold text-slate-800 mt-1.5 truncate">{w.word}</p>
                    <p className="text-[10px] text-slate-500 truncate">{w.note}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-3">
          <CardHead title="🧰 Tools" />
          <div className="px-5 pb-5 grid grid-cols-2 gap-2.5">
            {[
              { to: '/calendar', label: 'Calendar', icon: <CalendarDays size={16} />, color: '#3b82f6' },
              { to: '/notes', label: 'Notes', icon: <StickyNote size={16} />, color: '#f59e0b' },
              { to: '/documents', label: 'Documents', icon: <FileText size={16} />, color: '#8b5cf6' },
              { to: '/goals', label: 'Savings Goals', icon: <Target size={16} />, color: '#ec4899' },
              { to: '/ai-advisor', label: 'AI Advisor', icon: <Sparkles size={16} />, color: '#0ea5e9' },
              { to: '/ai-employees', label: 'AI Employees', icon: <Bot size={16} />, color: '#10b981' },
              { to: '/reports', label: 'Reports', icon: <BarChart3 size={16} />, color: '#6366f1' },
              { to: '/settings', label: 'Settings', icon: <SettingsIcon size={16} />, color: '#64748b' },
            ].map((t) => (
              <Link key={t.to} to={t.to} className="rounded-2xl p-3 text-center transition hover:-translate-y-0.5" style={{ background: `${t.color}14` }}>
                <span className="grid place-items-center" style={{ color: t.color }}>{t.icon}</span>
                <p className="text-[11px] font-bold text-slate-700 mt-1.5 truncate">{t.label}</p>
              </Link>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-4">
          <CardHead title="⚡ Quick Add Activity" sub={`Logged today · ${today.entries.length} entr${today.entries.length === 1 ? 'y' : 'ies'}`} />
          <div className="px-5 pb-5">
            <div className="grid grid-cols-3 gap-2.5">
              {ACTIVITY_KINDS.filter((k) => k !== 'other').map((k) => (
                <button key={k} onClick={() => quickAdd(k, k === 'sleep' ? 480 : 60)} className="rounded-2xl p-3 text-center cursor-pointer transition hover:-translate-y-0.5" style={{ background: `${ACTIVITY[k].color}14` }}>
                  <div className="text-[17px] leading-none">{ACTIVITY[k].emoji}</div>
                  <p className="text-[11px] font-bold text-slate-700 mt-1.5">{ACTIVITY[k].label}</p>
                  <p className="text-[9.5px] text-slate-400">+{k === 'sleep' ? '8h' : '1h'}</p>
                </button>
              ))}
            </div>
            {today.entries.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {today.entries.map((e) => (
                  <div key={e.id} className="flex items-center gap-2 text-[11.5px] rounded-lg bg-slate-50 px-2.5 py-1.5">
                    <span>{ACTIVITY[e.kind].emoji}</span>
                    <span className="flex-1 font-semibold text-slate-600">{ACTIVITY[e.kind].label}</span>
                    <span className="text-slate-500 tabular-nums">{duration(e.minutes)}</span>
                    <button onClick={() => removeActivity(e.id)} className="text-slate-300 hover:text-rose-600 cursor-pointer"><Trash2 size={11} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

        </>
      )}

      <DreamModal
        value={dreamModal}
        onClose={() => setDreamModal(null)}
        onSave={(d) => { dreamModal === 'new' ? addDream({ ...d, order: dreams.length }) : updateDream((dreamModal as Dream).id, d); setDreamModal(null) }}
        onRemove={() => { if (dreamModal && dreamModal !== 'new') removeDream(dreamModal.id); setDreamModal(null) }}
      />
      <WordModal
        value={wordModal}
        onClose={() => setWordModal(null)}
        onSave={(w) => { wordModal === 'new' ? addVisionWord({ ...w, order: visionWords.length }) : updateVisionWord((wordModal as VisionWord).id, w); setWordModal(null) }}
        onRemove={() => { if (wordModal && wordModal !== 'new') removeVisionWord(wordModal.id); setWordModal(null) }}
      />
      <BlockModal
        value={blockModal}
        onClose={() => setBlockModal(null)}
        onSave={(b) => { blockModal === 'new' ? addScheduleBlock({ ...b, order: scheduleBlocks.length }) : updateScheduleBlock((blockModal as ScheduleBlock).id, b); setBlockModal(null) }}
        onRemove={() => { if (blockModal && blockModal !== 'new') removeScheduleBlock(blockModal.id); setBlockModal(null) }}
      />
    </div>
  )
}

/** A percentage as a ring — the three donuts in Today's Time Analysis. */
function Ring({ value, color, caption }: { value: number; color: string; caption?: string }) {
  const r = 26
  const c = 2 * Math.PI * r
  const v = Math.min(100, Math.max(0, value))
  const dash = (v / 100) * c
  const ring = (
    <svg viewBox="0 0 64 64" className="w-full max-w-[64px] mx-auto" role="img" aria-label={`${caption ?? ''} ${value}%`}>
      <circle cx="32" cy="32" r={r} fill="none" stroke="#eef2f8" strokeWidth="7" />
      {/* At 0 a round line cap still paints a dot, so there is no arc at all. */}
      {v > 0 && (
        <circle
          cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`} transform="rotate(-90 32 32)"
        />
      )}
      <text x="32" y="36" textAnchor="middle" className="fill-slate-800" style={{ fontSize: 15, fontWeight: 800 }}>{value}%</text>
    </svg>
  )
  if (!caption) return ring
  return (
    <div className="text-center w-[70px]">
      {ring}
      <p className="text-[10px] font-semibold text-slate-500 mt-1 leading-tight">{caption}</p>
    </div>
  )
}

/** The time-left ring's colour: plenty left, getting on, nearly out. */
const timeColor = (pct: number) => (pct > 50 ? '#3b82f6' : pct > 20 ? '#f59e0b' : '#ef4444')

/** One bar per day of the month — rest behind, gym in front. */
function DayBars({ days }: { days: { day: number; rest: number; gym: number }[] }) {
  const max = Math.max(60, ...days.map((d) => Math.max(d.rest, d.gym)))
  return (
    <div className="mt-4">
      <div className="flex items-end gap-[2px] h-[70px]">
        {days.map((d) => (
          <div key={d.day} className="flex-1 flex flex-col justify-end gap-[1px]" title={`${d.day}: rest ${duration(d.rest)}, gym ${duration(d.gym)}`}>
            <div className="rounded-t-sm bg-indigo-300" style={{ height: `${(d.rest / max) * 100}%` }} />
            <div className="rounded-t-sm bg-emerald-400" style={{ height: `${(d.gym / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400">
        <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-indigo-300 inline-block" /> Rest</span>
        <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-emerald-400 inline-block" /> Gym</span>
        <span className="ml-auto">1 – {days.length}</span>
      </div>
    </div>
  )
}

/** Larger files are refused outright — reading one in can stall a phone. */
const MAX_PHOTO_MB = 15
/** Longest side a plan photo is stored at. Plenty for a thumbnail, small in storage. */
const SAVED_EDGE = 640

const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`
/** A data URL's real size: base64 carries 3 bytes in every 4 characters. */
const kilobytes = (dataUrl: string) => `${Math.round(((dataUrl.length - dataUrl.indexOf(',') - 1) * 3) / 4 / 1024)} KB`
const dimensions = (src: string) =>
  new Promise<{ w: number; h: number }>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => reject(new Error('That file could not be read as an image.'))
    img.src = src
  })

const PALETTE = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#2563eb', '#64748b']

function DreamModal({ value, onClose, onSave, onRemove }: {
  value: Dream | 'new' | null
  onClose: () => void
  onSave: (d: Omit<Dream, 'id' | 'order'>) => void
  onRemove: () => void
}) {
  const editing = value && value !== 'new' ? value : null
  const [form, setForm] = useState({ title: '', note: '', emoji: '⭐', color: PALETTE[0], progress: 0, image: '', targetDate: '', startDate: '', category: 'Personal' as PlanCategory })
  const [seeded, setSeeded] = useState<string | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const [imageNote, setImageNote] = useState<string | null>(null)
  const key = editing?.id ?? 'new'
  if (value && seeded !== key) {
    setSeeded(key)
    setImageNote(null)
    setImageError(null)
    setForm({
      title: editing?.title ?? '', note: editing?.note ?? '', emoji: editing?.emoji ?? '⭐',
      startDate: editing?.startDate ?? '', category: editing?.category ?? 'Personal',
      color: editing?.color ?? PALETTE[0], progress: editing?.progress ?? 0,
      image: editing?.image ?? '', targetDate: editing?.targetDate ?? '',
    })
  }
  if (!value) return null

  // A photo is held as a data URL so the board works offline and needs no
  // bucket — which means it also goes into localStorage with the rest of the
  // store. A phone photo is several megabytes and base64 makes it a third
  // bigger again, which is enough on its own to blow Safari's quota for the
  // whole origin. So it is scaled down first, as every other photo in the app
  // already is.
  const pickImage = async (file?: File) => {
    if (!file) return
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      setImageError(`That photo is ${megabytes(file.size)}. Please choose one under ${MAX_PHOTO_MB} MB.`)
      return
    }
    try {
      const raw = await readFileAsDataUrl(file)
      const [from, small] = await Promise.all([dimensions(raw), resizeImage(raw, SAVED_EDGE)])
      const to = await dimensions(small)
      setForm((f) => ({ ...f, image: small }))
      setImageError(null)
      setImageNote(`Saved at ${to.w} × ${to.h} px · ${kilobytes(small)} (from ${from.w} × ${from.h} px, ${megabytes(file.size)})`)
    } catch (e) {
      setImageError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? 'Edit plan' : 'Add a plan'}
      subtitle="A picture, a word about why, and how far along you are"
      footer={
        <>
          {editing && <button className="btn-ghost text-rose-600 mr-auto" onClick={onRemove}><Trash2 size={13} /> Delete</button>}
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => form.title.trim() && onSave({ ...form, title: form.title.trim(), image: form.image || undefined, targetDate: form.targetDate || undefined, startDate: form.startDate || undefined })}>
            {editing ? 'Save' : 'Add plan'}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Plan" className="sm:col-span-2">
          <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Open new branch" autoFocus />
        </Field>
        <Field label="Category">
          <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as PlanCategory })}>
            {PLAN_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.key}</option>)}
          </select>
        </Field>
        <Field label="Start date">
          <input className="input" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
        </Field>
        <Field label="Where it stands (shown as the conclusion)" className="sm:col-span-2">
          <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="e.g. Construction under way, finishing setup" />
        </Field>
        <Field label="Emoji (used when there is no photo)">
          <input className="input" value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} maxLength={4} />
        </Field>
        <Field label="End date">
          <input className="input" type="date" value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} />
        </Field>
        <Field label={`Progress — ${form.progress}%`} className="sm:col-span-2">
          <input type="range" min={0} max={100} value={form.progress} onChange={(e) => setForm({ ...form, progress: Number(e.target.value) })} className="w-full accent-brand-600 cursor-pointer" />
        </Field>
        <Field label="Colour" className="sm:col-span-2">
          <ColorChoice value={form.color} onChange={(color) => setForm({ ...form, color })} swatches={PALETTE} />
        </Field>
        <Field label="Photo (optional)" className="sm:col-span-2">
          <div className="flex items-center gap-3">
            <div className="h-16 w-24 shrink-0 rounded-xl overflow-hidden grid place-items-center text-[22px]" style={{ background: `${form.color}1f` }}>
              {form.image ? <img src={form.image} alt="" className="h-full w-full object-cover" /> : form.emoji}
            </div>
            <label className="btn-ghost cursor-pointer">
              <ImageIcon size={14} /> Choose
              <input type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(e.target.files?.[0])} />
            </label>
            {form.image && <button className="btn-ghost" onClick={() => { setForm({ ...form, image: '' }); setImageNote(null) }}>Remove</button>}
          </div>
          <div className="mt-2 rounded-xl bg-slate-50 border border-[#eef2f8] px-3 py-2 text-[11.5px] text-slate-500 leading-relaxed">
            <p><b className="text-slate-700">Best size:</b> landscape, 1280 × 960 px (4:3) or larger.</p>
            <p><b className="text-slate-700">Accepted:</b> JPG, PNG, WebP or iPhone/iPad photos, up to {MAX_PHOTO_MB} MB.</p>
            <p>It is scaled to {SAVED_EDGE} px on its longest side before saving, so it stays small on every device.</p>
          </div>
          {imageNote && !imageError && <p className="text-[11.5px] text-emerald-700 mt-1.5">{imageNote}</p>}
          {imageError && <p className="text-[11.5px] text-rose-600 mt-1.5">{imageError}</p>}
        </Field>
      </div>
    </Modal>
  )
}

function WordModal({ value, onClose, onSave, onRemove }: {
  value: VisionWord | 'new' | null
  onClose: () => void
  onSave: (w: Omit<VisionWord, 'id' | 'order'>) => void
  onRemove: () => void
}) {
  const editing = value && value !== 'new' ? value : null
  const [form, setForm] = useState({ word: '', note: '', emoji: '✨', color: PALETTE[2] })
  const [seeded, setSeeded] = useState<string | null>(null)
  const key = editing?.id ?? 'new'
  if (value && seeded !== key) {
    setSeeded(key)
    setForm({ word: editing?.word ?? '', note: editing?.note ?? '', emoji: editing?.emoji ?? '✨', color: editing?.color ?? PALETTE[2] })
  }
  if (!value) return null

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? 'Edit word' : 'Add a word'}
      subtitle="One word to keep in front of you"
      footer={
        <>
          {editing && <button className="btn-ghost text-rose-600 mr-auto" onClick={onRemove}><Trash2 size={13} /> Delete</button>}
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => form.word.trim() && onSave({ ...form, word: form.word.trim() })}>{editing ? 'Save' : 'Add'}</button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Word"><input className="input" value={form.word} onChange={(e) => setForm({ ...form, word: e.target.value })} placeholder="e.g. Discipline" autoFocus /></Field>
        <Field label="Emoji"><input className="input" value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} maxLength={4} /></Field>
        <Field label="A line about it" className="sm:col-span-2"><input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="e.g. Do it every day" /></Field>
        <Field label="Colour" className="sm:col-span-2">
          <ColorChoice value={form.color} onChange={(color) => setForm({ ...form, color })} swatches={PALETTE} />
        </Field>
      </div>
    </Modal>
  )
}

function BlockModal({ value, onClose, onSave, onRemove }: {
  value: ScheduleBlock | 'new' | null
  onClose: () => void
  onSave: (b: Omit<ScheduleBlock, 'id' | 'order'>) => void
  onRemove: () => void
}) {
  const editing = value && value !== 'new' ? value : null
  const [form, setForm] = useState<{ label: string; kind: ActivityKind; start: string; end: string }>({ label: '', kind: 'work', start: '09:00', end: '10:00' })
  const [seeded, setSeeded] = useState<string | null>(null)
  const key = editing?.id ?? 'new'
  if (value && seeded !== key) {
    setSeeded(key)
    setForm({ label: editing?.label ?? '', kind: editing?.kind ?? 'work', start: editing?.start ?? '09:00', end: editing?.end ?? '10:00' })
  }
  if (!value) return null

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? 'Edit block' : 'Add a block'}
      subtitle="A recurring part of your day. An end before the start runs past midnight."
      footer={
        <>
          {editing && <button className="btn-ghost text-rose-600 mr-auto" onClick={onRemove}><Trash2 size={13} /> Delete</button>}
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => form.label.trim() && onSave({ ...form, label: form.label.trim() })}>{editing ? 'Save' : 'Add'}</button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="What it is" className="sm:col-span-2"><input className="input" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. Work / Business" autoFocus /></Field>
        <Field label="Counts as">
          <select className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as ActivityKind })}>
            {ACTIVITY_KINDS.map((k) => <option key={k} value={k}>{ACTIVITY[k].emoji} {ACTIVITY[k].label}</option>)}
          </select>
        </Field>
        <Field label={`Length — ${duration(blockMinutes(form))}`}>
          <div className="flex gap-2">
            <input className="input" type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
            <input className="input" type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
          </div>
        </Field>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Plans view
// ---------------------------------------------------------------------------

const PLAN_CATEGORIES: { key: PlanCategory; icon: typeof User; color: string }[] = [
  { key: 'Personal', icon: User, color: '#2563eb' },
  { key: 'Family', icon: Heart, color: '#ef4444' },
  { key: 'Business', icon: Briefcase, color: '#b45309' },
  { key: 'Education', icon: GraduationCap, color: '#7c3aed' },
  { key: 'Health', icon: Dumbbell, color: '#f97316' },
  { key: 'Travel', icon: Plane, color: '#0ea5e9' },
  { key: 'Finance', icon: Coins, color: '#eab308' },
  { key: 'Home', icon: House, color: '#0891b2' },
]
const categoryColor = (c?: PlanCategory) => PLAN_CATEGORIES.find((x) => x.key === c)?.color ?? '#64748b'

const STATUS_ICON = {
  Completed: CheckCircle2,
  'On Track': CheckCircle2,
  'In Progress': Clock,
  'Needs Attention': AlertCircle,
  Planned: MoreHorizontal,
} as const

/** The plan's picture, or its emoji on its colour when there is none. */
function PlanImage({ d, className }: { d: Dream; className: string }) {
  return (
    <div className={`relative overflow-hidden grid place-items-center ${className}`} style={{ background: `${d.color}1f` }}>
      {d.image ? <img src={d.image} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" /> : <span className="text-[30px]">{d.emoji}</span>}
    </div>
  )
}

function PlansView({ dreams, query, onEdit, onAdd }: {
  dreams: Dream[]
  query: string
  onEdit: (d: Dream) => void
  onAdd: () => void
}) {
  const [category, setCategory] = useState<'All' | PlanCategory>('All')

  const shown = dreams.filter(
    (d) =>
      (category === 'All' || d.category === category) &&
      (!query.trim() || `${d.title} ${d.note} ${d.category ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())),
  )

  // Grouped by the year each plan lands in, soonest first.
  const years = [...new Set(shown.map(planYear))].sort()
  const byYear = (y: string) =>
    shown
      .filter((d) => planYear(d) === y)
      .sort((a, b) => (a.targetDate ?? '9999').localeCompare(b.targetDate ?? '9999') || a.order - b.order)

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setCategory('All')}
          className={`h-10 px-5 rounded-xl text-[13px] font-semibold cursor-pointer transition ${category === 'All' ? 'bg-brand-600 text-white' : 'bg-white border border-[#e8edf5] text-slate-600 hover:bg-slate-50'}`}
        >
          All
        </button>
        {PLAN_CATEGORIES.map(({ key, icon: Icon, color }) => (
          <button
            key={key}
            onClick={() => setCategory(key)}
            className={`h-10 px-3.5 rounded-xl text-[13px] font-semibold inline-flex items-center gap-2 cursor-pointer transition ${category === key ? 'bg-brand-600 text-white' : 'bg-white border border-[#e8edf5] text-slate-600 hover:bg-slate-50'}`}
          >
            <Icon size={16} style={{ color: category === key ? '#fff' : color }} /> {key}
          </button>
        ))}
      </div>

      <div>
        {/* ---- the plans, year by year ---- */}
        <Card>
          {shown.length === 0 ? (
            <div className="py-10">
              <Empty text={dreams.length ? 'No plans match that.' : 'No plans yet — add the first thing you are working towards.'} />
              {!dreams.length && <div className="text-center"><button className="btn-primary" onClick={onAdd}><Plus size={14} /> Add Plan</button></div>}
            </div>
          ) : (
            <div className="p-3 sm:p-4 space-y-1">
              {years.map((y) => (
                <div key={y} className="relative pl-14 sm:pl-16">
                  {/* the year rail */}
                  <span className="absolute left-[22px] sm:left-[26px] top-3 bottom-0 w-0.5 bg-brand-200" />
                  <span className="absolute left-0 top-3 h-7 px-2.5 rounded-full bg-brand-600 text-white text-[12px] font-bold grid place-items-center">{y}</span>

                  <div className="space-y-2.5 py-2">
                    {byYear(y).map((d) => {
                      const t = planTiming(d, TODAY)
                      const tone = STATUS_TONE[t.status]
                      const Icon = STATUS_ICON[t.status]
                      return (
                        <div key={d.id} className="relative">
                          <span className="absolute -left-[37px] sm:-left-[41px] top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-brand-500 ring-4 ring-white" />
                          <div className="grid gap-3 grid-cols-[84px_minmax(0,1fr)] md:grid-cols-[96px_minmax(0,1.3fr)_auto_minmax(0,1fr)] items-center rounded-2xl border border-[#eef2f8] bg-white p-2.5">
                            <PlanImage d={d} className="h-20 md:h-[84px] rounded-xl" />

                            <div className="min-w-0">
                              <p className="text-[13.5px] font-bold text-slate-800 truncate">{d.title}</p>
                              {d.category && (
                                <span className="chip mt-1" style={{ background: `${categoryColor(d.category)}1a`, color: categoryColor(d.category) }}>{d.category}</span>
                              )}
                              <p className="text-[11px] text-slate-500 mt-1.5 inline-flex items-center gap-1 flex-wrap">
                                <CalendarDays size={11} />
                                {d.startDate ? fmtDate(d.startDate) : 'No start'} → {d.targetDate ? fmtDate(d.targetDate) : 'No end'}
                              </p>
                              <div className="mt-1.5"><Progress value={t.progress} max={100} color="#10b981" height={5} /></div>
                              {t.total > 0 && <p className="text-[10.5px] text-slate-400 mt-1">{t.done} of {t.total} days completed</p>}
                            </div>

                            {/* Progress made beside time remaining: the two figures the status compares. */}
                            <div className="hidden md:flex items-start gap-2">
                              <Ring value={t.progress} color="#10b981" caption="Done" />
                              {t.timeLeftPct === null ? (
                                <div className="w-[70px] h-16 grid place-items-center text-center text-[10px] font-semibold text-slate-400 leading-tight">
                                  {t.left === null ? 'No end date' : `${t.left} days left`}
                                </div>
                              ) : (
                                <Ring
                                  value={t.timeLeftPct}
                                  color={timeColor(t.timeLeftPct)}
                                  caption={t.left === 0 ? 'Time up' : `${t.left} days left`}
                                />
                              )}
                            </div>

                            <button
                              onClick={() => onEdit(d)}
                              className="col-span-2 md:col-span-1 text-left rounded-xl px-3 py-2.5 flex items-start gap-2.5 cursor-pointer transition hover:brightness-95"
                              style={{ background: tone.bg }}
                              title="Edit this plan"
                            >
                              <Icon size={18} style={{ color: tone.color }} className="shrink-0 mt-0.5" />
                              <span className="min-w-0">
                                <span className="block text-[12.5px] font-bold" style={{ color: tone.color }}>
                                  {t.status}
                                  <span className="md:hidden font-semibold text-slate-500"> · {t.progress}% done{t.timeLeftPct !== null ? ` · ${t.timeLeftPct}% of time left` : t.left !== null ? ` · ${t.left} days left` : ''}</span>
                                </span>
                                <span className="block text-[11px] text-slate-600 leading-snug mt-0.5">{d.note || t.explain}</span>
                              </span>
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

      </div>
    </div>
  )
}
