// db.js - LocalStorage Database Wrapper & Cash Flow calculation engine

const DB_KEYS = {
  CATEGORIES: 'cf_categories',
  TRANSACTIONS: 'cf_transactions',
  RECURRING: 'cf_recurring',
  STARTING_CASH: 'cf_starting_cash'
};

// Default categories with financial buckets (Needs, Wants, Savings)
const DEFAULT_CATEGORIES = [
  { id: 'cat_salary', name: 'משכורת', icon: '💰', limit: 0, bucket: 'income' },
  { id: 'cat_rent', name: 'דיור ומשכנתא', icon: '🏠', limit: 4000, bucket: 'needs' },
  { id: 'cat_food', name: 'מזון וסופר', icon: '🛒', limit: 2000, bucket: 'needs' },
  { id: 'cat_transport', name: 'תחבורה ורכב', icon: '🚗', limit: 600, bucket: 'needs' },
  { id: 'cat_utilities', name: 'חשבונות ותקשורת', icon: '⚡', limit: 1200, bucket: 'needs' },
  { id: 'cat_shopping', name: 'קניות וביגוד', icon: '🛍️', limit: 1000, bucket: 'wants' },
  { id: 'cat_entertainment', name: 'בילויים ופנאי', icon: '🎬', limit: 800, bucket: 'wants' },
  { id: 'cat_health', name: 'בריאות וספורט', icon: '💪', limit: 400, bucket: 'needs' },
  { id: 'cat_savings', name: 'חיסכון והשקעות', icon: '📈', limit: 3000, bucket: 'savings' },
  { id: 'cat_general', name: 'כללי', icon: '🏷️', limit: 1000, bucket: 'wants' }
];

