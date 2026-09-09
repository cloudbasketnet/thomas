import type {
  Account, Bill, BudgetCategory, Doc, Goal, Loan, Note, Person, PriceWatch, Purchase, Settings, Transaction,
} from '@/types'

export const SETTINGS: Settings = {
  userName: 'Thomas',
  accountLabel: 'Personal Account',
  baseCurrency: 'AED',
  monthlyIncomeTarget: 15520,
  monthlyBudget: 12000,
  periodStart: '2026-09-01',
  periodEnd: '2026-09-30',
}

export const FX: Record<string, number> = { AED: 1, INR: 0.0434, USD: 3.6725 }

export const ACCOUNTS: Account[] = [
  { id: 'ac1', name: 'HDFC Bank Savings', type: 'bank', details: '**** 1234', balance: 120000, currency: 'INR', status: 'Active', color: '#e11d48', bank: 'HDFC' },
  { id: 'ac2', name: 'SBI Current Account', type: 'bank', details: '**** 5678', balance: 250000, currency: 'INR', status: 'Active', color: '#7c3aed', bank: 'SBI' },
  { id: 'ac3', name: 'ICICI Bank Savings', type: 'bank', details: '**** 9012', balance: 50000, currency: 'INR', status: 'Active', color: '#f97316', bank: 'ICICI' },
  { id: 'ac4', name: 'Emirates NBD', type: 'bank', details: '**** 2211', balance: 14600, currency: 'AED', status: 'Active', color: '#0ea5e9', bank: 'Emirates NBD' },
  { id: 'ac5', name: 'FAB Main Account', type: 'bank', details: '**** 7788', balance: 21400, currency: 'AED', status: 'Active', color: '#2563eb', bank: 'FAB' },
  { id: 'ac6', name: 'ADCB Business', type: 'bank', details: '**** 4455', balance: 1400, currency: 'AED', status: 'Active', color: '#dc2626', bank: 'ADCB' },
  { id: 'ac7', name: 'Cash - Home', type: 'cash', details: '—', balance: 8750, currency: 'AED', status: 'Active', color: '#10b981' },
  { id: 'ac8', name: 'Cash - Office', type: 'cash', details: '—', balance: 3650, currency: 'AED', status: 'Active', color: '#059669' },
  { id: 'ac9', name: 'Emirates Islamic Card', type: 'card', details: '**** 3344', balance: 12800, currency: 'AED', status: 'Available', color: '#8b5cf6' },
  { id: 'ac10', name: 'FAB Credit Card', type: 'card', details: '**** 8899', balance: 5700, currency: 'AED', status: 'Available', color: '#ec4899' },
  { id: 'ac11', name: 'Personal Loan (FAB)', type: 'loan', details: 'LN-2026-001', balance: 22500, currency: 'AED', status: 'Active', color: '#f59e0b' },
  { id: 'ac12', name: 'Car Loan (Emirates NBD)', type: 'loan', details: 'LN-2025-004', balance: 23300, currency: 'AED', status: 'Active', color: '#ef4444' },
]

