import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AlertCircle, ChevronUp, Loader2, X } from 'lucide-react'
import { hasSupabase, supabase } from '@/lib/supabase'
import { pullAll, resolveSession, type SessionContext } from '@/lib/sync'
import { resolveLock, type LockState } from '@/lib/security'
import { SignInScreen } from '@/components/SignInScreen'
import { SecurityVerification } from '@/components/SecurityVerification'
import { stopAnalytics } from '@/lib/analytics'
import { setRobots } from '@/lib/siteConfig'
import { useStore } from '@/store/useStore'

type Phase = 'checking' | 'signed-out' | 'verifying' | 'loading-data' | 'ready'

/** Has this browser tab already passed step 2 for this user? Cleared on sign-out / new tab. */
const verifiedKey = (userId: string) => `cb_verified_${userId}`

export function AuthGate({ children }: { children: ReactNode }) {
  const setSession = useStore((s) => s.setSession)
  const hydrate = useStore((s) => s.hydrate)
  const setContext = useStore((s) => s.setContext)
  const schemaV2 = useStore((s) => s.schemaV2)
  const schemaV3 = useStore((s) => s.schemaV3)
  const schemaV4 = useStore((s) => s.schemaV4)
  const [notice, setNotice] = useState<string | null>(null)
  const clearLocalData = useStore((s) => s.clearLocalData)
  const [phase, setPhase] = useState<Phase>(hasSupabase ? 'checking' : 'ready')
  const [error, setError] = useState<string | null>(null)
  // The user whose data is already loaded. Guards against the duplicate
  // INITIAL_SESSION callback and against TOKEN_REFRESHED re-pulling everything
  // every hour.
  const loadedFor = useRef<string | null>(null)
  // The resolved session, held while step 2 (security verification) is shown.
  const pendingSession = useRef<SessionContext | null>(null)
  // Which lock model answered for this login — see src/lib/security.ts.
  const pendingLock = useRef<LockState | null>(null)
  const finishRef = useRef<((session: SessionContext) => Promise<void>) | null>(null)

  // ---- watch the Supabase session -----------------------------------------
  useEffect(() => {
    if (!hasSupabase || !supabase) return

    let cancelled = false

    /** Pull and hydrate every table for a resolved (and, if needed, verified) session. */
    const finish = async (session: SessionContext) => {
      if (cancelled) return
      setContext(session)
      try {
        const data = await pullAll()
        if (cancelled) return
        hydrate(data)
        setError(null)
        setPhase('ready')
      } catch (e) {
        if (cancelled) return
        loadedFor.current = null
        setError(e instanceof Error ? e.message : String(e))
        setPhase('ready') // fall through to the app on cached local data
      }
    }
    finishRef.current = finish

    const apply = async (userId: string | null, email: string | null) => {
      if (cancelled) return
      setSession(userId, email)
      // Signed in: stop every marketing pixel and keep the app out of search results.
      if (userId) {
        stopAnalytics()
        setRobots(false)
      }

      if (!userId) {
        // Drop the previous account's rows so the next person to sign in on
        // this browser never sees them.
        if (loadedFor.current) clearLocalData()
        loadedFor.current = null
        setError(null)
        setPhase('signed-out')
        return
      }

      // Same user as the last load (token refresh, tab focus) — nothing to do.
      if (loadedFor.current === userId) {
        setPhase('ready')
        return
      }
      loadedFor.current = userId

      setPhase('loading-data')
      try {
        // Which schema is this database on, and whose data is this login for?
        const session = await resolveSession(userId)
        if (cancelled) return
        if (session.inactive) {
          loadedFor.current = null
          setNotice('This account has been switched off by the household owner.')
          await supabase!.auth.signOut()
          return
        }

        // Step 2: a security question, once per browser tab per sign-in.
        // resolveLock() never throws: it reports which lock applies, falling
        // back to a browser-checked one when the edge function is unavailable
        // rather than letting every login straight through in silence.
        const already = sessionStorage.getItem(verifiedKey(userId)) === '1'
        if (!already) {
          const lock = await resolveLock(session.ownerId)
          if (cancelled) return
          if (lock.required) {
            pendingSession.current = session
            pendingLock.current = lock
            setPhase('verifying')
            return
          }
        }
        await finish(session)
      } catch (e) {
        if (cancelled) return
        // Let the next event retry rather than pinning a failed load.
        loadedFor.current = null
        setError(e instanceof Error ? e.message : String(e))
        setPhase('ready') // fall through to the app on cached local data
      }
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      apply(session?.user.id ?? null, session?.user.email ?? null)
    })

    // onAuthStateChange fires INITIAL_SESSION on subscribe, but read the
    // session too in case that event is missed — apply() de-duplicates.
    supabase.auth.getSession().then(({ data }) => {
      apply(data.session?.user.id ?? null, data.session?.user.email ?? null)
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [setSession, hydrate, clearLocalData, setContext])

  if (phase === 'checking' || phase === 'loading-data') {
    return (
      <div className="h-screen grid place-items-center bg-canvas">
        <div className="text-center">
          <Loader2 size={26} className="animate-spin text-brand-600 mx-auto mb-3" />
          <p className="text-[13px] font-semibold text-slate-600">
            {phase === 'checking' ? 'Checking your session…' : 'Loading your finances…'}
          </p>
        </div>
      </div>
    )
  }

  if (phase === 'signed-out')
    return (
      <>
        <SignInScreen />
        {notice && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] card px-4 py-3 max-w-sm bg-amber-50 border-amber-200 text-[12.5px] font-semibold text-amber-900">
            {notice}
          </div>
        )}
      </>
    )

  if (phase === 'verifying')
    return (
      <SecurityVerification
        lock={pendingLock.current}
        onVerified={() => {
          const userId = useStore.getState().userId
          if (userId) sessionStorage.setItem(verifiedKey(userId), '1')
          const session = pendingSession.current
          if (!session) return
          setPhase('loading-data')
          finishRef.current?.(session)
        }}
        onSignOut={() => supabase?.auth.signOut()}
      />
    )

  return (
    <>
      {/*
       * Both notices share one bottom-right stack. They used to sit in opposite
       * corners, and the left-hand one covered the bottom third of the sidebar
       * on a docked layout — on a tablet that buried five nav items outright.
       * Phones get the full width; from sm the stack hugs the right edge.
       */}
      <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-50 flex flex-col items-stretch sm:items-end gap-2 pointer-events-none">
        <MigrationNotice supabase={hasSupabase} schemaV2={schemaV2} schemaV3={schemaV3} schemaV4={schemaV4} />
        {error && (
          <div className="pointer-events-auto card px-4 py-3 w-full sm:max-w-sm bg-amber-50 border-amber-200 flex items-start gap-2.5">
            <AlertCircle size={16} className="text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-[12.5px] font-bold text-amber-900">Cloud sync unavailable</p>
              <p className="text-[11.5px] text-amber-800 mt-0.5">{error}</p>
              <p className="text-[11.5px] text-amber-700 mt-1">Working from local data for now.</p>
            </div>
          </div>
        )}
      </div>
      {children}
    </>
  )
}

