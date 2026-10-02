// Client side of the step-2 login lock.
//
// There are two lock models, and this file decides which one is actually
// usable on this installation, rather than assuming one and failing silently:
//
//  1. PHOTO LOCK ("Photo Security Lock", Settings → Verification). One scene
//     photo, the people marked on it, and a personal question per person. It
//     lives in `settings.extra.security.scene`, which every signed-in member of
//     the household may already read, so the answer IS checked on the device.
//     That makes it a presence lock — it stops someone who picks up a signed-in
//     device — not a second password. It needs nothing deployed, so it works
//     even on a database where the edge function was never set up.
//
//  2. SERVER-CHECKED QUESTIONS (verification_questions + the `security-verify`
//     edge function). The correct answer never reaches the browser before it
//     answers, so this is the stronger one — but it only works once migration
//     0016 has been run AND the edge function has been deployed.
//
// Before this, the client called the edge function and, if anything at all went
// wrong, quietly let the login through with no lock and no message anywhere —
// which is why a configured lock could appear to do nothing. Now every failure
// is carried in `reason` and reported in Settings → Verification → Lock status.
import { db, hasSupabase } from '@/lib/supabase'
import { invokeFunction } from '@/lib/sync'
import { askableFaces, pickFace, sceneUsable } from '@/lib/sceneLock'
import type { SceneFace, SecurityScene } from '@/types'

export { askableFaces, sceneUsable } from '@/lib/sceneLock'

export type LockMode = 'off' | 'scene' | 'server' | 'local-questions'

export interface LockState {
  required: boolean
  mode: LockMode
  ownerId: string | null
  /** Plain-language explanation of the mode — shown in Settings, never at login. */
  reason: string
  /** Set when the edge function could not be reached, whichever mode ends up being used. */
  edgeError?: string
  scene?: SecurityScene
}

export const LOCK_OFF: LockState = {
  required: false,
  mode: 'off',
  ownerId: null,
  reason: 'Supabase is not configured — the app is in local-only mode.',
}

export interface PeopleChallenge {
  kind: 'people'
  questionId: string
  text: string
  scene: string
  people: { id: string; name: string; photo: string | null }[]
  /** True when the answer is compared in the browser rather than on the server. */
  localCheck: boolean
  correctId?: string
}

export interface SceneChallenge {
  kind: 'scene'
  questionId: string
  text: string
  photo: string
  faces: SceneFace[]
}

export type Challenge = PeopleChallenge | SceneChallenge

// ---------------------------------------------------------------------------
// Which lock applies
// ---------------------------------------------------------------------------

async function readSecuritySettings(ownerId: string) {
  // Read straight from the database: at login the store has not been hydrated
  // yet, and a household member may be signing in against the owner's row.
  const { data, error } = await db().from('settings').select('extra').eq('user_id', ownerId).maybeSingle()
  if (error) throw error
  const security = (data?.extra as Record<string, any> | undefined)?.security as
    | { enabled?: boolean; scene?: SecurityScene }
    | undefined
  return { enabled: security?.enabled !== false, scene: security?.scene }
}

/**
 * Work out whether this login needs a question, and which model will answer it.
 * Never throws — a lock that cannot be evaluated must not brick sign-in — but it
 * always says why, so the owner can see the reason in Settings.
 */
