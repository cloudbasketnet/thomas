import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Account, Bill, BudgetCategory, Doc, Goal, Loan, Note, Person, PriceWatch, Settings, Transaction,
} from '@/types'
import {
  ACCOUNTS, BILLS, BUDGETS, DOCUMENTS, GOALS, LOANS, NOTES, PEOPLE, PRICE_WATCH, SETTINGS, TRANSACTIONS,
} from '@/data/seed'
import { setBaseCurrency, uid } from '@/lib/format'
import { hasSupabase } from '@/lib/supabase'
import { deleteRow, upsertRow, upsertSettings, type RemoteData } from '@/lib/sync'
import type { Collection } from '@/lib/mappers'

interface State {
  // ---- data
  settings: Settings
  accounts: Account[]
  transactions: Transaction[]
  budgets: BudgetCategory[]
  loans: Loan[]
  people: Person[]
  bills: Bill[]
  documents: Doc[]
  notes: Note[]
  goals: Goal[]
  priceWatch: PriceWatch[]

  // ---- cloud session
  userId: string | null
  userEmail: string | null
  syncing: boolean
  syncError: string | null
  lastSynced: string | null

  setSession: (userId: string | null, email: string | null) => void
  hydrate: (data: RemoteData) => void
  setSyncing: (v: boolean) => void
  setSyncError: (msg: string | null) => void

  updateSettings: (patch: Partial<Settings>) => void

  addTransaction: (t: Omit<Transaction, 'id'>) => void
  updateTransaction: (id: string, patch: Partial<Transaction>) => void
  removeTransaction: (id: string) => void

  addAccount: (a: Omit<Account, 'id'>) => void
  updateAccount: (id: string, patch: Partial<Account>) => void
  removeAccount: (id: string) => void

  addBudget: (b: Omit<BudgetCategory, 'id'>) => void
  updateBudget: (id: string, patch: Partial<BudgetCategory>) => void
  removeBudget: (id: string) => void

  addLoan: (l: Omit<Loan, 'id'>) => void
  updateLoan: (id: string, patch: Partial<Loan>) => void
  removeLoan: (id: string) => void
  payLoan: (id: string, amount: number) => void

  addPerson: (p: Omit<Person, 'id'>) => void
  updatePerson: (id: string, patch: Partial<Person>) => void
  removePerson: (id: string) => void

  addBill: (b: Omit<Bill, 'id'>) => void
  updateBill: (id: string, patch: Partial<Bill>) => void
  removeBill: (id: string) => void
  payBill: (id: string) => void

  addDocument: (d: Omit<Doc, 'id'>) => void
  updateDocument: (id: string, patch: Partial<Doc>) => void
  removeDocument: (id: string) => void

  addNote: (n: Omit<Note, 'id'>) => void
  updateNote: (id: string, patch: Partial<Note>) => void
  removeNote: (id: string) => void
  toggleNote: (id: string) => void

  addGoal: (g: Omit<Goal, 'id'>) => void
  updateGoal: (id: string, patch: Partial<Goal>) => void
  removeGoal: (id: string) => void
  contributeGoal: (id: string, amount: number) => void


  addPriceWatch: (p: Omit<PriceWatch, 'id'>) => void
  updatePriceWatch: (id: string, patch: Partial<PriceWatch>) => void
  removePriceWatch: (id: string) => void

  /** Empty every collection, locally. */
  clearAllData: () => void
  /** Wipe locally cached rows back to the seed set (used on sign-out). */
  clearLocalData: () => void
}

const seedState = () => ({
  settings: SETTINGS,
  accounts: ACCOUNTS,
  transactions: TRANSACTIONS,
  budgets: BUDGETS,
  loans: LOANS,
  people: PEOPLE,
  bills: BILLS,
  documents: DOCUMENTS,
  notes: NOTES,
  goals: GOALS,
  priceWatch: PRICE_WATCH,
})

// ---------------------------------------------------------------------------
// Write-through helpers. The UI updates optimistically; the network call runs
// in the background and only surfaces if it fails, so nothing ever blocks on it.
// ---------------------------------------------------------------------------