const NOTICE_KEY = 'cb_migration_notice_collapsed'

/**
 * Which migrations this database is still missing.
 *
 * Previously there were three separate notices, each naming only the next file,
 * so a database several versions behind told you about one migration, then
 * another after a reload. They are detected together, so they are listed
 * together — a database that is up to date shows nothing at all.
 */
function MigrationNotice({
  supabase, schemaV2, schemaV3, schemaV4,
}: {
  supabase: boolean
  schemaV2: boolean
  schemaV3: boolean
  schemaV4: boolean
}) {
  const [open, setOpen] = useState(() => sessionStorage.getItem(NOTICE_KEY) !== '1')

  if (!supabase || schemaV4) return null

  const pending: { file: string; adds: string }[] = []
  if (!schemaV2) pending.push({ file: '0015_cloudbasket360_v2.sql', adds: 'opening balances, receipts, assets, smart budget, family users' })
  if (!schemaV3) pending.push({ file: '0016_security_verification.sql', adds: 'login-lock questions, instalment extras, planned income' })
  // 0017 carries no version stamp of its own, so it is listed whenever the
  // database is behind 0018. Every migration is safe to re-run.
  pending.push({ file: '0017_savings_investment_accounts.sql', adds: 'savings and investment account types' })
  pending.push({ file: '0018_goal_currency.sql', adds: "a savings goal's own currency" })

  if (!open)
    return (
      <button
        onClick={() => { setOpen(true); sessionStorage.removeItem(NOTICE_KEY) }}
        className="pointer-events-auto self-end card bg-brand-50 border-brand-200 px-3 h-9 inline-flex items-center gap-2 text-[12px] font-bold text-brand-900 cursor-pointer"
      >
        <AlertCircle size={14} className="text-brand-600" />
        {pending.length} database update{pending.length === 1 ? '' : 's'}
        <ChevronUp size={13} className="text-brand-600" />
      </button>
    )

  return (
    <div className="pointer-events-auto card w-full sm:max-w-sm bg-brand-50 border-brand-200 px-4 py-3 max-h-[60dvh] overflow-y-auto scroll-thin">
      <div className="flex items-start gap-2.5">
        <AlertCircle size={16} className="text-brand-600 mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[12.5px] font-bold text-brand-900">
              {pending.length} database update{pending.length === 1 ? '' : 's'} to run
            </p>
            {/* Collapses to a chip — it reappears on the next load until the migrations are actually run. */}
            <button
              onClick={() => { setOpen(false); sessionStorage.setItem(NOTICE_KEY, '1') }}
              aria-label="Collapse"
              className="-mt-0.5 -mr-1 h-6 w-6 shrink-0 grid place-items-center rounded-lg text-brand-500 hover:bg-brand-100 cursor-pointer"
            >
              <X size={13} />
            </button>
          </div>
          <p className="text-[11.5px] text-brand-800 mt-0.5">
            In <b>Supabase → SQL Editor</b>, run these from <b>supabase/migrations/</b> in order. Each one is additive
            and safe to re-run; everything keeps working meanwhile.
          </p>
          <ul className="mt-1.5 space-y-1">
            {pending.map((m) => (
              <li key={m.file} className="text-[11px] text-brand-800">
                <b className="font-mono text-[10.5px]">{m.file}</b>
                <span className="text-brand-700"> — {m.adds}</span>
              </li>
            ))}
          </ul>
          {!schemaV3 && (
            <p className="text-[11px] text-brand-700 mt-1.5">
              Optional: <b>supabase functions deploy security-verify</b> for a server-checked login question. The Photo
              Security Lock works without it.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