export async function resolveLock(ownerId: string): Promise<LockState> {
  if (!hasSupabase) return LOCK_OFF

  let enabled = true
  let scene: SecurityScene | undefined
  let settingsError: string | undefined
  try {
    const s = await readSecuritySettings(ownerId)
    enabled = s.enabled
    scene = s.scene
  } catch (e) {
    settingsError = e instanceof Error ? e.message : String(e)
  }

  if (!enabled) {
    return {
      required: false,
      mode: 'off',
      ownerId,
      reason: 'Switched off in Settings → Verification ("Require at login").',
    }
  }

  // 1. The photo lock wins when one is configured: it needs nothing deployed.
  if (sceneUsable(scene)) {
    const n = askableFaces(scene).length
    return {
      required: true,
      mode: 'scene',
      ownerId,
      scene,
      reason: `Photo Security Lock — ${n} question${n === 1 ? '' : 's'} across ${scene!.faces.length} people. Checked on this device.`,
    }
  }

  // 2. Otherwise the server-checked questions, if the edge function answers.
  let edgeError: string | undefined
  try {
    const res = await invokeFunction<{ required: boolean }>('security-verify', { action: 'status' })
    if (res.required) {
      return {
        required: true,
        mode: 'server',
        ownerId,
        reason: 'Server-checked questions — the answer is verified by the security-verify edge function.',
      }
    }
    return {
      required: false,
      mode: 'off',
      ownerId,
      reason: 'No Active questions and no Photo Security Lock configured, so nothing is asked at login.',
    }
  } catch (e) {
    edgeError = e instanceof Error ? e.message : String(e)
  }

  // 3. The edge function is missing or failing. Fall back to reading the
  //    questions directly — row level security allows that for the household
  //    OWNER only, so a family member still gets nothing and is let through.
  try {
    const { data, error } = await db().from('verification_questions').select('id').eq('status', 'Active').limit(1)
    if (error) throw error
    if ((data?.length ?? 0) > 0) {
      return {
        required: true,
        mode: 'local-questions',
        ownerId,
        edgeError,
        reason:
          'The security-verify edge function could not be reached, so questions are being checked in the browser instead. ' +
          'Deploy it (supabase functions deploy security-verify) for a server-checked answer, or set up the Photo Security Lock.',
      }
    }
  } catch {
    /* table missing (migration 0016 not run) or not readable for this user */
  }

  return {
    required: false,
    mode: 'off',
    ownerId,
    edgeError,
    reason: settingsError
      ? `Could not read your security settings: ${settingsError}`
      : 'Nothing is configured: no Photo Security Lock, and no Active question the browser could reach.',
  }
}

// ---------------------------------------------------------------------------
// Asking, and answering
// ---------------------------------------------------------------------------

const LAST_ASKED = 'cb_last_lock_question'

function readLastAsked(): string | undefined {
  try {
    return localStorage.getItem(LAST_ASKED) ?? undefined
  } catch {
    return undefined
  }
}

/** Fetch a question to show. `excludeQuestionId` backs the "Try another way" link. */
export async function requestChallenge(lock: LockState, excludeQuestionId?: string): Promise<Challenge | null> {
  if (lock.mode === 'scene' && lock.scene) {
    const askable = askableFaces(lock.scene)
    if (!askable.length) return null
    const avoid = excludeQuestionId ?? (lock.scene.avoidRepeatLast ? readLastAsked() : undefined)
    const face = pickFace(askable, lock.scene, avoid)
    if (!face) return null
    try {
      localStorage.setItem(LAST_ASKED, face.id)
    } catch {
      /* private browsing */
    }
    return {
      kind: 'scene',
      questionId: face.id,
      text: (face.question ?? '').trim(),
      photo: lock.scene.photo,
      faces: lock.scene.faces,
    }
  }

  if (lock.mode === 'server') {
    const res = await invokeFunction<Omit<PeopleChallenge, 'kind' | 'localCheck'> & { none?: true }>(
      'security-verify',
      { action: 'challenge', excludeQuestionId },
    )
    if (res.none) return null
    return { ...res, kind: 'people', localCheck: false }
  }

  if (lock.mode === 'local-questions') return localQuestionChallenge(excludeQuestionId)

  return null
}