export const TRANSACTIONS: Transaction[] = [
  // ---- September 2026 income
  { id: 't1', type: 'income', date: '2026-09-30', description: 'Restaurant Sales (POS)', category: 'Restaurant Sales', accountId: 'ac5', amount: 2800, currency: 'AED', person: 'Me', method: 'Bank Transfer' },
  { id: 't2', type: 'income', date: '2026-09-29', description: 'Talabat Orders', category: 'Online Orders', accountId: 'ac4', amount: 1950, currency: 'AED', person: 'Me', method: 'Bank Transfer' },
  { id: 't3', type: 'income', date: '2026-09-28', description: 'Catering - University', category: 'Catering', accountId: 'ac5', amount: 1500, currency: 'AED', person: 'Me', method: 'Cheque' },
  { id: 't4', type: 'income', date: '2026-09-27', description: 'Online Website Orders', category: 'Online Orders', accountId: 'ac8', amount: 850, currency: 'AED', person: 'Me', method: 'Cash' },
  { id: 't5', type: 'income', date: '2026-09-26', description: 'Refund Received', category: 'Refund / Adjustment', accountId: 'ac5', amount: 320, currency: 'AED', person: 'Me', method: 'Bank Transfer' },
  { id: 't6', type: 'income', date: '2026-09-25', description: 'Other Income', category: 'Other Income', accountId: 'ac7', amount: 580, currency: 'AED', person: 'Me', method: 'Cash' },
  { id: 't7', type: 'income', date: '2026-09-20', description: 'Restaurant Sales (POS)', category: 'Restaurant Sales', accountId: 'ac5', amount: 2400, currency: 'AED', person: 'Me', method: 'Card' },
  { id: 't8', type: 'income', date: '2026-09-12', description: 'Investment Payout', category: 'Investment', accountId: 'ac4', amount: 600, currency: 'AED', person: 'Me', method: 'Bank Transfer' },
  { id: 't9', type: 'income', date: '2026-09-08', description: 'Catering - Corporate', category: 'Catering', accountId: 'ac5', amount: 300, currency: 'AED', person: 'Me', method: 'Bank Transfer' },
  { id: 't10', type: 'income', date: '2026-09-04', description: 'Talabat Orders', category: 'Online Orders', accountId: 'ac4', amount: 700, currency: 'AED', person: 'Me', method: 'Bank Transfer' },

  // ---- September 2026 expenses
  { id: 't20', type: 'expense', date: '2026-09-30', description: 'Rent Payment', category: 'Home / Rent', accountId: 'ac4', amount: 3000, currency: 'AED', person: 'Family', method: 'Bank Transfer' },
  { id: 't21', type: 'expense', date: '2026-09-28', description: 'Grocery Shopping', category: 'Groceries', accountId: 'ac5', amount: 650, currency: 'AED', person: 'Family', method: 'Card' },
  { id: 't22', type: 'expense', date: '2026-09-25', description: 'Fuel', category: 'Transport', accountId: 'ac10', amount: 300, currency: 'AED', person: 'Me', method: 'Credit Card' },
  { id: 't23', type: 'expense', date: '2026-09-20', description: 'Electricity Bill (DEWA)', category: 'Utilities', accountId: 'ac4', amount: 420, currency: 'AED', person: 'Family', method: 'Bank Transfer' },
  { id: 't24', type: 'expense', date: '2026-09-15', description: 'Family Support', category: 'Family Support', accountId: 'ac7', amount: 1000, currency: 'AED', person: 'Others', method: 'Cash' },
  { id: 't25', type: 'expense', date: '2026-09-10', description: 'Pharmacy', category: 'Health', accountId: 'ac5', amount: 280, currency: 'AED', person: 'Family', method: 'Card' },
  { id: 't26', type: 'expense', date: '2026-09-05', description: 'Netflix Subscription', category: 'Subscriptions', accountId: 'ac10', amount: 40, currency: 'AED', person: 'Me', method: 'Credit Card' },
  { id: 't27', type: 'expense', date: '2026-09-22', description: 'Restaurant Dinner', category: 'Restaurants', accountId: 'ac9', amount: 380, currency: 'AED', person: 'Family', method: 'Credit Card' },
  { id: 't28', type: 'expense', date: '2026-09-18', description: 'Clothing Purchase', category: 'Shopping', accountId: 'ac9', amount: 410, currency: 'AED', person: 'Me', method: 'Credit Card' },
  { id: 't29', type: 'expense', date: '2026-09-16', description: 'School Fees Contribution', category: 'Family Support', accountId: 'ac4', amount: 700, currency: 'AED', person: 'Others', method: 'Bank Transfer' },
  { id: 't30', type: 'expense', date: '2026-09-14', description: 'Car Servicing', category: 'Transport', accountId: 'ac5', amount: 320, currency: 'AED', person: 'Me', method: 'Card' },
  { id: 't31', type: 'expense', date: '2026-09-12', description: 'Groceries - Carrefour', category: 'Groceries', accountId: 'ac5', amount: 330, currency: 'AED', person: 'Family', method: 'Card' },
  { id: 't32', type: 'expense', date: '2026-09-09', description: 'Internet (Etisalat)', category: 'Utilities', accountId: 'ac4', amount: 389, currency: 'AED', person: 'Family', method: 'Bank Transfer' },
  { id: 't33', type: 'expense', date: '2026-09-07', description: 'Mobile Recharge', category: 'Utilities', accountId: 'ac7', amount: 120, currency: 'AED', person: 'Me', method: 'Cash' },
  { id: 't34', type: 'expense', date: '2026-09-03', description: 'Personal Care', category: 'Personal', accountId: 'ac7', amount: 420, currency: 'AED', person: 'Me', method: 'Cash' },
  { id: 't35', type: 'expense', date: '2026-09-02', description: 'Loan EMI - Personal', category: 'Loan Payment', accountId: 'ac5', amount: 1200, currency: 'AED', person: 'Me', method: 'Auto Debit' },

  // ---- August 2026 (comparison month)
  { id: 't40', type: 'income', date: '2026-08-28', description: 'Restaurant Sales (POS)', category: 'Restaurant Sales', accountId: 'ac5', amount: 4200, currency: 'AED', person: 'Me', method: 'Card' },
  { id: 't41', type: 'income', date: '2026-08-20', description: 'Talabat Orders', category: 'Online Orders', accountId: 'ac4', amount: 2600, currency: 'AED', person: 'Me', method: 'Bank Transfer' },
  { id: 't42', type: 'income', date: '2026-08-10', description: 'Catering - Event', category: 'Catering', accountId: 'ac5', amount: 3400, currency: 'AED', person: 'Me', method: 'Cheque' },
  { id: 't43', type: 'expense', date: '2026-08-30', description: 'Rent Payment', category: 'Home / Rent', accountId: 'ac4', amount: 3000, currency: 'AED', person: 'Family', method: 'Bank Transfer' },
  { id: 't44', type: 'expense', date: '2026-08-22', description: 'Groceries', category: 'Groceries', accountId: 'ac5', amount: 1450, currency: 'AED', person: 'Family', method: 'Card' },
  { id: 't45', type: 'expense', date: '2026-08-15', description: 'Family Support', category: 'Family Support', accountId: 'ac7', amount: 900, currency: 'AED', person: 'Others', method: 'Cash' },
  { id: 't46', type: 'expense', date: '2026-08-05', description: 'Utilities', category: 'Utilities', accountId: 'ac4', amount: 780, currency: 'AED', person: 'Family', method: 'Bank Transfer' },
]

