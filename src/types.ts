export type Currency = 'AED' | 'INR' | 'USD'

export type AccountType = 'bank' | 'cash' | 'card' | 'loan'

export interface Account {
  id: string
  name: string
  type: AccountType
  details: string
  balance: number
  currency: Currency
  status: 'Active' | 'Available' | 'Closed'
  color: string
  bank?: string
}

export type TxnType = 'income' | 'expense'

export interface Transaction {
  id: string
  type: TxnType
  date: string // yyyy-MM-dd
  description: string
  category: string
  accountId: string
  amount: number
  currency: Currency
  person?: string
  method?: string
  notes?: string
  /** Merchant the money went to. Drives the by-store breakdown. */
  store?: string
  /** Units bought. `amount` is always the line total, so unit price is amount / qty. */
  qty?: number
  /** Warranty length in months, for purchases worth tracking afterwards. */
  warrantyMonths?: number
}

export interface BudgetCategory {
  id: string
  name: string
  icon: string
  budget: number
  spent: number
  color: string
}

export interface Loan {
  id: string
  name: string
  lender: string
  outstanding: number
  principal: number
  emi: number
  nextPayment: string
  currency: Currency
  status: 'On Track' | 'Due Soon' | 'Overdue' | 'Closed'
  rate: number
  icon: string
}

export interface Person {
  id: string
  name: string
  relation: string
  color: string
  spent: number
  theyOwe: number
  iOwe: number
  phone?: string
}

export interface Bill {
  id: string
  name: string
  category: string
  amount: number
  dueDate: string
  frequency: 'Monthly' | 'Quarterly' | 'Yearly' | 'Weekly'
  status: 'Paid' | 'Pending' | 'Overdue'
  autopay: boolean
  icon: string
}

export interface Doc {
  id: string
  name: string
  type: string
  expiry: string
  owner: string
  status: 'Valid' | 'Expiring Soon' | 'Expired'
  icon: string
}

export interface Note {
  id: string
  title: string
  category: 'Personal' | 'Work' | 'Family' | 'Car' | 'Loan'
  dueDate: string
  status: 'Pending' | 'In Progress' | 'Planned' | 'Done'
  done: boolean
}

export interface Goal {
  id: string
  name: string
  target: number
  saved: number
  deadline: string
  icon: string
  color: string
}

export interface Purchase {
  id: string
  item: string
  store: string
  category: string
  price: number
  qty: number
  date: string
  person: string
  status: 'Planned' | 'Ordered' | 'Delivered' | 'Returned'
  warrantyMonths?: number
  notes?: string
}

export interface PriceWatch {
  id: string
  item: string
  store: string
  current: number
  previous: number
  target: number
  updated: string
}

export interface Settings {
  userName: string
  accountLabel: string
  baseCurrency: Currency
  monthlyIncomeTarget: number
  monthlyBudget: number
  periodStart: string
  periodEnd: string
}