/** The browser-side version of the server challenge, used only when the edge function is unavailable. */
async function localQuestionChallenge(excludeQuestionId?: string): Promise<Challenge | null> {
  const { data, error } = await db().from('verification_questions').select('*').eq('status', 'Active')
  if (error) throw error
  const all = data ?? []
  if (!all.length) return null
  let pool = excludeQuestionId ? all.filter((q: any) => q.id !== excludeQuestionId) : all
  if (!pool.length) pool = all
  const q: any = pool[Math.floor(Math.random() * pool.length)]

  const ids: string[] = [q.correct_person_id, ...(Array.isArray(q.other_person_ids) ? q.other_person_ids : [])]
  const want = Math.max(2, Math.min(q.number_of_choices ?? 12, ids.length))
  const limited = ids.slice(0, want)
  const peopleRes = await db().from('people').select('id, name, photo').in('id', limited)
  if (peopleRes.error) throw peopleRes.error
  const byId = new Map((peopleRes.data ?? []).map((p: any) => [p.id, p]))
  let people = limited.map((id) => byId.get(id)).filter(Boolean) as { id: string; name: string; photo: string | null }[]
  if (q.shuffle_positions !== false) people = shuffle(people)

  return {
    kind: 'people',
    questionId: q.id,
    text: q.question,
    scene: q.scene ?? 'Airport',
    people: people.map((p) => ({ id: p.id, name: p.name, photo: p.photo ?? null })),
    localCheck: true,
    correctId: q.correct_person_id,
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = a[i]
    a[i] = a[j]
    a[j] = tmp
  }
  return a
}

/** Check an answer. Scene and local-question modes compare here; server mode asks the edge function. */
export async function answerChallenge(challenge: Challenge, selectedId: string): Promise<boolean> {
  if (challenge.kind === 'scene') return selectedId === challenge.questionId
  if (challenge.localCheck) return selectedId === challenge.correctId
  const res = await invokeFunction<{ correct: boolean }>('security-verify', {
    action: 'check',
    questionId: challenge.questionId,
    selectedPersonId: selectedId,
  })
  return res.correct
}

// ---------------------------------------------------------------------------
// Diagnostics — Settings → Verification → "Lock status"
// ---------------------------------------------------------------------------

export interface LockCheck {
  label: string
  ok: boolean | 'warn'
  detail: string
}

/** Run every step of the lock end to end and report exactly what is and is not working. */
export async function diagnoseLock(ownerId: string | null): Promise<{ state: LockState; checks: LockCheck[] }> {
  const checks: LockCheck[] = []

  if (!hasSupabase || !ownerId) {
    checks.push({
      label: 'Supabase',
      ok: false,
      detail: 'Not configured — the app runs on local data and never asks for a login, so there is nothing to lock.',
    })
    return { state: LOCK_OFF, checks }
  }
  checks.push({ label: 'Supabase', ok: true, detail: 'Connected.' })

  const tableRes = await db().from('verification_questions').select('id').limit(1)
  checks.push(
    tableRes.error
      ? {
          label: 'Migration 0016',
          ok: false,
          detail: `verification_questions is not readable: ${tableRes.error.message}. Run supabase/migrations/0016_security_verification.sql in the Supabase SQL editor.`,
        }
      : { label: 'Migration 0016', ok: true, detail: 'verification_questions exists and is readable.' },
  )

  let edgeOk = false
  let edgeDetail = ''
  try {
    const res = await invokeFunction<{ required: boolean }>('security-verify', { action: 'status' })
    edgeOk = true
    edgeDetail = `Deployed and answering. It reports a server-checked question as ${res.required ? 'required' : 'not required'}.`
  } catch (e) {
    edgeDetail = `${e instanceof Error ? e.message : String(e)} — deploy it with: supabase functions deploy security-verify`
  }
  checks.push({ label: 'security-verify function', ok: edgeOk ? true : 'warn', detail: edgeDetail })

  const state = await resolveLock(ownerId)

  checks.push(
    state.required
      ? { label: 'Lock at login', ok: true, detail: state.reason }
      : { label: 'Lock at login', ok: false, detail: `Nobody is asked anything at sign-in. ${state.reason}` },
  )

  if (state.mode === 'scene' || state.mode === 'local-questions') {
    checks.push({
      label: 'Where the answer is checked',
      ok: 'warn',
      detail:
        'In the browser. This stops someone who picks up an already signed-in device; it is not a second password. ' +
        'Deploy security-verify and use Active questions for an answer the browser never sees.',
    })
  }

  return { state, checks }
}