/** Aggregated monthly history used by trend charts (AED). */
export const MONTHLY_HISTORY = [
  { month: 'Jan', income: 10200, expenses: 7100 },
  { month: 'Feb', income: 11500, expenses: 8300 },
  { month: 'Mar', income: 9400, expenses: 8800 },
  { month: 'Apr', income: 12600, expenses: 10200 },
  { month: 'May', income: 15100, expenses: 11300 },
  { month: 'Jun', income: 11400, expenses: 9200 },
  { month: 'Jul', income: 9600, expenses: 7900 },
  { month: 'Aug', income: 11900, expenses: 8870 },
  { month: 'Sep', income: 12000, expenses: 9850 },
]

export const BUDGETS: BudgetCategory[] = [
  { id: 'b1', name: 'Home / Family', icon: '🏠', budget: 2500, spent: 1850, color: '#3b82f6' },
  { id: 'b2', name: 'Grocery', icon: '🛒', budget: 1200, spent: 980, color: '#10b981' },
  { id: 'b3', name: 'Personal', icon: '👤', budget: 800, spent: 420, color: '#8b5cf6' },
  { id: 'b4', name: 'Fuel / Transport', icon: '🚗', budget: 600, spent: 320, color: '#f59e0b' },
  { id: 'b5', name: 'Restaurants', icon: '🍽️', budget: 500, spent: 380, color: '#ec4899' },
  { id: 'b6', name: 'Shopping', icon: '🛍️', budget: 600, spent: 410, color: '#eab308' },
  { id: 'b7', name: 'Bills & Utilities', icon: '📄', budget: 2000, spent: 1500, color: '#06b6d4' },
  { id: 'b8', name: 'Health', icon: '➕', budget: 800, spent: 280, color: '#ef4444' },
]

export const LOANS: Loan[] = [
  { id: 'l1', name: 'Personal Loan', lender: 'FAB', outstanding: 22500, principal: 45000, emi: 1200, nextPayment: '2026-09-25', currency: 'AED', status: 'Due Soon', rate: 5.9, icon: '💳' },
  { id: 'l2', name: 'Car Loan', lender: 'Emirates NBD', outstanding: 38200, principal: 72000, emi: 1500, nextPayment: '2026-10-05', currency: 'AED', status: 'On Track', rate: 4.2, icon: '🚗' },
  { id: 'l3', name: 'Credit Card (FAB)', lender: 'FAB', outstanding: 4350, principal: 10000, emi: 900, nextPayment: '2026-09-15', currency: 'AED', status: 'Overdue', rate: 18.5, icon: '💳' },
  { id: 'l4', name: 'Family Loan (INR)', lender: 'Family', outstanding: 120000, principal: 300000, emi: 10000, nextPayment: '2026-10-10', currency: 'INR', status: 'On Track', rate: 0, icon: '👨‍👩‍👦' },
]