export const db = {
  // Initialize Database (Empty system for user data entry)
  init() {
    if (!localStorage.getItem(DB_KEYS.CATEGORIES)) {
      localStorage.setItem(DB_KEYS.CATEGORIES, JSON.stringify(DEFAULT_CATEGORIES));
    }
    if (!localStorage.getItem(DB_KEYS.RECURRING)) {
      localStorage.setItem(DB_KEYS.RECURRING, JSON.stringify([])); // Empty default recurring list
    }
    if (!localStorage.getItem(DB_KEYS.TRANSACTIONS)) {
      localStorage.setItem(DB_KEYS.TRANSACTIONS, JSON.stringify([])); // Empty default transactions list
    }
  },

  // --- Starting Cash (Per Month) ---
  getStartingCashForMonth(monthStr) {
    const key = `${DB_KEYS.STARTING_CASH}_${monthStr}`;
    const val = localStorage.getItem(key);
    if (val !== null) {
      return parseFloat(val) || 0;
    }
    
    // Fallback: inherit starting cash recursively from previous month's final ending balance
    return this.getStartingCashForMonthRecursive(monthStr, 0);
  },

  getStartingCashForMonthRecursive(monthStr, depth) {
    const key = `${DB_KEYS.STARTING_CASH}_${monthStr}`;
    const val = localStorage.getItem(key);
    if (val !== null) {
      return parseFloat(val) || 0;
    }

    // Limit recursion to 12 months
    if (depth > 12) {
      return 0; // Empty system defaults to 0 starting balance
    }

    const parts = monthStr.split('-');
    let year = parseInt(parts[0]);
    let month = parseInt(parts[1]);
    
    month--;
    if (month === 0) {
      month = 12;
      year--;
    }
    const prevMonthStr = `${year}-${String(month).padStart(2, '0')}`;

    const prevStarting = this.getStartingCashForMonthRecursive(prevMonthStr, depth + 1);
    
    // Filter manual transactions for prev month
    const txs = this.getTransactions().filter(t => t.date.startsWith(prevMonthStr));
    const netTx = txs.reduce((sum, t) => sum + t.amount, 0);

    return prevStarting + netTx;
  },

  setStartingCashForMonth(monthStr, amount) {
    localStorage.setItem(`${DB_KEYS.STARTING_CASH}_${monthStr}`, String(amount));
  },

  // Legacy fallback
  getStartingCash() {
    const now = new Date();
    const currMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return this.getStartingCashForMonth(currMonthStr);
  },

  // --- Categories ---
  getCategories() {
    return JSON.parse(localStorage.getItem(DB_KEYS.CATEGORIES)) || [];
  },

  saveCategory(category) {
    const categories = this.getCategories();
    const index = categories.findIndex(c => c.id === category.id);
    if (index > -1) {
      categories[index] = category;
    } else {
      categories.push(category);
    }
    localStorage.setItem(DB_KEYS.CATEGORIES, JSON.stringify(categories));
    return category;
  },

  deleteCategory(id) {
    let categories = this.getCategories();
    categories = categories.filter(c => c.id !== id);
    localStorage.setItem(DB_KEYS.CATEGORIES, JSON.stringify(categories));
  },

  // --- Recurring ---
  getRecurring() {
    return JSON.parse(localStorage.getItem(DB_KEYS.RECURRING)) || [];
  },

  saveRecurring(item) {
    const items = this.getRecurring();
    const index = items.findIndex(i => i.id === item.id);
    if (index > -1) {
      items[index] = item;
    } else {
      items.push(item);
    }
    localStorage.setItem(DB_KEYS.RECURRING, JSON.stringify(items));
    return item;
  },

  deleteRecurring(id) {
    let items = this.getRecurring();
    items = items.filter(i => i.id !== id);
    localStorage.setItem(DB_KEYS.RECURRING, JSON.stringify(items));
  },

  // --- Transactions ---
  getTransactions() {
    const txs = JSON.parse(localStorage.getItem(DB_KEYS.TRANSACTIONS)) || [];
    return txs.sort((a, b) => new Date(b.date) - new Date(a.date));
  },

  saveTransaction(tx) {
    const txs = this.getTransactions();
    const index = txs.findIndex(t => t.id === tx.id);
    if (index > -1) {
      txs[index] = tx;
    } else {
      txs.push(tx);
    }
    localStorage.setItem(DB_KEYS.TRANSACTIONS, JSON.stringify(txs));
    return tx;
  },

  deleteTransaction(id) {
    let txs = this.getTransactions();
    txs = txs.filter(t => t.id !== id);
    localStorage.setItem(DB_KEYS.TRANSACTIONS, JSON.stringify(txs));
  },

  // --- Core Financial Calculators (Range-Based for Intervals) ---

  /**
   * Helper to retrieve all instances of recurring transactions within a specific date range
   */
  getRecurringEventsInRange(startDate, endDate) {
    const events = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const recurring = this.getRecurring();
    
    // Loop month-by-month from start to end
    let current = new Date(start.getFullYear(), start.getMonth(), 1);
    while (current <= end) {
      const year = current.getFullYear();
      const month = current.getMonth() + 1; // 1-12
      
      recurring.forEach(item => {
        const day = Math.min(item.dayOfMonth, new Date(year, month, 0).getDate());
        const eventDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        if (eventDateStr >= startDate && eventDateStr <= endDate) {
          events.push({
            ...item,
            date: eventDateStr
          });
        }
      });
      
      current.setMonth(current.getMonth() + 1);
    }
    return events;
  },

  /**
   * Computes actual cash balance at the end of the specified month
   */
  getCurrentCashForMonth(monthStr) {
    const startingCash = this.getStartingCashForMonth(monthStr);
    const txs = this.getTransactions().filter(t => t.date.startsWith(monthStr));
    
    const now = new Date();
    const currMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    let performedTxs = txs;
    if (monthStr === currMonthStr) {
      const todayStr = now.toISOString().split('T')[0];
      performedTxs = txs.filter(t => t.date <= todayStr);
    }
    
    const netTxAmount = performedTxs.reduce((sum, t) => sum + t.amount, 0);
    return startingCash + netTxAmount;
  },

  getCurrentCash() {
    const now = new Date();
    const currMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return this.getCurrentCashForMonth(currMonthStr);
  },

  /**
   * Calculates the projected balance at the end of the month
   */
  getProjectedBalanceForMonth(monthStr) {
    const currentCash = this.getCurrentCashForMonth(monthStr);
    const now = new Date();
    const currMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    if (monthStr < currMonthStr) {
      const txs = this.getTransactions().filter(t => t.date.startsWith(monthStr));
      const startingCash = this.getStartingCashForMonth(monthStr);
      return startingCash + txs.reduce((sum, t) => sum + t.amount, 0);
    }

    const recurring = this.getRecurring();
    const todayDom = monthStr === currMonthStr ? now.getDate() : 0;
    
    const year = parseInt(monthStr.split('-')[0]);
    const month = parseInt(monthStr.split('-')[1]);
    const lastDayOfMonth = new Date(year, month, 0).getDate();

    let recurringNet = 0;
    recurring.forEach(item => {
      if (item.dayOfMonth > todayDom && item.dayOfMonth <= lastDayOfMonth) {
        recurringNet += item.amount;
      }
    });

    return currentCash + recurringNet;
  },

  getProjectedBalance() {
    const now = new Date();
    const currMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return this.getProjectedBalanceForMonth(currMonthStr);
  },

  /**
   * Generates a daily balance timeline for the month
   */
  get30DayProjectionForMonth(monthStr) {
    const points = [];
    const now = new Date();
    const currMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const parts = monthStr.split('-');
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    
    const totalDays = new Date(year, month, 0).getDate();
    const startingCash = this.getStartingCashForMonth(monthStr);
    const txs = this.getTransactions().filter(t => t.date.startsWith(monthStr));
    const recurring = this.getRecurring();
    
    let runningBalance = startingCash;

    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      
      const dayTxs = txs.filter(t => t.date === dateStr);
      const dayTxsNet = dayTxs.reduce((sum, t) => sum + t.amount, 0);
      runningBalance += dayTxsNet;

      const isFuture = monthStr > currMonthStr || (monthStr === currMonthStr && d > now.getDate());
      if (isFuture) {
        const dayRecurring = recurring.filter(r => r.dayOfMonth === d);
        const dayRecurringNet = dayRecurring.reduce((sum, r) => sum + r.amount, 0);
        runningBalance += dayRecurringNet;
      }

      points.push({
        dayIndex: d - 1,
        date: dateStr,
        displayDate: `${d}/${month}`,
        balance: runningBalance
      });
    }

    return points;
  },

  get30DayProjection() {
    const now = new Date();
    const currMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return this.get30DayProjectionForMonth(currMonthStr);
  },

  /**
   * Calculates financial performance totals within a custom date range
   */
  getMonthlySummaryForRange(startDate, endDate, includeRecurring = true) {
    const txs = this.getTransactions();
    
    // Filter manual transactions in range
    const rangeTxs = txs.filter(t => t.date >= startDate && t.date <= endDate);
    let totalIncome = rangeTxs.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    let totalExpense = Math.abs(rangeTxs.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0));

    // Process recurring items in range
    if (includeRecurring) {
      const rangeRecurring = this.getRecurringEventsInRange(startDate, endDate);
      rangeRecurring.forEach(item => {
        if (item.amount > 0) {
          totalIncome += item.amount;
        } else {
          totalExpense += Math.abs(item.amount);
        }
      });
    }

    return {
      income: totalIncome,
      expense: totalExpense,
      net: totalIncome - totalExpense
    };
  },

  getMonthlySummary(includeRecurring = true) {
    const now = new Date();
    const startStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const endStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return this.getMonthlySummaryForRange(startStr, endStr, includeRecurring);
  },

  /**
   * Returns spending metrics grouped by category buckets within a custom date range
   */
  getExpenseDistributionForRange(startDate, endDate, includeRecurring = true) {
    const categories = this.getCategories();
    const txs = this.getTransactions();

    const distribution = {
      needs: 0,
      wants: 0,
      savings: 0
    };

    const catBuckets = {};
    categories.forEach(c => {
      catBuckets[c.id] = c.bucket || 'wants';
    });

    // 1. Process manual transactions
    const rangeTxs = txs.filter(t => t.date >= startDate && t.date <= endDate && t.type === 'expense');
    rangeTxs.forEach(t => {
      const bucket = catBuckets[t.categoryId];
      if (bucket && distribution[bucket] !== undefined) {
        distribution[bucket] += Math.abs(t.amount);
      }
    });

    // 2. Process recurring transactions in range
    if (includeRecurring) {
      const rangeRecurring = this.getRecurringEventsInRange(startDate, endDate);
      rangeRecurring.forEach(item => {
        if (item.amount < 0) {
          const bucket = catBuckets[item.categoryId];
          if (bucket && distribution[bucket] !== undefined) {
            distribution[bucket] += Math.abs(item.amount);
          }
        }
      });
    }

    const total = distribution.needs + distribution.wants + distribution.savings;

    return {
      needs: distribution.needs,
      wants: distribution.wants,
      savings: distribution.savings,
      total,
      percentages: {
        needs: total > 0 ? Math.round((distribution.needs / total) * 100) : 0,
        wants: total > 0 ? Math.round((distribution.wants / total) * 100) : 0,
        savings: total > 0 ? Math.round((distribution.savings / total) * 100) : 0
      }
    };
  },

  getExpenseDistribution(includeRecurring = true) {
    const now = new Date();
    const startStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const endStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return this.getExpenseDistributionForRange(startStr, endStr, includeRecurring);
  },

  /**
   * Returns category limits vs actual spending within a custom date range
   */
  getBudgetVsActualForRange(startDate, endDate, includeRecurring = true) {
    const categories = this.getCategories();
    const txs = this.getTransactions();
    
    // Calculate range scaling factor relative to a 30-day month
    const d1 = new Date(startDate);
    const d2 = new Date(endDate);
    const diffTime = Math.abs(d2 - d1);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    const scaleFactor = diffDays / 30;

    return categories.map(cat => {
      // 1. Performed manual transactions in range
      const catTxs = txs.filter(t => 
        t.categoryId === cat.id && 
        t.date >= startDate && 
        t.date <= endDate &&
        t.type === 'expense'
      );
      const actualSpent = Math.abs(catTxs.reduce((sum, t) => sum + t.amount, 0));

      // 2. Recurring items in range
      let recurringSpent = 0;
      if (includeRecurring) {
        const rangeRecurring = this.getRecurringEventsInRange(startDate, endDate);
        const catRecur = rangeRecurring.filter(r => r.categoryId === cat.id && r.amount < 0);
        recurringSpent = Math.abs(catRecur.reduce((sum, r) => sum + r.amount, 0));
      }

      const totalSpent = actualSpent + recurringSpent;
      const scaledLimit = Math.round(cat.limit * scaleFactor);

      return {
        id: cat.id,
        name: cat.name,
        icon: cat.icon,
        limit: scaledLimit,
        actual: totalSpent,
        isOver: scaledLimit > 0 && totalSpent > scaledLimit,
        percentage: scaledLimit > 0 ? Math.round((totalSpent / scaledLimit) * 100) : 0
      };
    });
  },

  getBudgetVsActual(includeRecurring = true) {
    const now = new Date();
    const startStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const endStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return this.getBudgetVsActualForRange(startStr, endStr, includeRecurring);
  },

  /**
   * Retrieves the 3 upcoming recurring transactions
   */
  getUpcomingRecurring(limit = 3) {
    const recurring = this.getRecurring();
    const now = new Date();
    const todayDom = now.getDate();
    const currentMonthDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    const mapped = recurring.map(item => {
      let daysRemaining = item.dayOfMonth - todayDom;
      if (daysRemaining < 0) {
        daysRemaining += currentMonthDays;
      }
      return {
        ...item,
        daysRemaining
      };
    });

    return mapped.sort((a, b) => a.daysRemaining - b.daysRemaining).slice(0, limit);
  },

  // Reset database to default empty state
  resetAll() {
    localStorage.removeItem(DB_KEYS.CATEGORIES);
    localStorage.removeItem(DB_KEYS.TRANSACTIONS);
    localStorage.removeItem(DB_KEYS.RECURRING);
    
    // Clear all starting cash keys
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(DB_KEYS.STARTING_CASH)) {
        localStorage.removeItem(key);
      }
    });

    this.init();
  }
};
