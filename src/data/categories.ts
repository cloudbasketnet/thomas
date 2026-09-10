import type { CategoryKind } from '@/types'

/**
 * A starter set of categories and sub-categories.
 *
 * Nothing here is written automatically — a new account begins with an empty
 * list. Settings → Categories offers this as a one-click starting point, after
 * which every name, icon and colour is yours to edit or delete.
 */
export interface DefaultCategory {
  name: string
  kind: CategoryKind
  icon: string
  color: string
  subs: string[]
}

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  // ------------------------------------------------------------- expense ---
  {
    name: 'Groceries', kind: 'expense', icon: '🛒', color: '#10b981',
    subs: ['Rice & Grains', 'Vegetables', 'Fruit', 'Meat & Poultry', 'Fish', 'Dairy & Eggs', 'Bakery', 'Cooking Oil', 'Spices', 'Snacks', 'Beverages', 'Frozen Food'],
  },
  {
    name: 'Home / Rent', kind: 'expense', icon: '🏠', color: '#3b82f6',
    subs: ['Rent', 'Mortgage', 'Maintenance', 'Furniture', 'Cleaning', 'Home Insurance'],
  },
  {
    name: 'Utilities', kind: 'expense', icon: '💡', color: '#06b6d4',
    subs: ['Electricity', 'Water', 'Gas', 'Internet', 'Mobile', 'Waste Collection'],
  },
  {
    name: 'Transport', kind: 'expense', icon: '🚗', color: '#f59e0b',
    subs: ['Fuel', 'Salik / Toll', 'Parking', 'Taxi', 'Public Transport', 'Servicing', 'Car Insurance', 'Registration'],
  },
  {
    name: 'Health', kind: 'expense', icon: '➕', color: '#ef4444',
    subs: ['Pharmacy', 'Doctor', 'Dentist', 'Optician', 'Health Insurance', 'Lab Tests'],
  },
  {
    name: 'Restaurants', kind: 'expense', icon: '🍽️', color: '#ec4899',
    subs: ['Dine In', 'Takeaway', 'Delivery', 'Coffee', 'Fast Food'],
  },
  {
    name: 'Shopping', kind: 'expense', icon: '🛍️', color: '#eab308',
    subs: ['Clothing', 'Footwear', 'Electronics', 'Appliances', 'Accessories', 'Gifts'],
  },
  {
    name: 'Family Support', kind: 'expense', icon: '👨‍👩‍👦', color: '#8b5cf6',
    subs: ['Family Transfer', 'School Fees', 'Childcare', 'Elder Care', 'Charity'],
  },
  {
    name: 'Personal', kind: 'expense', icon: '👤', color: '#a855f7',
    subs: ['Grooming', 'Gym', 'Hobbies', 'Books', 'Courses'],
  },
  {
    name: 'Subscriptions', kind: 'expense', icon: '📺', color: '#14b8a6',
    subs: ['Streaming', 'Music', 'Software', 'Cloud Storage', 'News'],
  },
  {
    name: 'Education', kind: 'expense', icon: '🎓', color: '#0ea5e9',
    subs: ['Tuition', 'Books & Supplies', 'Exam Fees', 'Transport'],
  },
  {
    name: 'Loan Payment', kind: 'expense', icon: '🏦', color: '#64748b',
    subs: ['Personal Loan', 'Car Loan', 'Credit Card', 'Mortgage'],
  },
  {
    name: 'Business', kind: 'expense', icon: '💼', color: '#475569',
    subs: ['Supplies', 'Equipment', 'Marketing', 'Licence & Fees', 'Staff'],
  },
  {
    name: 'Other', kind: 'expense', icon: '📦', color: '#94a3b8',
    subs: ['Uncategorised', 'Fees', 'Fines'],
  },

  // -------------------------------------------------------------- income ---
  {
    name: 'Salary', kind: 'income', icon: '💰', color: '#22c55e',
    subs: ['Basic Pay', 'Overtime', 'Bonus', 'Allowance'],
  },
  {
    name: 'Business Income', kind: 'income', icon: '🏪', color: '#10b981',
    subs: ['Restaurant Sales', 'Online Orders', 'Catering', 'Wholesale'],
  },
  {
    name: 'Investment', kind: 'income', icon: '📈', color: '#3b82f6',
    subs: ['Dividends', 'Interest', 'Rental Income', 'Capital Gains'],
  },
  {
    name: 'Other Income', kind: 'income', icon: '✨', color: '#8b5cf6',
    subs: ['Refund', 'Gift', 'Cashback', 'Sale of Goods'],
  },
]
