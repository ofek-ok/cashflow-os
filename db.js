// db.js - LocalStorage Database Wrapper & Cash Flow calculation engine

const DB_KEYS = {
  CATEGORIES: 'cf_categories',
  TRANSACTIONS: 'cf_transactions',
  RECURRING: 'cf_recurring',
  STARTING_CASH: 'cf_starting_cash'
};

// Default seed categories with financial buckets (Needs, Wants, Savings)
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

// Default seed recurring items
const DEFAULT_RECURRING = [
  { id: 'rec_salary', name: 'משכורת חודשית', amount: 12500, dayOfMonth: 10, categoryId: 'cat_salary' },
  { id: 'rec_rent', name: 'שכר דירה', amount: -3800, dayOfMonth: 1, categoryId: 'cat_rent' },
  { id: 'rec_netflix', name: 'נטפליקס', amount: -60, dayOfMonth: 5, categoryId: 'cat_entertainment' },
  { id: 'rec_gym', name: 'מנוי כושר', amount: -150, dayOfMonth: 8, categoryId: 'cat_health' },
  { id: 'rec_internet', name: 'אינטרנט וספק', amount: -110, dayOfMonth: 15, categoryId: 'cat_utilities' },
  { id: 'rec_savings', name: 'הוראה לקרן השתלמות', amount: -1000, dayOfMonth: 1, categoryId: 'cat_savings' }
];

// Default seed transactions
function getSeedTransactions() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  
  // Set some historical transactions in the previous month (May) to populate it automatically
  let prevYear = year;
  let prevMonth = now.getMonth(); // previous month (0-11)
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear--;
  }
  const prevMonthStr = String(prevMonth).padStart(2, '0');

  return [
    // Current Month (June) Transactions
    {
      id: 'tx_1',
      amount: 12500,
      date: `${year}-${month}-10`,
      type: 'income',
      categoryId: 'cat_salary',
      note: 'משכורת נכנסה'
    },
    {
      id: 'tx_2',
      amount: -3800,
      date: `${year}-${month}-01`,
      type: 'expense',
      categoryId: 'cat_rent',
      note: 'שכירות יוני'
    },
    {
      id: 'tx_savings_1',
      amount: -1000,
      date: `${year}-${month}-01`,
      type: 'expense',
      categoryId: 'cat_savings',
      note: 'הפקדה לחיסכון'
    },
    {
      id: 'tx_3',
      amount: -450,
      date: `${year}-${month}-02`,
      type: 'expense',
      categoryId: 'cat_food',
      note: 'קנייה גדולה בשופרסל'
    },
    {
      id: 'tx_4',
      amount: -75,
      date: `${year}-${month}-05`,
      type: 'expense',
      categoryId: 'cat_transport',
      note: 'תדלוק בתחנת דלק'
    },
    {
      id: 'tx_5',
      amount: -120,
      date: `${year}-${month}-12`,
      type: 'expense',
      categoryId: 'cat_shopping',
      note: 'חולצה חדשה'
    },
    {
      id: 'tx_6',
      amount: -180,
      date: `${year}-${month}-15`,
      type: 'expense',
      categoryId: 'cat_food',
      note: 'מסעדה עם חברים'
    },
    
    // Previous Month (May) Transactions
    {
      id: 'tx_prev_1',
      amount: 12500,
      date: `${prevYear}-${prevMonthStr}-10`,
      type: 'income',
      categoryId: 'cat_salary',
      note: 'משכורת נכנסה מאי'
    },
    {
      id: 'tx_prev_2',
      amount: -3800,
      date: `${prevYear}-${prevMonthStr}-01`,
      type: 'expense',
      categoryId: 'cat_rent',
      note: 'שכירות מאי'
    },
    {
      id: 'tx_prev_3',
      amount: -800,
      date: `${prevYear}-${prevMonthStr}-12`,
      type: 'expense',
      categoryId: 'cat_shopping',
      note: 'קניות בגדים'
    },
    {
      id: 'tx_prev_4',
      amount: -600,
      date: `${prevYear}-${prevMonthStr}-18`,
      type: 'expense',
      categoryId: 'cat_food',
      note: 'סופרסל מאי'
    },
    {
      id: 'tx_prev_5',
      amount: -1000,
      date: `${prevYear}-${prevMonthStr}-01`,
      type: 'expense',
      categoryId: 'cat_savings',
      note: 'הוראה לחיסכון מאי'
    }
  ];
}