export const PEOPLE: Person[] = [
  { id: 'p1', name: 'Me', relation: 'Self', color: '#3b82f6', spent: 2150, theyOwe: 0, iOwe: 0, phone: '+971 50 000 0000' },
  { id: 'p2', name: 'Family', relation: 'Household', color: '#10b981', spent: 2300, theyOwe: 0, iOwe: 0, phone: '—' },
  { id: 'p3', name: 'Others', relation: 'Support', color: '#f59e0b', spent: 700, theyOwe: 0, iOwe: 0, phone: '—' },
  { id: 'p4', name: 'Ahmed', relation: 'Business Partner', color: '#8b5cf6', spent: 0, theyOwe: 3200, iOwe: 0, phone: '+971 55 123 4567' },
  { id: 'p5', name: 'Rahul', relation: 'Friend', color: '#ec4899', spent: 0, theyOwe: 850, iOwe: 0, phone: '+971 52 987 6543' },
  { id: 'p6', name: 'Suresh', relation: 'Supplier', color: '#ef4444', spent: 0, theyOwe: 0, iOwe: 1400, phone: '+971 56 222 3344' },
]

export const BILLS: Bill[] = [
  { id: 'bl1', name: 'DEWA Electricity', category: 'Utilities', amount: 420, dueDate: '2026-09-20', frequency: 'Monthly', status: 'Paid', autopay: true, icon: '⚡' },
  { id: 'bl2', name: 'Etisalat Internet', category: 'Utilities', amount: 389, dueDate: '2026-09-09', frequency: 'Monthly', status: 'Paid', autopay: true, icon: '🌐' },
  { id: 'bl3', name: 'Netflix', category: 'Entertainment', amount: 40, dueDate: '2026-09-05', frequency: 'Monthly', status: 'Paid', autopay: true, icon: '🎬' },
  { id: 'bl4', name: 'Spotify Family', category: 'Entertainment', amount: 30, dueDate: '2026-09-18', frequency: 'Monthly', status: 'Pending', autopay: false, icon: '🎵' },
  { id: 'bl5', name: 'Salik Top-up', category: 'Transport', amount: 100, dueDate: '2026-09-22', frequency: 'Monthly', status: 'Pending', autopay: false, icon: '🛣️' },
  { id: 'bl6', name: 'Health Insurance', category: 'Insurance', amount: 350, dueDate: '2026-09-12', frequency: 'Monthly', status: 'Overdue', autopay: false, icon: '🏥' },
  { id: 'bl7', name: 'School Fees', category: 'Education', amount: 1800, dueDate: '2026-10-05', frequency: 'Quarterly', status: 'Pending', autopay: false, icon: '🎓' },
  { id: 'bl8', name: 'Car Insurance', category: 'Insurance', amount: 2400, dueDate: '2026-12-01', frequency: 'Yearly', status: 'Pending', autopay: false, icon: '🚙' },
]

export const DOCUMENTS: Doc[] = [
  { id: 'd1', name: 'Emirates ID', type: 'Identity', expiry: '2026-12-12', owner: 'Thomas', status: 'Valid', icon: '🪪' },
  { id: 'd2', name: 'Visa', type: 'Immigration', expiry: '2026-10-20', owner: 'Thomas', status: 'Valid', icon: '📘' },
  { id: 'd3', name: 'Driving License', type: 'Identity', expiry: '2027-01-05', owner: 'Thomas', status: 'Valid', icon: '🚘' },
  { id: 'd4', name: 'Car Mulkiya', type: 'Vehicle', expiry: '2026-09-28', owner: 'Thomas', status: 'Expiring Soon', icon: '🚗' },
  { id: 'd5', name: 'Passport', type: 'Identity', expiry: '2027-06-15', owner: 'Thomas', status: 'Valid', icon: '📕' },
  { id: 'd6', name: 'Health Insurance', type: 'Insurance', expiry: '2026-11-10', owner: 'Thomas', status: 'Valid', icon: '🏥' },
  { id: 'd7', name: 'Trade License', type: 'Business', expiry: '2026-09-30', owner: 'Business', status: 'Expiring Soon', icon: '📜' },
]