function cloudOn() {
  return hasSupabase && Boolean(useStore.getState().userId)
}

function fail(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e)
  useStore.setState({ syncError: msg })
}

function ok() {
  useStore.setState({ syncError: null, lastSynced: new Date().toISOString() })
}

function push(collection: Collection, item: unknown) {
  if (!cloudOn() || !item) return
  upsertRow(collection, item, useStore.getState().userId!).then(ok, fail)
}

function drop(collection: Collection, id: string) {
  if (!cloudOn()) return
  deleteRow(collection, id).then(ok, fail)
}

/** Apply a patch to one item in a list, push the merged result, return the list. */
function patchList<T extends { id: string }>(
  list: T[],
  id: string,
  patch: Partial<T>,
  collection: Collection,
): T[] {
  const next = list.map((x) => (x.id === id ? { ...x, ...patch } : x))
  push(collection, next.find((x) => x.id === id))
  return next
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...seedState(),

      userId: null,
      userEmail: null,
      syncing: false,
      syncError: null,
      lastSynced: null,

      setSession: (userId, userEmail) => set({ userId, userEmail }),
      hydrate: (data) => {
        setBaseCurrency(data.settings.baseCurrency)
        set({
          settings: data.settings,
          accounts: data.accounts,
          transactions: data.transactions,
          budgets: data.budgets,
          loans: data.loans,
          people: data.people,
          bills: data.bills,
          documents: data.documents,
          notes: data.notes,
          goals: data.goals,
          priceWatch: data.priceWatch,
          lastSynced: new Date().toISOString(),
          syncError: null,
        })
      },
      setSyncing: (syncing) => set({ syncing }),
      setSyncError: (syncError) => set({ syncError }),

      updateSettings: (patch) => {
        const settings = { ...get().settings, ...patch }
        setBaseCurrency(settings.baseCurrency)
        set({ settings })
        if (cloudOn()) upsertSettings(settings, get().userId!).then(ok, fail)
      },

      // ---------------------------------------------------------- transactions
      addTransaction: (t) => {
        const item = { ...t, id: uid('t') }
        set({ transactions: [item, ...get().transactions] })
        push('transactions', item)
      },
      updateTransaction: (id, patch) =>
        set({ transactions: patchList(get().transactions, id, patch, 'transactions') }),
      removeTransaction: (id) => {
        set({ transactions: get().transactions.filter((t) => t.id !== id) })
        drop('transactions', id)
      },

      // -------------------------------------------------------------- accounts
      addAccount: (a) => {
        const item = { ...a, id: uid('ac') }
        set({ accounts: [...get().accounts, item] })
        push('accounts', item)
      },
      updateAccount: (id, patch) => set({ accounts: patchList(get().accounts, id, patch, 'accounts') }),
      removeAccount: (id) => {
        set({ accounts: get().accounts.filter((a) => a.id !== id) })
        drop('accounts', id)
      },

      // --------------------------------------------------------------- budgets
      addBudget: (b) => {
        const item = { ...b, id: uid('b') }
        set({ budgets: [...get().budgets, item] })
        push('budgets', item)
      },
      updateBudget: (id, patch) => set({ budgets: patchList(get().budgets, id, patch, 'budgets') }),
      removeBudget: (id) => {
        set({ budgets: get().budgets.filter((b) => b.id !== id) })
        drop('budgets', id)
      },

      // ----------------------------------------------------------------- loans
      addLoan: (l) => {
        const item = { ...l, id: uid('l') }
        set({ loans: [...get().loans, item] })
        push('loans', item)
      },
      updateLoan: (id, patch) => set({ loans: patchList(get().loans, id, patch, 'loans') }),
      removeLoan: (id) => {
        set({ loans: get().loans.filter((l) => l.id !== id) })
        drop('loans', id)
      },
      payLoan: (id, amount) => {
        const loan = get().loans.find((l) => l.id === id)
        if (!loan) return
        const outstanding = Math.max(0, loan.outstanding - amount)
        set({
          loans: patchList<Loan>(get().loans, id, {
            outstanding,
            status: outstanding <= 0 ? 'Closed' : 'On Track',
          }, 'loans'),
        })
      },

      // ---------------------------------------------------------------- people
      addPerson: (p) => {
        const item = { ...p, id: uid('p') }
        set({ people: [...get().people, item] })
        push('people', item)
      },
      updatePerson: (id, patch) => set({ people: patchList(get().people, id, patch, 'people') }),
      removePerson: (id) => {
        set({ people: get().people.filter((p) => p.id !== id) })
        drop('people', id)
      },

      // ----------------------------------------------------------------- bills
      addBill: (b) => {
        const item = { ...b, id: uid('bl') }
        set({ bills: [...get().bills, item] })
        push('bills', item)
      },
      updateBill: (id, patch) => set({ bills: patchList(get().bills, id, patch, 'bills') }),
      removeBill: (id) => {
        set({ bills: get().bills.filter((b) => b.id !== id) })
        drop('bills', id)
      },
      payBill: (id) => set({ bills: patchList<Bill>(get().bills, id, { status: 'Paid' }, 'bills') }),

      // ------------------------------------------------------------- documents
      addDocument: (d) => {
        const item = { ...d, id: uid('d') }
        set({ documents: [...get().documents, item] })
        push('documents', item)
      },
      updateDocument: (id, patch) => set({ documents: patchList(get().documents, id, patch, 'documents') }),
      removeDocument: (id) => {
        set({ documents: get().documents.filter((d) => d.id !== id) })
        drop('documents', id)
      },

      // ----------------------------------------------------------------- notes
      addNote: (n) => {
        const item = { ...n, id: uid('n') }
        set({ notes: [item, ...get().notes] })
        push('notes', item)
      },
      updateNote: (id, patch) => set({ notes: patchList(get().notes, id, patch, 'notes') }),
      removeNote: (id) => {
        set({ notes: get().notes.filter((n) => n.id !== id) })
        drop('notes', id)
      },
      toggleNote: (id) => {
        const note = get().notes.find((n) => n.id === id)
        if (!note) return
        const done = !note.done
        set({
          notes: patchList<Note>(get().notes, id, { done, status: done ? 'Done' : 'Pending' }, 'notes'),
        })
      },

      // ----------------------------------------------------------------- goals
      addGoal: (g) => {
        const item = { ...g, id: uid('g') }
        set({ goals: [...get().goals, item] })
        push('goals', item)
      },
      updateGoal: (id, patch) => set({ goals: patchList(get().goals, id, patch, 'goals') }),
      removeGoal: (id) => {
        set({ goals: get().goals.filter((g) => g.id !== id) })
        drop('goals', id)
      },
      contributeGoal: (id, amount) => {
        const goal = get().goals.find((g) => g.id === id)
        if (!goal) return
        set({
          goals: patchList<Goal>(get().goals, id, { saved: Math.min(goal.target, goal.saved + amount) }, 'goals'),
        })
      },

      // ----------------------------------------------------------- price watch
      addPriceWatch: (p) => {
        const item = { ...p, id: uid('pw') }
        set({ priceWatch: [...get().priceWatch, item] })
        push('priceWatch', item)
      },
      updatePriceWatch: (id, patch) => set({ priceWatch: patchList(get().priceWatch, id, patch, 'priceWatch') }),
      removePriceWatch: (id) => {
        set({ priceWatch: get().priceWatch.filter((p) => p.id !== id) })
        drop('priceWatch', id)
      },

      clearAllData: () => set(seedState()),
      clearLocalData: () => {
        setBaseCurrency(SETTINGS.baseCurrency)
        set(seedState())
      },
    }),
    {
      name: 'thomas-finance-v1',
      onRehydrateStorage: () => (state) => {
        if (state) setBaseCurrency(state.settings.baseCurrency)
      },
      // Session fields are owned by Supabase auth, never by localStorage.
      partialize: (s) => {
        const { userId, userEmail, syncing, syncError, lastSynced, ...data } = s
        void userId; void userEmail; void syncing; void syncError; void lastSynced
        return data
      },
    },
  ),
)