export const db = {
  // Initialize Database
  init() {
    if (!localStorage.getItem(DB_KEYS.CATEGORIES)) {
      localStorage.setItem(DB_KEYS.CATEGORIES, JSON.stringify(DEFAULT_CATEGORIES));
    }
    if (!localStorage.getItem(DB_KEYS.RECURRING)) {
      localStorage.setItem(DB_KEYS.RECURRING, JSON.stringify(DEFAULT_RECURRING));
    }
    if (!localStorage.getItem(DB_KEYS.TRANSACTIONS)) {
      localStorage.setItem(DB_KEYS.TRANSACTIONS, JSON.stringify(getSeedTransactions()));
    }
    
    // Seed starting cash for the previous month (May)
    const now = new Date();
    let prevYear = now.getFullYear();
    let prevMonth = now.getMonth();
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear--;
    }
    const prevMonthStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
    const currMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    if (!localStorage.getItem(`${DB_KEYS.STARTING_CASH}_${prevMonthStr}`)) {
      localStorage.setItem(`${DB_KEYS.STARTING_CASH}_${prevMonthStr}`, '4000'); // May starting cash
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
      return 4500; // Base default
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

    // Ending Balance of prev month = Starting cash of prev month + net of prev month's transactions
    const prevStarting = this.getStartingCashForMonthRecursive(prevMonthStr, depth + 1);
    
    // Filter manual transactions for prev month
    const txs = this.getTransactions().filter(t => t.date.startsWith(prevMonthStr));
    const netTx = txs.reduce((sum, t) => sum + t.amount, 0);

    return prevStarting + netTx;
  },

  setStartingCashForMonth(monthStr, amount) {
    localStorage.setItem(`${DB_KEYS.STARTING_CASH}_${monthStr}`, String(amount));
  },

  // Legacy fallback method (interface compatibility)
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

  // --- Core Financial Calculators (Refactored for Monthly Ledger) ---

  /**
   * Computes actual cash balance at the end of the specified month
   * (or up to today's date if it's the current month).
   */
  getCurrentCashForMonth(monthStr) {
    const startingCash = this.getStartingCashForMonth(monthStr);
    const txs = this.getTransactions().filter(t => t.date.startsWith(monthStr));
    
    const now = new Date();
    const currMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    let performedTxs = txs;
    if (monthStr === currMonthStr) {
      // Filter transactions up to today
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
   * Calculates the projected balance at the end of the month.
   */
  getProjectedBalanceForMonth(monthStr) {
    const currentCash = this.getCurrentCashForMonth(monthStr);
    
    const now = new Date();
    const currMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    // Projections are only meaningful for the current month and future months
    if (monthStr < currMonthStr) {
      // For past months, ending projected balance = ending actual balance
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
      // Sum recurring items scheduled after "todayDom"
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
   * Generates a balance projection mapping days of the targeted month.
   */
  get30DayProjectionForMonth(monthStr) {
    const points = [];
    const now = new Date();
    const currMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const parts = monthStr.split('-');
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    
    // Get number of days in this targeted month
    const totalDays = new Date(year, month, 0).getDate();
    
    const startingCash = this.getStartingCashForMonth(monthStr);
    const txs = this.getTransactions().filter(t => t.date.startsWith(monthStr));
    const recurring = this.getRecurring();
    
    let runningBalance = startingCash;

    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      
      // Calculate changes on this day
      // 1. Manual actual transactions
      const dayTxs = txs.filter(t => t.date === dateStr);
      const dayTxsNet = dayTxs.reduce((sum, t) => sum + t.amount, 0);
      
      runningBalance += dayTxsNet;

      // 2. Future recurring transactions (only added for current/future dates)
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
   * Returns category limits vs actual spending for the specified month.
   */
  getBudgetVsActualForMonth(monthStr, includeRecurring = true) {
    const categories = this.getCategories();
    const txs = this.getTransactions();
    const recurring = this.getRecurring();
    
    const parts = monthStr.split('-');
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    
    const startOfMonthStr = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endOfMonthStr = new Date(year, month, 0).toISOString().split('T')[0];

    return categories.map(cat => {
      // 1. Performed manual transactions this month
      const catTxs = txs.filter(t => 
        t.categoryId === cat.id && 
        t.date.startsWith(monthStr) &&
        t.type === 'expense'
      );
      const actualSpent = Math.abs(catTxs.reduce((sum, t) => sum + t.amount, 0));

      // 2. Recurring items (if applicable)
      let recurringSpent = 0;
      if (includeRecurring) {
        const catRecur = recurring.filter(r => r.categoryId === cat.id && r.amount < 0);
        recurringSpent = Math.abs(catRecur.reduce((sum, r) => sum + r.amount, 0));
      }

      const totalSpent = actualSpent + recurringSpent;

      return {
        id: cat.id,
        name: cat.name,
        icon: cat.icon,
        limit: cat.limit,
        actual: totalSpent,
        isOver: cat.limit > 0 && totalSpent > cat.limit,
        percentage: cat.limit > 0 ? Math.round((totalSpent / cat.limit) * 100) : 0
      };
    });
  },

  getBudgetVsActual(includeRecurring = true) {
    const now = new Date();
    const currMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return this.getBudgetVsActualForMonth(currMonthStr, includeRecurring);
  },

  /**
   * Calculates total spending grouped by financial buckets for the specified month.
   */
  getExpenseDistributionForMonth(monthStr, includeRecurring = true) {
    const categories = this.getCategories();
    const txs = this.getTransactions();
    const recurring = this.getRecurring();

    // Initialize buckets
    const distribution = {
      needs: 0,
      wants: 0,
      savings: 0
    };

    // Create category bucket lookup
    const catBuckets = {};
    categories.forEach(c => {
      catBuckets[c.id] = c.bucket || 'wants';
    });

    // 1. Process manual transactions
    const monthTxs = txs.filter(t => t.date.startsWith(monthStr) && t.type === 'expense');
    monthTxs.forEach(t => {
      const bucket = catBuckets[t.categoryId];
      if (bucket && distribution[bucket] !== undefined) {
        distribution[bucket] += Math.abs(t.amount);
      }
    });

    // 2. Process recurring expenses
    if (includeRecurring) {
      recurring.forEach(item => {
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
    const currMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return this.getExpenseDistributionForMonth(currMonthStr, includeRecurring);
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

  /**
   * Returns monthly summary for the targeted month
   */
  getMonthlySummaryForMonth(monthStr, includeRecurring = true) {
    const txs = this.getTransactions();
    const recurring = this.getRecurring();

    const monthTxs = txs.filter(t => t.date.startsWith(monthStr));
    let totalIncome = monthTxs.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    let totalExpense = Math.abs(monthTxs.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0));

    if (includeRecurring) {
      recurring.forEach(item => {
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
    const currMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return this.getMonthlySummaryForMonth(currMonthStr, includeRecurring);
  },

  // Reset database
  resetAll() {
    localStorage.removeItem(DB_KEYS.CATEGORIES);
    localStorage.removeItem(DB_KEYS.TRANSACTIONS);
    localStorage.removeItem(DB_KEYS.RECURRING);
    
    // Clear starting cash keys
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(DB_KEYS.STARTING_CASH)) {
        localStorage.removeItem(key);
      }
    });

    this.init();
  }
};