export const NOTES: Note[] = [
  { id: 'n1', title: 'Renew car insurance', category: 'Car', dueDate: '2026-09-20', status: 'Pending', done: false },
  { id: 'n2', title: 'Follow up with Ahmed for loan return', category: 'Loan', dueDate: '2026-09-30', status: 'In Progress', done: false },
  { id: 'n3', title: 'Check school fees payment', category: 'Family', dueDate: '2026-10-05', status: 'Pending', done: false },
  { id: 'n4', title: 'Buy Surface laptop', category: 'Personal', dueDate: '2026-10-15', status: 'Planned', done: false },
  { id: 'n5', title: 'Call MOHRE regarding document', category: 'Work', dueDate: '2026-09-22', status: 'Pending', done: false },
  { id: 'n6', title: 'Review monthly budget with family', category: 'Family', dueDate: '2026-09-27', status: 'Pending', done: false },
  { id: 'n7', title: 'Submit VAT filing', category: 'Work', dueDate: '2026-10-28', status: 'Planned', done: false },
  { id: 'n8', title: 'Renew gym membership', category: 'Personal', dueDate: '2026-09-14', status: 'Done', done: true },
]

export const GOALS: Goal[] = [
  { id: 'g1', name: 'Emergency Fund', target: 20000, saved: 7500, deadline: '2027-03-31', icon: '🛟', color: '#f43f5e' },
  { id: 'g2', name: 'Vacation', target: 8000, saved: 2300, deadline: '2027-06-30', icon: '✈️', color: '#3b82f6' },
  { id: 'g3', name: 'New Car', target: 50000, saved: 18000, deadline: '2028-01-31', icon: '🚗', color: '#10b981' },
  { id: 'g4', name: 'Home Renovation', target: 30000, saved: 6200, deadline: '2027-12-31', icon: '🏡', color: '#8b5cf6' },
]

export const PURCHASES: Purchase[] = [
  { id: 'pu1', item: 'Surface Laptop 7', store: 'Sharaf DG', category: 'Electronics', price: 4299, qty: 1, date: '2026-10-15', person: 'Me', status: 'Planned', warrantyMonths: 24, notes: 'Wait for Gitex offer' },
  { id: 'pu2', item: 'Office Chair', store: 'IKEA', category: 'Furniture', price: 780, qty: 2, date: '2026-09-18', person: 'Me', status: 'Delivered', warrantyMonths: 12 },
  { id: 'pu3', item: 'Kitchen Mixer', store: 'Carrefour', category: 'Appliances', price: 349, qty: 1, date: '2026-09-24', person: 'Family', status: 'Ordered', warrantyMonths: 12 },
  { id: 'pu4', item: 'School Bags', store: 'Lulu Hypermarket', category: 'Kids', price: 120, qty: 3, date: '2026-09-06', person: 'Family', status: 'Delivered' },
  { id: 'pu5', item: 'Car Tyres (Set)', store: 'ZDegree', category: 'Automotive', price: 1650, qty: 1, date: '2026-10-02', person: 'Me', status: 'Planned', warrantyMonths: 36 },
  { id: 'pu6', item: 'Air Fryer', store: 'Amazon.ae', category: 'Appliances', price: 289, qty: 1, date: '2026-09-11', person: 'Family', status: 'Returned', notes: 'Faulty unit — refund received' },
  { id: 'pu7', item: 'Restaurant Freezer', store: 'Al Baraka Trading', category: 'Business', price: 3200, qty: 1, date: '2026-09-29', person: 'Me', status: 'Ordered', warrantyMonths: 12 },
]

export const PRICE_WATCH: PriceWatch[] = [
  { id: 'pw1', item: 'Surface Laptop 7', store: 'Sharaf DG', current: 4299, previous: 4599, target: 3999, updated: '2026-09-08' },
  { id: 'pw2', item: 'iPhone 17 Pro', store: 'Emax', current: 4899, previous: 4899, target: 4500, updated: '2026-09-07' },
  { id: 'pw3', item: 'Basmati Rice 10kg', store: 'Lulu', current: 62, previous: 74, target: 60, updated: '2026-09-09' },
  { id: 'pw4', item: 'Cooking Oil 5L', store: 'Carrefour', current: 41, previous: 38, target: 35, updated: '2026-09-09' },
  { id: 'pw5', item: 'Samsung 55" TV', store: 'Amazon.ae', current: 1799, previous: 2099, target: 1700, updated: '2026-09-05' },
]
