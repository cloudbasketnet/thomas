import { useCallback, useEffect, useRef } from 'react'
import { AlertTriangle, CheckCircle2, Eye, Loader2, RefreshCw, Sparkles, TrendingUp } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Card, CardHead } from '@/components/ui/Primitives'
import { analyseFinances, hasGemini, type Insight, type InsightKind } from '@/lib/gemini'
import { buildSnapshot, hasEnoughData } from '@/lib/insights'

/** Re-analyse at most this often on its own; the refresh button always works. */
const STALE_AFTER_MS = 12 * 60 * 60 * 1000

const STYLE: Record<InsightKind, { icon: typeof AlertTriangle; box: string; chip: string; label: string }> = {
  warning: {
    icon: AlertTriangle,
    box: 'bg-rose-50/70 border-rose-100',
    chip: 'bg-rose-100 text-rose-700',
    label: 'Warning',
  },
  watch: {
    icon: Eye,
    box: 'bg-amber-50/70 border-amber-100',
    chip: 'bg-amber-100 text-amber-800',
    label: 'Watch',
  },
  good: {
    icon: CheckCircle2,
    box: 'bg-emerald-50/70 border-emerald-100',
    chip: 'bg-emerald-100 text-emerald-700',
    label: 'Good',
  },
}

const ORDER: InsightKind[] = ['warning', 'watch', 'good']

function InsightRow({ insight }: { insight: Insight }) {
  const style = STYLE[insight.kind] ?? STYLE.watch
  const Icon = style.icon
  return (
    <div className={`rounded-xl border px-3.5 py-3 ${style.box}`}>
      <div className="flex items-start gap-2.5">
        <Icon size={15} className="mt-0.5 shrink-0 text-slate-500" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[12.5px] font-bold text-slate-800">{insight.title}</p>
            <span className={`chip ${style.chip}`}>{style.label}</span>
            {insight.metric && (
              <span className="text-[11px] font-bold text-slate-500 tabular-nums">{insight.metric}</span>
            )}
          </div>
          <p className="text-[11.5px] text-slate-600 mt-1 leading-relaxed">{insight.detail}</p>
          {insight.action && (
            <p className="text-[11.5px] text-slate-700 mt-1.5">
              <span className="font-semibold">Do this: </span>
              {insight.action}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export function InsightsPanel() {
  const {
    transactions, accounts, budgets, bills, loans, goals, settings,
    analysis, analysing, analysisError, setAnalysis, setAnalysing, setAnalysisError,
  } = useStore()
  const abort = useRef<AbortController | null>(null)
  const tried = useRef(false)

  const snapshot = buildSnapshot(transactions, accounts, budgets, bills, loans, goals, settings)
  const enoughData = hasEnoughData(snapshot)

  const run = useCallback(async () => {
    if (!hasGemini || analysing) return
    abort.current?.abort()
    abort.current = new AbortController()
    setAnalysing(true)
    try {
      const next = await analyseFinances(
        buildSnapshot(
          useStore.getState().transactions,
          useStore.getState().accounts,
          useStore.getState().budgets,
          useStore.getState().bills,
          useStore.getState().loans,
          useStore.getState().goals,
          useStore.getState().settings,
        ),
        abort.current.signal,
      )
      setAnalysis(next)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setAnalysisError(e instanceof Error ? e.message : String(e))
    }
    setAnalysing(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysing])

  // Refresh on its own at most once every STALE_AFTER_MS, and only once per
  // mount, so opening the dashboard repeatedly does not spend the quota.
  //
  // The result lands in the store rather than component state, so a request
  // that outlives this component is still useful — it is deliberately not
  // aborted on unmount. Doing so broke it under StrictMode's double mount:
  // the cleanup cancelled the request while `tried` blocked the retry.
  useEffect(() => {
    if (tried.current || !hasGemini || !enoughData) return
    const age = analysis ? Date.now() - new Date(analysis.generatedAt).getTime() : Infinity
    if (age < STALE_AFTER_MS) return
    tried.current = true
    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enoughData])

  if (!hasGemini) return null

  const sorted = analysis ? [...analysis.insights].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind)) : []
  const generated = analysis ? new Date(analysis.generatedAt) : null

  return (
    <Card>
      <CardHead
        title="What your money is doing"
        sub={
          generated
            ? `Analysed ${generated.toLocaleDateString()} at ${generated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : 'Thomas.ai reads your month and tells you what to watch'
        }
        right={
          <button
            onClick={run}
            disabled={analysing || !enoughData}
            className="btn-ghost h-8 px-3 text-[12px] disabled:opacity-50"
            title={enoughData ? 'Re-run the analysis' : 'Record some income or expenses first'}
          >
            {analysing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            {analysing ? 'Reading…' : 'Refresh'}
          </button>
        }
      />

      <div className="px-5 pb-5 space-y-3">
        {!enoughData && (
          <p className="text-[12.5px] text-slate-500 py-4 text-center">
            Record some income or expenses and Thomas.ai will tell you what is happening.
          </p>
        )}

        {enoughData && analysing && !analysis && (
          <div className="py-8 text-center">
            <Loader2 size={20} className="animate-spin text-brand-600 mx-auto mb-2" />
            <p className="text-[12.5px] text-slate-500">Reading your month…</p>
          </div>
        )}

        {analysisError && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 flex items-start gap-2">
            <AlertTriangle size={15} className="text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-[12px] font-bold text-amber-900">Could not analyse right now</p>
              <p className="text-[11.5px] text-amber-800 mt-0.5">{analysisError}</p>
            </div>
          </div>
        )}

        {analysis && (
          <>
            <div className="rounded-xl bg-gradient-to-r from-brand-50 via-white to-white border border-brand-100 px-4 py-3.5">
              <div className="flex items-start gap-2.5">
                <span className="h-8 w-8 rounded-lg bg-gradient-to-br from-brand-500 to-cyan-400 grid place-items-center text-white shrink-0">
                  <Sparkles size={15} />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-slate-800 leading-snug">{analysis.headline}</p>
                  <p className="text-[12px] text-slate-600 mt-1.5 leading-relaxed flex items-start gap-1.5">
                    <TrendingUp size={13} className="text-slate-400 mt-0.5 shrink-0" />
                    {analysis.outlook}
                  </p>
                </div>
              </div>
            </div>

            {sorted.map((insight, i) => (
              <InsightRow key={`${insight.title}-${i}`} insight={insight} />
            ))}

            <p className="text-[10.5px] text-slate-400 pt-1">
              Generated by Gemini from your own figures. Check anything before acting on it.
            </p>
          </>
        )}
      </div>
    </Card>
  )
}
