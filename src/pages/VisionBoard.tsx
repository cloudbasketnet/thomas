import { useMemo, useState } from 'react'
import {
  BarChart3, Bot, CalendarDays, ChevronLeft, ChevronRight, FileText, Image as ImageIcon, Pencil, Plus, Settings as SettingsIcon,
  Sparkles, StickyNote, Target, Trash2,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useStore } from '@/store/useStore'
import { Card, CardHead, Empty, PageHeader, Progress, StatCard, cx } from '@/components/ui/Primitives'
import { Modal, Field } from '@/components/ui/Modal'
import {
  ACTIVITY, ACTIVITY_KINDS, blockMinutes, dayAnalysis, dreamProgress, duration, monthAnalysis, sortedDreams, sortedSchedule,
} from '@/lib/vision'
import { TODAY, fmtDate } from '@/lib/format'
import type { ActivityKind, Dream, ScheduleBlock, VisionWord } from '@/types'

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
        subtitle="A better me, a brighter tomorrow — what you are working towards, and where the hours go."
        actions={
          <button className="btn-primary" onClick={() => setDreamModal('new')}>
            <Plus size={15} /> Add Dream
          </button>
        }
      />

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

      {/* ---- dreams + words ---- */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <CardHead title="🎯 My Dreams" sub="Tap a card to edit it" right={<button className="btn-soft" onClick={() => setDreamModal('new')}><Plus size={13} /> Add Dream</button>} />
          <div className="px-5 pb-5">
            {board.length === 0 ? (
              <Empty text="No dreams yet — add the first thing you are working towards." />
            ) : (
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-4">
                {board.map((d) => (
                  <button key={d.id} onClick={() => setDreamModal(d)} className="group text-left rounded-2xl overflow-hidden border border-[#eef2f8] hover:border-brand-200 transition cursor-pointer">
                    <div className="h-24 grid place-items-center text-[34px] relative" style={{ background: `${d.color}1f` }}>
                      {d.image ? <img src={d.image} alt="" className="absolute inset-0 h-full w-full object-cover" /> : d.emoji}
                    </div>
                    <div className="p-2.5">
                      <p className="text-[12.5px] font-bold text-slate-800 truncate">{d.title}</p>
                      <p className="text-[10.5px] text-slate-400 truncate">{d.note}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <Progress value={d.progress} max={100} color={d.color} height={6} />
                        <span className="text-[10.5px] font-bold text-slate-500 w-8 text-right tabular-nums">{d.progress}%</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-4">
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

      {/* ---- progress + tools + quick add ---- */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <CardHead title="🎯 Progress Towards Dreams" sub={`${overall}% across ${dreams.length} dream${dreams.length === 1 ? '' : 's'}`} />
          <div className="px-5 pb-5 space-y-3">
            {board.length === 0 && <Empty text="Nothing to track yet." />}
            {board.map((d) => (
              <div key={d.id}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[14px]">{d.emoji}</span>
                  <span className="flex-1 text-[12.5px] font-semibold text-slate-700 truncate">{d.title}</span>
                  <span className="text-[11px] font-bold text-slate-500 tabular-nums">{d.progress}%</span>
                </div>
                <Progress value={d.progress} max={100} color={d.color} height={7} />
              </div>
            ))}
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
function Ring({ value, color }: { value: number; color: string }) {
  const r = 26
  const c = 2 * Math.PI * r
  const dash = (Math.min(100, Math.max(0, value)) / 100) * c
  return (
    <svg viewBox="0 0 64 64" className="w-full max-w-[64px] mx-auto" role="img" aria-label={`${value}%`}>
      <circle cx="32" cy="32" r={r} fill="none" stroke="#eef2f8" strokeWidth="7" />
      <circle
        cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
        strokeDasharray={`${dash} ${c - dash}`} transform="rotate(-90 32 32)"
      />
      <text x="32" y="36" textAnchor="middle" className="fill-slate-800" style={{ fontSize: 15, fontWeight: 800 }}>{value}%</text>
    </svg>
  )
}

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

const PALETTE = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#2563eb', '#64748b']

function DreamModal({ value, onClose, onSave, onRemove }: {
  value: Dream | 'new' | null
  onClose: () => void
  onSave: (d: Omit<Dream, 'id' | 'order'>) => void
  onRemove: () => void
}) {
  const editing = value && value !== 'new' ? value : null
  const [form, setForm] = useState({ title: '', note: '', emoji: '⭐', color: PALETTE[0], progress: 0, image: '', targetDate: '' })
  const [seeded, setSeeded] = useState<string | null>(null)
  const key = editing?.id ?? 'new'
  if (value && seeded !== key) {
    setSeeded(key)
    setForm({
      title: editing?.title ?? '', note: editing?.note ?? '', emoji: editing?.emoji ?? '⭐',
      color: editing?.color ?? PALETTE[0], progress: editing?.progress ?? 0,
      image: editing?.image ?? '', targetDate: editing?.targetDate ?? '',
    })
  }
  if (!value) return null

  // A photo is held as a data URL so the board works offline and needs no bucket.
  const pickImage = (file?: File) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setForm((f) => ({ ...f, image: String(reader.result) }))
    reader.readAsDataURL(file)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? 'Edit dream' : 'Add a dream'}
      subtitle="A picture, a word about why, and how far along you are"
      footer={
        <>
          {editing && <button className="btn-ghost text-rose-600 mr-auto" onClick={onRemove}><Trash2 size={13} /> Delete</button>}
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => form.title.trim() && onSave({ ...form, title: form.title.trim(), image: form.image || undefined, targetDate: form.targetDate || undefined })}>
            {editing ? 'Save' : 'Add dream'}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Dream" className="sm:col-span-2">
          <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Family Travel" autoFocus />
        </Field>
        <Field label="Why it matters" className="sm:col-span-2">
          <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="e.g. Explore the world together" />
        </Field>
        <Field label="Emoji (used when there is no photo)">
          <input className="input" value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} maxLength={4} />
        </Field>
        <Field label="Target date (optional)">
          <input className="input" type="date" value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} />
        </Field>
        <Field label={`Progress — ${form.progress}%`} className="sm:col-span-2">
          <input type="range" min={0} max={100} value={form.progress} onChange={(e) => setForm({ ...form, progress: Number(e.target.value) })} className="w-full accent-brand-600 cursor-pointer" />
        </Field>
        <Field label="Colour" className="sm:col-span-2">
          <div className="flex gap-2 flex-wrap">
            {PALETTE.map((c) => (
              <button key={c} onClick={() => setForm({ ...form, color: c })} aria-label={c}
                className={cx('h-8 w-8 rounded-full cursor-pointer transition', form.color === c ? 'ring-2 ring-offset-2 ring-slate-400' : '')}
                style={{ background: c }} />
            ))}
          </div>
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
            {form.image && <button className="btn-ghost" onClick={() => setForm({ ...form, image: '' })}>Remove</button>}
          </div>
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
          <div className="flex gap-2 flex-wrap">
            {PALETTE.map((c) => (
              <button key={c} onClick={() => setForm({ ...form, color: c })} aria-label={c}
                className={cx('h-8 w-8 rounded-full cursor-pointer transition', form.color === c ? 'ring-2 ring-offset-2 ring-slate-400' : '')}
                style={{ background: c }} />
            ))}
          </div>
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
