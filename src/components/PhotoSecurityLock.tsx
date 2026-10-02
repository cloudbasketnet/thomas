import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  Check, ImagePlus, Info, Loader2, Lock, ScanFace, Shuffle, Trash2, X,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Card, CardHead, Switch } from '@/components/ui/Primitives'
import { resizeImage } from '@/lib/image'
import { clampBox, cropFace, detectFaces, faceDetectionSupported, loadImage, toFaces, type Box } from '@/lib/faces'
import { askableFaces, sceneUsable } from '@/lib/security'
import { uid } from '@/lib/format'
import type { SceneFace, SecurityScene } from '@/types'

/** A new marker drawn by tapping rather than dragging, as a share of the photo's width. */
const DEFAULT_MARK = 0.09

const blankScene = (photo: string): SecurityScene => ({
  photo,
  faces: [],
  randomQuestion: true,
  avoidRepeatLast: true,
})

/**
 * Settings → Verification → Photo Security Lock.
 *
 * One scene photo of your own, the people marked on it, and a personal memory
 * question per person. At login one of those questions is asked and the person
 * signing in taps the right face. See src/lib/security.ts for how it is checked
 * and what it does and does not protect against.
 */
export function PhotoSecurityLock() {
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const membership = useStore((s) => s.membership)
  const schemaV2 = useStore((s) => s.schemaV2)

  const saved = settings.extra?.security?.scene
  const [draft, setDraft] = useState<SecurityScene | null>(saved ?? null)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [previewPick, setPreviewPick] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const faces = draft?.faces ?? []
  const ready = askableFaces(draft ?? undefined)
  const live = sceneUsable(saved)

  const patch = (next: Partial<SecurityScene>) => {
    setDraft((d) => (d ? { ...d, ...next } : d))
    setDirty(true)
  }
  const patchFace = (id: string, next: Partial<SceneFace>) => {
    setDraft((d) => (d ? { ...d, faces: d.faces.map((f) => (f.id === id ? { ...f, ...next } : f)) } : d))
    setDirty(true)
  }

  // ---- photo ---------------------------------------------------------------
  const pickPhoto = async (file: File) => {
    setNote(null)
    setBusy('Reading the photo…')
    try {
      const raw = await readFile(file)
      // Keep the settings row small: a full-resolution phone photo would be
      // several megabytes of base64 syncing on every settings write.
      const photo = await resizeImage(raw, 1280)
      const img = await loadImage(photo)

      setBusy(faceDetectionSupported() ? 'Looking for faces…' : null)
      const boxes = await detectFaces(img)
      const detected = toFaces(img, boxes)
      setDraft({ ...blankScene(photo), faces: detected, randomQuestion: draft?.randomQuestion ?? true, avoidRepeatLast: draft?.avoidRepeatLast ?? true })
      setDirty(true)
      setPreviewId(null)
      setPreviewPick(null)
      setNote(
        detected.length
          ? `${detected.length} ${detected.length === 1 ? 'person' : 'people'} found automatically. Drag on the photo to add anyone who was missed.`
          : faceDetectionSupported()
            ? 'No faces were recognised in this photo. Drag a box around each person to mark them.'
            : 'This browser cannot find faces on its own. Drag a box around each person to mark them.',
      )
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  const redetect = async () => {
    if (!draft) return
    setBusy('Looking for faces…')
    setNote(null)
    try {
      const img = await loadImage(draft.photo)
      const boxes = await detectFaces(img)
      if (!boxes.length) {
        setNote('Nothing new was recognised. Drag a box around each person instead.')
        return
      }
      // Keep the questions already written: only add people who are not marked yet.
      const fresh = toFaces(img, boxes).filter((n) => !draft.faces.some((f) => overlaps(f, n)))
      if (!fresh.length) {
        setNote('Everyone the browser can recognise is already marked.')
        return
      }
      patch({ faces: [...draft.faces, ...fresh].sort((a, b) => a.x - b.x) })
      setNote(`Added ${fresh.length} more ${fresh.length === 1 ? 'person' : 'people'}.`)
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  const addBox = async (box: Box) => {
    if (!draft) return
    const b = clampBox(box)
    let thumb: string | undefined
    try {
      thumb = cropFace(await loadImage(draft.photo), b)
    } catch {
      /* the box still works without a thumbnail */
    }
    patch({ faces: [...draft.faces, { id: uid('face'), ...b, thumb, question: '', enabled: true }] })
  }

  const removeFace = (id: string) => {
    if (!draft) return
    patch({ faces: draft.faces.filter((f) => f.id !== id) })
    if (previewId === id) setPreviewId(null)
  }

  // ---- saving --------------------------------------------------------------
  const save = () => {
    const security = { ...(settings.extra?.security ?? { enabled: true }), scene: draft ?? undefined }
    updateSettings({ extra: { ...settings.extra, security } })
    setDirty(false)
    setNote(
      draft && sceneUsable(draft)
        ? 'Saved. The next sign-in on any device will ask one of these questions.'
        : 'Saved. Add at least one question and two people before the lock can be used.',
    )
  }

  const removeScene = () => {
    if (!window.confirm('Remove the scene photo and every question on it? The lock will stop asking at login.')) return
    setDraft(null)
    const security = { ...(settings.extra?.security ?? { enabled: true }), scene: undefined }
    updateSettings({ extra: { ...settings.extra, security } })
    setDirty(false)
    setNote('Photo Security Lock removed.')
  }

  // ---- preview -------------------------------------------------------------
  const previewFace = useMemo(
    () => ready.find((f) => f.id === previewId) ?? ready[0],
    [ready, previewId],
  )
  const rollPreview = () => {
    if (ready.length < 2) return
    const others = ready.filter((f) => f.id !== previewFace?.id)
    setPreviewId(others[Math.floor(Math.random() * others.length)].id)
    setPreviewPick(null)
  }

  // Only the household owner may write settings (row level security enforces
  // it), so a family member gets the explanation rather than an editor that
  // would fail on save.
  if (membership) {
    return (
      <Card>
        <CardHead title="Photo Security Lock" sub="Set up by the account owner" />
        <div className="px-5 pb-5 text-[12.5px] text-slate-600">
          {sceneUsable(saved)
            ? 'The owner has set up a photo lock, so you are asked to tap the right person in their photo when you sign in.'
            : 'No photo lock is set up. Only the account owner can add one.'}
        </div>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 grid-cols-1 xl:grid-cols-2 items-start">
      {/* ================= 1. set up ================= */}
      <Card>
        <CardHead
          title="Set a Question for Each Person"
          sub="Each person you mark gets their own personal memory question."
          right={<Step n={1} />}
        />
        <div className="px-5 pb-5 space-y-4">
          {!schemaV2 && (
            <div className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-[12px] font-medium text-amber-900">
              Run <b>supabase/migrations/0015_cloudbasket360_v2.sql</b> first. Until then the scene is saved on this
              device only and will not follow you to another browser.
            </div>
          )}
          {draft ? (
            <SceneEditor scene={draft} onAdd={addBox} onRemove={removeFace} onSelect={setPreviewId} selectedId={previewFace?.id ?? null} />
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-[#dbe4f3] bg-slate-50/60 py-12 text-center">
              <ScanFace size={30} className="mx-auto text-slate-300" />
              <p className="mt-3 text-[13px] font-semibold text-slate-600">No scene photo yet</p>
              <p className="mx-auto mt-1 max-w-sm text-[11.5px] leading-relaxed text-slate-400">
                Use a photo of a crowd you can recognise — a wedding, a trip, a team. Only you know which face answers
                which question.
              </p>
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void pickPhoto(f)
              e.target.value = ''
            }}
          />
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost flex-1 min-w-[180px]" onClick={() => fileRef.current?.click()} disabled={!!busy}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={15} />}
              {busy ?? (draft ? 'Replace Scene Photo' : 'Upload Scene Photo')}
            </button>
            {draft && faceDetectionSupported() && (
              <button className="btn-ghost" onClick={redetect} disabled={!!busy} title="Look for faces again">
                <ScanFace size={15} /> Detect faces
              </button>
            )}
            {draft && (
              <button className="btn-ghost text-rose-600" onClick={removeScene} disabled={!!busy} title="Remove the scene">
                <Trash2 size={15} />
              </button>
            )}
          </div>

          {draft && (
            <p className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-slate-500">
              <Info size={13} className="mt-0.5 shrink-0 text-slate-400" />
              Drag a box around a person to mark them, or tap once to drop a marker. Tap a marker's ✕ to remove it.
            </p>
          )}

          {note && (
            <div className="rounded-xl bg-brand-50 px-3.5 py-2.5 text-[12px] font-medium text-brand-900">{note}</div>
          )}

          {/* ---- the people, and their questions ---- */}
          {faces.length > 0 && (
            <>
              <div className="max-h-[360px] space-y-2 overflow-y-auto scroll-thin pr-1">
                {faces.map((f, i) => (
                  <div
                    key={f.id}
                    onFocus={() => setPreviewId(f.id)}
                    className={`flex items-center gap-2.5 rounded-xl border p-2 transition ${
                      previewFace?.id === f.id ? 'border-brand-200 bg-brand-50/50' : 'border-[#eef2f8]'
                    }`}
                  >
                    {f.thumb ? (
                      <img src={f.thumb} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-200 text-[11px] font-bold text-slate-500">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                    )}
                    <span className="hidden w-[68px] shrink-0 text-[11.5px] font-bold text-slate-600 sm:block">
                      Person {String(i + 1).padStart(2, '0')}
                    </span>
                    <input
                      className="input h-9 flex-1 text-[12.5px]"
                      placeholder="Who taught me to ride a bicycle?"
                      value={f.question ?? ''}
                      onChange={(e) => patchFace(f.id, { question: e.target.value })}
                    />
                    <span className="hidden text-[10.5px] font-semibold text-slate-400 sm:block">
                      {f.enabled ? 'Enabled' : 'Off'}
                    </span>
                    <Switch checked={f.enabled} onChange={(v) => patchFace(f.id, { enabled: v })} />
                    <button
                      onClick={() => removeFace(f.id)}
                      title="Remove this person"
                      className="h-7 w-7 shrink-0 grid place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Info size={13} className="text-slate-400" /> Each question's answer is the person beside it.
                </span>
                <span className="font-semibold">
                  {ready.length} of {faces.length} questions configured
                </span>
              </div>

              <div className="space-y-3 rounded-xl bg-slate-50 p-3.5">
                <p className="flex items-center gap-1.5 text-[11.5px] font-bold text-slate-600">
                  <Shuffle size={13} /> Question settings
                </p>
                <SettingRow
                  title="Random question at every login"
                  sub="A different saved question is chosen each time you verify."
                >
                  <Switch checked={draft?.randomQuestion !== false} onChange={(v) => patch({ randomQuestion: v })} />
                </SettingRow>
                <SettingRow
                  title="Avoid repeating the last question"
                  sub="Tries not to show the same question as the previous login on this device."
                >
                  <Switch checked={draft?.avoidRepeatLast !== false} onChange={(v) => patch({ avoidRepeatLast: v })} />
                </SettingRow>
              </div>

              <button className="btn-primary h-11 w-full" onClick={save} disabled={!dirty}>
                <Lock size={15} /> {dirty ? 'Save All Questions' : 'Saved'}
              </button>
            </>
          )}
        </div>
      </Card>

      {/* ================= 2. preview ================= */}
      <Card>
        <CardHead
          title="Random Verification Preview"
          sub="This is how one of your saved questions will appear at login."
          right={
            <span
              className={`chip ${live ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'} inline-flex items-center gap-1`}
            >
              <Lock size={12} /> {live ? 'Lock is on' : 'Not active yet'}
            </span>
          }
        />
        <div className="px-5 pb-5 space-y-4">
          {!draft || ready.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-[#dbe4f3] bg-slate-50/60 py-16 text-center text-[12.5px] text-slate-400">
              Mark at least one person and write their question to see the preview.
            </div>
          ) : (
            <>
              <div className="relative overflow-hidden rounded-2xl bg-slate-100">
                <img src={draft.photo} alt="" className="block w-full select-none" draggable={false} />
                <div className="absolute inset-0">
                  {draft.faces.map((f, i) => {
                    const picked = previewPick === f.id
                    return (
                      <button
                        key={f.id}
                        onClick={() => setPreviewPick(f.id)}
                        className={`absolute rounded-lg transition cursor-pointer ${
                          picked ? 'ring-[3px] ring-brand-500 bg-brand-500/20' : 'ring-2 ring-white/70 hover:ring-brand-400'
                        }`}
                        style={{ left: `${f.x * 100}%`, top: `${f.y * 100}%`, width: `${f.w * 100}%`, height: `${f.h * 100}%` }}
                      >
                        <span
                          className={`absolute -top-2 -left-1 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-bold shadow ${
                            picked ? 'bg-brand-600 text-white' : 'bg-white text-slate-700'
                          }`}
                        >
                          {String(i + 1).padStart(2, '0')}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <button className="btn-ghost mx-auto" onClick={rollPreview} disabled={ready.length < 2}>
                <Shuffle size={14} /> Random Question
              </button>

              <div className="rounded-2xl bg-slate-50 px-4 py-5 text-center">
                <p className="text-[17px] font-extrabold tracking-tight text-slate-900">{previewFace?.question}</p>
                <p className="mt-1 text-[12.5px] text-slate-500">Tap the correct person in the photo above.</p>
              </div>

              {previewPick && previewFace && (
                <div
                  className={`flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[12.5px] font-semibold ${
                    previewPick === previewFace.id ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700'
                  }`}
                >
                  {previewPick === previewFace.id ? <Check size={14} /> : <X size={14} />}
                  {previewPick === previewFace.id
                    ? 'Correct — this is the answer to that question.'
                    : 'Not the person this question points at.'}
                </div>
              )}

              <p className="text-[11px] leading-relaxed text-slate-400">
                The photo lock is checked on the device. It stops someone who picks up your signed-in phone or laptop —
                it is not a second password. For an answer the browser never sees, deploy the{' '}
                <b>security-verify</b> edge function and use Active questions below instead.
              </p>
            </>
          )}
        </div>
      </Card>
    </div>
  )
}

/** The photo with its markers, where new people are drawn. */
function SceneEditor({
  scene,
  onAdd,
  onRemove,
  onSelect,
  selectedId,
}: {
  scene: SecurityScene
  onAdd: (b: Box) => void
  onRemove: (id: string) => void
  onSelect: (id: string) => void
  selectedId: string | null
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null)

  const at = (e: ReactPointerEvent) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r || !r.width || !r.height) return { x: 0, y: 0 }
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    }
  }

  const down = (e: ReactPointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    const p = at(e)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y })
  }
  const move = (e: ReactPointerEvent) => {
    if (!drag) return
    const p = at(e)
    setDrag({ ...drag, x1: p.x, y1: p.y })
  }
  const up = () => {
    if (!drag) return
    const w = Math.abs(drag.x1 - drag.x0)
    const h = Math.abs(drag.y1 - drag.y0)
    // A tap rather than a drag: drop a default-sized marker on that spot.
    if (w < 0.02 || h < 0.02) {
      onAdd({ x: drag.x0 - DEFAULT_MARK / 2, y: drag.y0 - DEFAULT_MARK / 2, w: DEFAULT_MARK, h: DEFAULT_MARK * 1.25 })
    } else {
      onAdd({ x: Math.min(drag.x0, drag.x1), y: Math.min(drag.y0, drag.y1), w, h })
    }
    setDrag(null)
  }

  const box = drag && {
    left: `${Math.min(drag.x0, drag.x1) * 100}%`,
    top: `${Math.min(drag.y0, drag.y1) * 100}%`,
    width: `${Math.abs(drag.x1 - drag.x0) * 100}%`,
    height: `${Math.abs(drag.y1 - drag.y0) * 100}%`,
  }

  return (
    <div
      ref={ref}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => setDrag(null)}
      className="relative touch-none select-none overflow-hidden rounded-2xl bg-slate-100 cursor-crosshair"
    >
      <img src={scene.photo} alt="Scene" className="block w-full" draggable={false} />
      {scene.faces.map((f, i) => (
        <span
          key={f.id}
          onPointerDown={(e) => {
            e.stopPropagation()
            onSelect(f.id)
          }}
          className={`absolute rounded-lg ring-2 transition ${
            selectedId === f.id ? 'ring-brand-500 bg-brand-500/15' : 'ring-white/80'
          }`}
          style={{ left: `${f.x * 100}%`, top: `${f.y * 100}%`, width: `${f.w * 100}%`, height: `${f.h * 100}%` }}
        >
          <span
            className={`absolute -top-2 -left-1 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-bold shadow ${
              f.enabled && (f.question ?? '').trim() ? 'bg-brand-600 text-white' : 'bg-white text-slate-500'
            }`}
          >
            {String(i + 1).padStart(2, '0')}
          </span>
          <button
            onPointerDown={(e) => {
              e.stopPropagation()
              e.preventDefault()
              onRemove(f.id)
            }}
            title="Remove this person"
            className="absolute -top-2 -right-2 grid h-5 w-5 place-items-center rounded-full bg-white text-slate-500 shadow hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
          >
            <X size={11} strokeWidth={3} />
          </button>
        </span>
      ))}
      {box && <span className="absolute rounded-lg border-2 border-dashed border-brand-500 bg-brand-500/15" style={box} />}
    </div>
  )
}

function Step({ n }: { n: number }) {
  return (
    <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-600 text-[12px] font-bold text-white">{n}</span>
  )
}

function SettingRow({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[12px] font-semibold text-slate-700">{title}</p>
        <p className="text-[10.5px] text-slate-400">{sub}</p>
      </div>
      {children}
    </div>
  )
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('Could not read that file.'))
    r.readAsDataURL(file)
  })
}

/** Two boxes describe the same person when their centres sit inside one another. */
function overlaps(a: Box, b: Box) {
  const cx = b.x + b.w / 2
  const cy = b.y + b.h / 2
  return cx > a.x && cx < a.x + a.w && cy > a.y && cy < a.y + a.h
}
