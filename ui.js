// ui.js - CashFlow OS UI Renderer & Interaction Handlers

import { db } from './db.js';
import { exporter } from './export.js';

// Application State
const state = {
  activeTab: 'timeline', // 'timeline' | 'action' (numpad) | 'reports' | 'settings'
  selectedMonth: (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  })(),
  numpad: {
    editId: null, // Holds transaction ID if editing, else null
    amount: '0',
    type: 'expense', // 'expense' | 'income'
    categoryId: 'cat_general',
    note: '',
    date: new Date().toISOString().split('T')[0] // Default to today
  },
  settings: {
    includeRecurring: true // Fixed to true as Focus view toggle was removed
  }
};

// Helper to shift YYYY-MM by delta months
const changeMonth = (monthStr, delta) => {
  const parts = monthStr.split('-');
  const year = parseInt(parts[0]);
  const month = parseInt(parts[1]) - 1; // 0-indexed
  const dateObj = new Date(year, month + delta, 1);
  return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
};

// Helper to format YYYY-MM into Hebrew month name
const getHebrewMonthLabel = (monthStr) => {
  const parts = monthStr.split('-');
  const year = parts[0];
  const monthIdx = parseInt(parts[1]) - 1;
  const monthsHebrew = [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
  ];
  return `${monthsHebrew[monthIdx]} ${year}`;
};

export const ui = {
  init() {
    this.setupEventListeners();
    this.renderAll();
  },

  // --- Tab Navigation & Screen Routing ---
  switchTab(tabId) {
    if (tabId === 'action') {
      this.openNumpad();
      return;
    }

    state.activeTab = tabId;
    
    // Update active tab in navigation
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.tab === tabId);
    });

    // Update screen visibility
    document.getElementById('screen-timeline').classList.toggle('hidden', tabId !== 'timeline');
    document.getElementById('screen-reports').classList.toggle('hidden', tabId !== 'reports');
    document.getElementById('screen-settings').classList.toggle('hidden', tabId !== 'settings');

    this.renderAll();
  },

  // --- Event Listeners Setup ---
  setupEventListeners() {
    // Navigation items
    document.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', () => {
        this.switchTab(el.dataset.tab);
      });
    });

    // Month Switcher Buttons
    const prevMonthBtn = document.getElementById('btn-prev-month');
    if (prevMonthBtn) {
      prevMonthBtn.addEventListener('click', () => {
        state.selectedMonth = changeMonth(state.selectedMonth, -1);
        this.renderAll();
      });
    }

    const nextMonthBtn = document.getElementById('btn-next-month');
    if (nextMonthBtn) {
      nextMonthBtn.addEventListener('click', () => {
        state.selectedMonth = changeMonth(state.selectedMonth, 1);
        this.renderAll();
      });
    }

    // Numpad toggle (Income/Expense)
    document.querySelectorAll('#numpad-type-toggle .type-pill').forEach(el => {
      el.addEventListener('click', (e) => {
        document.querySelectorAll('#numpad-type-toggle .type-pill').forEach(p => p.classList.remove('active'));
        el.classList.add('active');
        state.numpad.type = el.dataset.type;
        
        // Auto switch category to Salary if Income, or General if Expense
        if (state.numpad.type === 'income') {
          state.numpad.categoryId = 'cat_salary';
        } else {
          state.numpad.categoryId = 'cat_general';
        }
        this.renderNumpadCategoryPicker();
      });
    });

    // Numpad Date Picker buttons
    const btnToday = document.getElementById('btn-date-today');
    const btnYesterday = document.getElementById('btn-date-yesterday');
    const customDateInput = document.getElementById('numpad-custom-date');

    const updateDateButtons = (selectedDate) => {
      const todayStr = new Date().toISOString().split('T')[0];
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      btnToday.classList.toggle('active', selectedDate === todayStr);
      btnYesterday.classList.toggle('active', selectedDate === yesterdayStr);

      btnToday.style.background = selectedDate === todayStr ? 'var(--primary)' : 'rgba(255,255,255,0.02)';
      btnToday.style.color = selectedDate === todayStr ? 'white' : 'var(--text-secondary)';
      btnYesterday.style.background = selectedDate === yesterdayStr ? 'var(--primary)' : 'rgba(255,255,255,0.02)';
      btnYesterday.style.color = selectedDate === yesterdayStr ? 'white' : 'var(--text-secondary)';

      customDateInput.value = selectedDate;
    };

    if (btnToday) {
      btnToday.addEventListener('click', () => {
        const todayStr = new Date().toISOString().split('T')[0];
        state.numpad.date = todayStr;
        updateDateButtons(todayStr);
      });
    }

    if (btnYesterday) {
      btnYesterday.addEventListener('click', () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        state.numpad.date = yesterdayStr;
        updateDateButtons(yesterdayStr);
      });
    }

    if (customDateInput) {
      customDateInput.addEventListener('change', (e) => {
        if (e.target.value) {
          state.numpad.date = e.target.value;
          updateDateButtons(e.target.value);
        }
      });
    }

    // Numpad Close Button
    document.getElementById('numpad-close').addEventListener('click', () => {
      this.closeNumpad();
    });

    // Numpad Keyboard Keys
    document.querySelectorAll('.keyboard-grid .key').forEach(key => {
      key.addEventListener('click', () => {
        const val = key.dataset.value;
        this.handleNumpadKeyPress(val);
      });
    });

    // Save starting cash (bound to selected month)
    const startingCashInput = document.getElementById('setting-starting-cash');
    if (startingCashInput) {
      startingCashInput.addEventListener('change', (e) => {
        const amt = parseFloat(e.target.value) || 0;
        db.setStartingCashForMonth(state.selectedMonth, amt);
        this.renderAll();
        this.showToast(`יתרת הפתיחה לחודש ${getHebrewMonthLabel(state.selectedMonth)} עודכנה`);
      });
    }

    // Export CSV Button
    const exportBtn = document.getElementById('btn-export-csv');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        exporter.exportTransactionsToCSV();
        this.showToast('קובץ הנתונים יוצא בהצלחה');
      });
    }

    // Import CSV Input
    const importInput = document.getElementById('csv-import-file');
    if (importInput) {
      importInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        exporter.importTransactionsFromCSV(file, (err, count) => {
          if (err) {
            this.showToast('שגיאה בייבוא הקובץ. אנא ודא שהפורמט תקין.', true);
          } else {
            this.showToast(`ייבוא הושלם! ${count} עסקאות נוספו.`);
            this.renderAll();
          }
          importInput.value = ''; // Reset input
        });
      });
    }

    // Reset Data Button
    const resetBtn = document.getElementById('btn-reset-data');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('האם אתה בטוח שברצונך לאפס את כל הנתונים? פעולה זו תמחק את כל העסקאות וההגדרות שהזנת ותחזיר את נתוני המדגם.')) {
          db.resetAll();
          const startingCashInput = document.getElementById('setting-starting-cash');
          if (startingCashInput) {
            startingCashInput.value = db.getStartingCashForMonth(state.selectedMonth);
          }
          this.renderAll();
          this.showToast('הנתונים אופסו בהצלחה');
        }
      });
    }

    // Manage Recurring Modal Triggers
    const addRecurringBtn = document.getElementById('btn-add-recurring');
    if (addRecurringBtn) {
      addRecurringBtn.addEventListener('click', () => {
        this.openRecurringModal();
      });
    }

    const modalClose = document.getElementById('recurring-modal-close');
    if (modalClose) {
      modalClose.addEventListener('click', () => {
        this.closeRecurringModal();
      });
    }

    const recurringForm = document.getElementById('recurring-form');
    if (recurringForm) {
      recurringForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSaveRecurring();
      });
    }

    // Manage Category Modal Triggers
    const addCategoryBtn = document.getElementById('btn-add-category');
    if (addCategoryBtn) {
      addCategoryBtn.addEventListener('click', () => {
        this.openCategoryModal();
      });
    }

    const catModalClose = document.getElementById('category-modal-close');
    if (catModalClose) {
      catModalClose.addEventListener('click', () => {
        this.closeCategoryModal();
      });
    }

    const categoryForm = document.getElementById('category-form');
    if (categoryForm) {
      categoryForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSaveCategory();
      });
    }
  },

  // --- Numpad Interaction Engine ---
  openNumpad(editTx = null) {
    const titleEl = document.getElementById('numpad-title');
    const noteInput = document.getElementById('numpad-note');
    const todayStr = new Date().toISOString().split('T')[0];

    if (editTx) {
      state.numpad.editId = editTx.id;
      state.numpad.amount = Math.abs(editTx.amount).toString();
      state.numpad.type = editTx.type;
      state.numpad.categoryId = editTx.categoryId;
      state.numpad.note = editTx.note;
      state.numpad.date = editTx.date;
      
      if (titleEl) titleEl.innerText = 'עריכת תנועה פיננסית';
    } else {
      state.numpad.editId = null;
      state.numpad.amount = '0';
      state.numpad.type = 'expense';
      state.numpad.categoryId = 'cat_general';
      state.numpad.note = '';
      
      // Default to selected month's first day if it is a past month, else default to today
      const now = new Date();
      const currMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      if (state.selectedMonth === currMonthStr) {
        state.numpad.date = todayStr;
      } else {
        state.numpad.date = `${state.selectedMonth}-01`;
      }

      if (titleEl) titleEl.innerText = 'הזנת תנועה מהירה';
    }

    // Update screen elements
    if (noteInput) noteInput.value = state.numpad.note;
    
    // Toggle active type pill
    document.querySelectorAll('#numpad-type-toggle .type-pill').forEach(p => {
      p.classList.toggle('active', p.dataset.type === state.numpad.type);
    });

    // Update date buttons visual state
    const btnToday = document.getElementById('btn-date-today');
    const btnYesterday = document.getElementById('btn-date-yesterday');
    const customDateInput = document.getElementById('numpad-custom-date');
    if (btnToday && btnYesterday && customDateInput) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      btnToday.classList.toggle('active', state.numpad.date === todayStr);
      btnYesterday.classList.toggle('active', state.numpad.date === yesterdayStr);
      
      btnToday.style.background = state.numpad.date === todayStr ? 'var(--primary)' : 'rgba(255,255,255,0.02)';
      btnToday.style.color = state.numpad.date === todayStr ? 'white' : 'var(--text-secondary)';
      btnYesterday.style.background = state.numpad.date === yesterdayStr ? 'var(--primary)' : 'rgba(255,255,255,0.02)';
      btnYesterday.style.color = state.numpad.date === yesterdayStr ? 'white' : 'var(--text-secondary)';
      
      customDateInput.value = state.numpad.date;
    }

    this.renderNumpadAmount();
    this.renderNumpadCategoryPicker();

    // Show Overlay
    const overlay = document.getElementById('numpad-overlay');
    overlay.classList.remove('hidden');
    setTimeout(() => overlay.classList.add('open'), 10);
  },

  closeNumpad() {
    const overlay = document.getElementById('numpad-overlay');
    overlay.classList.remove('open');
    setTimeout(() => overlay.classList.add('hidden'), 300);
  },

  handleNumpadKeyPress(val) {
    let current = state.numpad.amount;

    if (val === 'backspace') {
      if (current.length > 1) {
        current = current.slice(0, -1);
      } else {
        current = '0';
      }
    } else if (val === '.') {
      if (!current.includes('.')) {
        current += '.';
      }
    } else {
      // Numbers
      if (current === '0') {
        current = val;
      } else {
        // Prevent typing too large number
        if (current.replace('.', '').length < 8) {
          current += val;
        }
      }
    }

    state.numpad.amount = current;
    this.renderNumpadAmount();
  },

  renderNumpadAmount() {
    document.getElementById('numpad-amount-text').innerText = state.numpad.amount;
  },

  renderNumpadCategoryPicker() {
    const picker = document.getElementById('numpad-category-picker');
    picker.innerHTML = '';

    const categories = db.getCategories();
    
    // Filter categories based on transaction type to keep UI clean
    const filteredCategories = categories.filter(c => {
      if (state.numpad.type === 'income') {
        return c.id === 'cat_salary' || c.id === 'cat_general' || c.limit === 0;
      } else {
        return c.id !== 'cat_salary'; // Hide salary for expenses
      }
    });

    // Make sure current active category is valid for the list
    if (!filteredCategories.find(c => c.id === state.numpad.categoryId)) {
      state.numpad.categoryId = filteredCategories[0]?.id || 'cat_general';
    }

    filteredCategories.forEach(cat => {
      const pill = document.createElement('div');
      pill.className = `category-pill-select ${state.numpad.categoryId === cat.id ? 'active' : ''}`;
      pill.innerHTML = `
        <span class="cat-icon">${cat.icon}</span>
        <span class="cat-name">${cat.name}</span>
      `;
      pill.addEventListener('click', () => {
        document.querySelectorAll('.category-pill-select').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        state.numpad.categoryId = cat.id;
      });
      picker.appendChild(pill);
    });

    // Add a "+" shortcut pill at the end of the scroll list to add new category directly
    const addPill = document.createElement('div');
    addPill.className = 'category-pill-select';
    addPill.style.borderStyle = 'dashed';
    addPill.style.borderColor = 'rgba(255,255,255,0.15)';
    addPill.style.background = 'rgba(255,255,255,0.01)';
    addPill.innerHTML = `
      <span class="cat-icon" style="color: var(--primary);"><i class="bi bi-plus-lg"></i></span>
      <span class="cat-name" style="color: var(--primary);">חדש...</span>
    `;
    addPill.addEventListener('click', () => {
      this.openCategoryModal();
    });
    picker.appendChild(addPill);
  },

  submitTransaction() {
    const amountFloat = parseFloat(state.numpad.amount);
    if (isNaN(amountFloat) || amountFloat <= 0) {
      this.showToast('אנא הזן סכום תקין הגדול מ-0', true);
      return;
    }

    const noteInput = document.getElementById('numpad-note').value.trim();
    const categories = db.getCategories();
    const currentCat = categories.find(c => c.id === state.numpad.categoryId);
    const defaultNote = currentCat ? currentCat.name : 'עסקה';

    const tx = {
      id: state.numpad.editId || 'tx_' + Date.now(),
      amount: state.numpad.type === 'expense' ? -amountFloat : amountFloat,
      date: state.numpad.date || new Date().toISOString().split('T')[0],
      type: state.numpad.type,
      categoryId: state.numpad.categoryId,
      note: noteInput || defaultNote
    };

    db.saveTransaction(tx);
    this.closeNumpad();
    this.renderAll();
    
    // Check budget overrun for this category if it is an expense
    if (tx.type === 'expense') {
      const budgetList = db.getBudgetVsActualForMonth(state.selectedMonth, state.settings.includeRecurring);
      const catStatus = budgetList.find(b => b.id === tx.categoryId);
      if (catStatus && catStatus.isOver) {
        this.showToast(`שים לב! חרגת מתקציב קטגוריית ${catStatus.name}!`, true);
      } else {
        this.showToast(state.numpad.editId ? 'העסקה עודכנה בהצלחה' : 'העסקה נשמרה בהצלחה');
      }
    } else {
      this.showToast(state.numpad.editId ? 'ההכנסה עודכנה בהצלחה' : 'ההכנסה נשמרה בהצלחה');
    }
  },

  // --- Rendering UI Panels ---
  renderAll() {
    // 1. Update month label in header switcher
    const labelEl = document.getElementById('selected-month-label');
    if (labelEl) {
      labelEl.innerText = getHebrewMonthLabel(state.selectedMonth);
    }

    this.renderDashboard();
    
    if (state.activeTab === 'timeline') {
      this.renderTimeline();
    } else if (state.activeTab === 'reports') {
      this.renderReports();
    } else if (state.activeTab === 'settings') {
      this.renderSettings();
    }
  },

  // Renders the top Dashboard stats, line projection graph, and upcoming recurring items
  renderDashboard() {
    // 1. Render Balances
    const currentCash = db.getCurrentCashForMonth(state.selectedMonth);
    const projectedBalance = db.getProjectedBalanceForMonth(state.selectedMonth);

    document.getElementById('current-balance-value').innerText = currentCash.toLocaleString('he-IL', { maximumFractionDigits: 0 });
    
    const projectedValueEl = document.getElementById('projected-balance-value');
    projectedValueEl.innerText = projectedBalance.toLocaleString('he-IL', { maximumFractionDigits: 0 });
    
    if (projectedBalance < 0) {
      projectedValueEl.style.color = 'var(--expense)';
    } else {
      projectedValueEl.style.color = 'var(--income)';
    }

    // Hide or show the upcoming recurring list based on whether it is a past month
    const now = new Date();
    const currMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const upcomingContainer = document.getElementById('upcoming-list-container')?.closest('.glass-card');
    const upcomingHeader = upcomingContainer?.previousElementSibling;
    
    if (state.selectedMonth < currMonthStr) {
      // Past month - hide upcoming list since it has already occurred
      if (upcomingContainer) upcomingContainer.classList.add('hidden');
      if (upcomingHeader) upcomingHeader.classList.add('hidden');
    } else {
      // Current/Future - show list
      if (upcomingContainer) upcomingContainer.classList.remove('hidden');
      if (upcomingHeader) upcomingHeader.classList.remove('hidden');
      this.renderUpcomingList();
    }

    // 2. Render Projection Graph (Inline SVG with gradient fill)
    this.renderProjectionChart();
  },

  // Generates a responsive and gorgeous line chart directly into the DOM using dynamic SVG path calculations
  renderProjectionChart() {
    const container = document.getElementById('projection-chart-container');
    if (!container) return;

    // Get projection data for selected month
    const points = db.get30DayProjectionForMonth(state.selectedMonth);
    if (points.length === 0) return;

    // Calculate dimensions
    const width = container.clientWidth || 380;
    const height = container.clientHeight || 180;
    const padding = { top: 20, right: 15, bottom: 25, left: 55 };

    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Find min and max balance values for vertical scaling
    let balances = points.map(p => p.balance);
    let maxVal = Math.max(...balances, 1000);
    let minVal = Math.min(...balances, 0);

    const range = maxVal - minVal;
    maxVal += range * 0.1;
    minVal -= range * 0.05;

    // Scale helpers
    const getX = (index) => padding.left + (index / (points.length - 1)) * chartWidth;
    const getY = (val) => padding.top + chartHeight - ((val - minVal) / (maxVal - minVal)) * chartHeight;

    // Create SVG
    let svg = `<svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" style="overflow: visible;">`;

    // Define Gradients and shadows
    svg += `
      <defs>
        <linearGradient id="chart-area-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--primary)" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="var(--primary)" stop-opacity="0.0"/>
        </linearGradient>
        <linearGradient id="chart-line-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#5d5fe6"/>
          <stop offset="100%" stop-color="#7d60f4"/>
        </linearGradient>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
    `;

    // Draw Grid Lines & Y Axis Labels
    const gridCount = 4;
    for (let i = 0; i < gridCount; i++) {
      const ratio = i / (gridCount - 1);
      const yVal = minVal + ratio * (maxVal - minVal);
      const yPos = getY(yVal);

      // Grid line
      svg += `<line x1="${padding.left}" y1="${yPos}" x2="${width - padding.right}" y2="${yPos}" stroke="rgba(255,255,255,0.03)" stroke-width="1" />`;
      
      // Y-axis label
      const displayVal = Math.round(yVal).toLocaleString('he-IL', { notation: "compact", compactDisplay: "short" });
      svg += `<text x="${padding.left - 8}" y="${yPos + 4}" fill="var(--text-muted)" font-size="9" font-family="var(--font-display)" text-anchor="end">${displayVal} ₪</text>`;
    }

    // Generate Path Data for the Line and Area
    let linePath = '';
    let areaPath = '';

    points.forEach((p, idx) => {
      const x = getX(idx);
      const y = getY(p.balance);

      if (idx === 0) {
        linePath += `M ${x} ${y}`;
        areaPath += `M ${x} ${padding.top + chartHeight} L ${x} ${y}`;
      } else {
        // Curve fit using bezier anchors
        const prevX = getX(idx - 1);
        const prevY = getY(points[idx - 1].balance);
        const cpX1 = prevX + (x - prevX) / 2;
        const cpY1 = prevY;
        const cpX2 = prevX + (x - prevX) / 2;
        const cpY2 = y;
        
        linePath += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${x} ${y}`;
        areaPath += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${x} ${y}`;
      }

      if (idx === points.length - 1) {
        areaPath += ` L ${x} ${padding.top + chartHeight} Z`;
      }
    });

    // Draw Area under line
    svg += `<path d="${areaPath}" fill="url(#chart-area-grad)" />`;

    // Draw Line
    svg += `<path d="${linePath}" fill="none" stroke="url(#chart-line-grad)" stroke-width="3.5" filter="url(#glow)" />`;

    // Draw glow dot at start and end point of chart
    if (points.length > 0) {
      const startX = getX(0);
      const startY = getY(points[0].balance);
      const endX = getX(points.length - 1);
      const endY = getY(points[points.length - 1].balance);

      // Start dot
      svg += `<circle cx="${startX}" cy="${startY}" r="5" fill="#5d5fe6" stroke="#ffffff" stroke-width="2" />`;
      // End dot
      svg += `<circle cx="${endX}" cy="${endY}" r="5" fill="#7d60f4" stroke="#ffffff" stroke-width="2" />`;
    }

    // Draw X Axis Date labels (1st day, 10th day, 20th day, last day)
    const labelIndexes = [0, Math.floor(points.length / 3), Math.floor(points.length * 2 / 3), points.length - 1];
    labelIndexes.forEach(idx => {
      if (points[idx]) {
        const x = getX(idx);
        const y = padding.top + chartHeight + 16;
        svg += `<text x="${x}" y="${y}" fill="var(--text-muted)" font-size="9.5" font-family="var(--font-body)" text-anchor="middle">${points[idx].displayDate}</text>`;
      }
    });

    svg += '</svg>';
    container.innerHTML = svg;
  },

  renderUpcomingList() {
    const listEl = document.getElementById('upcoming-list-container');
    if (!listEl) return;

    const upcoming = db.getUpcomingRecurring(3);

    if (upcoming.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <i class="bi bi-calendar-event"></i>
          <p>אין חיובים קבועים קרובים החודש</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = '';
    const categories = db.getCategories();

    upcoming.forEach(item => {
      const cat = categories.find(c => c.id === item.categoryId) || { icon: '🏷️', name: 'כללי' };
      const daysText = item.daysRemaining === 0 
        ? '<span class="upcoming-days today">היום</span>' 
        : `<span class="upcoming-days">בעוד ${item.daysRemaining} ימים</span>`;

      const formattedAmount = item.amount > 0 
        ? `+${item.amount.toLocaleString('he-IL')} ₪` 
        : `-${Math.abs(item.amount).toLocaleString('he-IL')} ₪`;

      const amountClass = item.amount > 0 ? 'amount-income' : 'amount-expense';

      itemEl.innerHTML = `
        <div class="upcoming-info">
          <div class="upcoming-icon">${cat.icon}</div>
          <div class="upcoming-details">
            <span class="upcoming-name">${item.name}</span>
            <span class="upcoming-date">יום ${item.dayOfMonth} בחודש</span>
          </div>
        </div>
        <div class="upcoming-amount-badge">
          <span class="upcoming-amount ${amountClass}">${formattedAmount}</span>
          ${daysText}
        </div>
      `;
      listEl.appendChild(itemEl);
    });
  },

  // Renders the timeline tab showing transaction history filtered to selected month
  renderTimeline() {
    const container = document.getElementById('timeline-container');
    if (!container) return;

    const txs = db.getTransactions().filter(t => t.date.startsWith(state.selectedMonth));
    if (txs.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="bi bi-wallet2" style="font-size: 3rem; margin-bottom: 12px; color: var(--text-muted);"></i>
          <p style="font-size: 0.95rem; font-weight: 500;">אין עסקאות בחודש זה</p>
          <span style="font-size: 0.75rem; opacity: 0.7;">לחץ על כפתור ה- (+) למטה כדי להוסיף עסקה</span>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    const categories = db.getCategories();

    // Group transactions by date
    const groups = {};
    txs.forEach(tx => {
      if (!groups[tx.date]) {
        groups[tx.date] = [];
      }
      groups[tx.date].push(tx);
    });

    // Render each group
    Object.keys(groups).sort((a, b) => new Date(b) - new Date(a)).forEach(dateStr => {
      const groupDiv = document.createElement('div');
      groupDiv.className = 'timeline-group slide-up-anim';

      const dateObj = new Date(dateStr);
      const todayStr = new Date().toISOString().split('T')[0];
      const yesterdayObj = new Date();
      yesterdayObj.setDate(yesterdayObj.getDate() - 1);
      const yesterdayStr = yesterdayObj.toISOString().split('T')[0];

      let displayDate = '';
      if (dateStr === todayStr) {
        displayDate = 'היום';
      } else if (dateStr === yesterdayStr) {
        displayDate = 'אתמול';
      } else {
        const options = { weekday: 'long', day: 'numeric', month: 'numeric' };
        displayDate = dateObj.toLocaleDateString('he-IL', options);
      }

      groupDiv.innerHTML = `<div class="timeline-date-header">${displayDate}</div>`;

      // Render transactions inside group
      groups[dateStr].forEach(tx => {
        const cat = categories.find(c => c.id === tx.categoryId) || { icon: '🏷️', name: 'כללי' };
        const amountClass = tx.type === 'income' ? 'amount-income' : 'amount-expense';
        const amountSign = tx.type === 'income' ? '+' : '-';
        const formattedAmount = `${amountSign}${Math.abs(tx.amount).toLocaleString('he-IL')} ₪`;

        const txCard = document.createElement('div');
        txCard.className = 'tx-card';
        txCard.style.cursor = 'pointer';
        txCard.innerHTML = `
          <div class="tx-card-left">
            <div class="tx-category-icon">${cat.icon}</div>
            <div class="tx-meta">
              <span class="tx-title">${tx.note}</span>
              <span class="tx-note">${cat.name}</span>
            </div>
          </div>
          <div class="tx-card-right">
            <span class="tx-amount ${amountClass}">${formattedAmount}</span>
            <button class="tx-delete-btn" data-id="${tx.id}"><i class="bi bi-trash"></i></button>
          </div>
        `;

        // Handle Click on Card for Edit Mode
        txCard.addEventListener('click', () => {
          this.openNumpad(tx);
        });

        // Handle Delete Button
        txCard.querySelector('.tx-delete-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          if (confirm('האם אתה בטוח שברצונך למחוק עסקה זו?')) {
            db.deleteTransaction(tx.id);
            this.renderAll();
            this.showToast('העסקה נמחקה בהצלחה');
          }
        });

        groupDiv.appendChild(txCard);
      });

      container.appendChild(groupDiv);
    });
  },

  // Renders the Reports tab (Total Inflow/Outflow, Budget vs Actual progress bars, Budget Split distribution)
  renderReports() {
    // 1. Render Summary numbers (Net monthly for selected month)
    const summary = db.getMonthlySummaryForMonth(state.selectedMonth, state.settings.includeRecurring);
    
    document.getElementById('report-income-val').innerText = `+${summary.income.toLocaleString('he-IL')} ₪`;
    document.getElementById('report-expense-val').innerText = `-${summary.expense.toLocaleString('he-IL')} ₪`;
    
    const netEl = document.getElementById('report-net-val');
    netEl.innerText = `${summary.net >= 0 ? '+' : ''}${summary.net.toLocaleString('he-IL')} ₪`;
    netEl.className = `mini-card-value ${summary.net >= 0 ? 'amount-income' : 'amount-expense'}`;

    // 2. Render Budget Split Distribution (Needs / Wants / Savings)
    const dist = db.getExpenseDistributionForMonth(state.selectedMonth, state.settings.includeRecurring);
    
    const barNeeds = document.getElementById('split-bar-needs');
    const barWants = document.getElementById('split-bar-wants');
    const barSavings = document.getElementById('split-bar-savings');

    if (barNeeds && barWants && barSavings) {
      barNeeds.style.width = `${dist.percentages.needs}%`;
      barWants.style.width = `${dist.percentages.wants}%`;
      barSavings.style.width = `${dist.percentages.savings}%`;

      barNeeds.innerText = dist.percentages.needs > 10 ? `${dist.percentages.needs}%` : '';
      barWants.innerText = dist.percentages.wants > 10 ? `${dist.percentages.wants}%` : '';
      barSavings.innerText = dist.percentages.savings > 10 ? `${dist.percentages.savings}%` : '';

      document.getElementById('split-text-needs').innerText = `${dist.needs.toLocaleString('he-IL')} ₪ (${dist.percentages.needs}%)`;
      document.getElementById('split-text-wants').innerText = `${dist.wants.toLocaleString('he-IL')} ₪ (${dist.percentages.wants}%)`;
      document.getElementById('split-text-savings').innerText = `${dist.savings.toLocaleString('he-IL')} ₪ (${dist.percentages.savings}%)`;
    }

    // 3. Render Budget progress bars (Budget vs Actual)
    const budgetList = db.getBudgetVsActualForMonth(state.selectedMonth, state.settings.includeRecurring);
    const container = document.getElementById('reports-budget-progress-container');
    if (!container) return;

    container.innerHTML = '';

    const expenseBudgets = budgetList.filter(b => b.id !== 'cat_salary' && b.limit > 0);

    if (expenseBudgets.length === 0) {
      container.innerHTML = `<p class="text-muted" style="text-align:center; font-size:0.85rem; padding: 20px 0;">אין תקציבים מוגדרים</p>`;
      return;
    }

    expenseBudgets.forEach(cat => {
      const fillPercent = Math.min(cat.percentage, 100);
      const stateClass = cat.isOver ? 'overrun' : 'normal';

      const progressItem = document.createElement('div');
      progressItem.className = 'budget-progress-item slide-up-anim';

      let alertText = '';
      if (cat.isOver) {
        alertText = `<span class="budget-overrun-warning"><i class="bi bi-exclamation-triangle-fill"></i> חריגה!</span>`;
      }

      progressItem.innerHTML = `
        <div class="budget-item-header">
          <div class="budget-item-info">
            <span class="budget-item-icon">${cat.icon}</span>
            <span class="budget-item-name">${cat.name}</span>
            ${alertText}
          </div>
          <span class="budget-item-math">${cat.actual.toLocaleString('he-IL')} ₪ מתוך ${cat.limit.toLocaleString('he-IL')} ₪</span>
        </div>
        <div class="budget-bar-bg">
          <div class="budget-bar-fill ${stateClass}" style="width: ${fillPercent}%"></div>
        </div>
      `;
      container.appendChild(progressItem);
    });
  },

  // Renders Settings list: showing current settings, recurring entries list, and categories list
  renderSettings() {
    const startingCashInput = document.getElementById('setting-starting-cash');
    if (startingCashInput) {
      startingCashInput.value = db.getStartingCashForMonth(state.selectedMonth);
    }

    const categories = db.getCategories();

    // 1. Render recurring list
    const recurContainer = document.getElementById('settings-recurring-list');
    if (recurContainer) {
      const recurring = db.getRecurring();

      if (recurring.length === 0) {
        recurContainer.innerHTML = `<p style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 12px 0;">לא הוגדרו הוראות קבע במערכת</p>`;
      } else {
        recurContainer.innerHTML = '';
        recurring.forEach(item => {
          const cat = categories.find(c => c.id === item.categoryId) || { icon: '🏷️', name: 'כללי' };
          const amountClass = item.amount > 0 ? 'amount-income' : 'amount-expense';
          const amountSign = item.amount > 0 ? '+' : '-';
          const formattedAmount = `${amountSign}${Math.abs(item.amount).toLocaleString('he-IL')} ₪`;

          const itemEl = document.createElement('div');
          itemEl.className = 'tx-card';
          itemEl.style.cursor = 'pointer';
          itemEl.innerHTML = `
            <div class="tx-card-left">
              <div class="tx-category-icon">${cat.icon}</div>
              <div class="tx-meta">
                <span class="tx-title">${item.name}</span>
                <span class="tx-note">כל יום ${item.dayOfMonth} בחודש | ${cat.name}</span>
              </div>
            </div>
            <div class="tx-card-right">
              <span class="tx-amount ${amountClass}">${formattedAmount}</span>
              <button class="tx-delete-btn" data-id="${item.id}"><i class="bi bi-trash"></i></button>
            </div>
          `;

          itemEl.addEventListener('click', () => {
            this.openRecurringModal(item);
          });

          itemEl.querySelector('.tx-delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`האם למחוק את הוראת הקבע "${item.name}"?`)) {
              db.deleteRecurring(item.id);
              this.renderSettings();
              this.renderDashboard();
              this.showToast('הוראת הקבע נמחקה');
            }
          });

          recurContainer.appendChild(itemEl);
        });
      }
    }

    // 2. Render categories list in settings
    const catContainer = document.getElementById('settings-categories-list');
    if (catContainer) {
      catContainer.innerHTML = '';
      categories.forEach(cat => {
        const limitText = cat.limit > 0 ? `תקציב: ${cat.limit.toLocaleString('he-IL')} ₪` : 'ללא מגבלת תקציב';
        const bucketNames = { needs: 'מחיה', wants: 'בזבוזים', savings: 'חיסכון' };
        const bucketText = cat.id !== 'cat_salary' ? ` | ${bucketNames[cat.bucket] || 'בזבוזים'}` : '';

        const itemEl = document.createElement('div');
        itemEl.className = 'tx-card';
        itemEl.style.cursor = 'pointer';
        itemEl.innerHTML = `
          <div class="tx-card-left">
            <div class="tx-category-icon">${cat.icon}</div>
            <div class="tx-meta">
              <span class="tx-title">${cat.name}</span>
              <span class="tx-note">${limitText}${bucketText}</span>
            </div>
          </div>
          <div class="tx-card-right">
            <button class="tx-delete-btn" data-id="${cat.id}"><i class="bi bi-trash"></i></button>
          </div>
        `;

        itemEl.addEventListener('click', () => {
          this.openCategoryModal(cat);
        });

        itemEl.querySelector('.tx-delete-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          if (cat.id === 'cat_salary' || cat.id === 'cat_general') {
            this.showToast('לא ניתן למחוק קטגוריות מערכת בסיסיות', true);
            return;
          }
          if (confirm(`האם למחוק את הקטגוריה "${cat.name}"? כל העסקאות והוראות הקבע המשויכות אליה יועברו לכללי.`)) {
            // Update transactions with deleted category to 'cat_general'
            const txs = db.getTransactions();
            txs.forEach(t => {
              if (t.categoryId === cat.id) {
                t.categoryId = 'cat_general';
                db.saveTransaction(t);
              }
            });
            // Update recurring items with deleted category to 'cat_general'
            const rec = db.getRecurring();
            rec.forEach(r => {
              if (r.categoryId === cat.id) {
                r.categoryId = 'cat_general';
                db.saveRecurring(r);
              }
            });

            db.deleteCategory(cat.id);
            this.renderSettings();
            this.renderReports();
            this.renderDashboard();
            this.showToast('הקטגוריה נמחקה בהצלחה');
          }
        });

        catContainer.appendChild(itemEl);
      });
    }
  },

  // --- Manage Recurring Modals ---
  openRecurringModal(editItem = null) {
    const modal = document.getElementById('recurring-modal');
    const titleEl = document.getElementById('recurring-modal-title');
    const nameInput = document.getElementById('rec-name');
    const amountInput = document.getElementById('rec-amount');
    const typeSelect = document.getElementById('rec-type');
    const dayInput = document.getElementById('rec-day');
    const idInput = document.getElementById('recurring-edit-id');
    
    const select = document.getElementById('rec-category');
    select.innerHTML = '';
    
    const categories = db.getCategories();
    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.innerText = `${cat.icon} ${cat.name}`;
      select.appendChild(opt);
    });

    if (editItem) {
      idInput.value = editItem.id;
      nameInput.value = editItem.name;
      amountInput.value = Math.abs(editItem.amount);
      typeSelect.value = editItem.amount > 0 ? 'income' : 'expense';
      dayInput.value = editItem.dayOfMonth;
      select.value = editItem.categoryId;
      if (titleEl) titleEl.innerText = 'עריכת הוראת קבע';
    } else {
      idInput.value = '';
      nameInput.value = '';
      amountInput.value = '';
      typeSelect.value = 'expense';
      dayInput.value = '';
      select.selectedIndex = 0;
      if (titleEl) titleEl.innerText = 'הוספת הוראת קבע חדשה';
    }

    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.add('open'), 10);
  },

  closeRecurringModal() {
    const modal = document.getElementById('recurring-modal');
    modal.classList.remove('open');
    setTimeout(() => modal.classList.add('hidden'), 300);
    document.getElementById('recurring-form').reset();
  },

  handleSaveRecurring() {
    const id = document.getElementById('recurring-edit-id').value;
    const name = document.getElementById('rec-name').value.trim();
    const amount = parseFloat(document.getElementById('rec-amount').value);
    const type = document.getElementById('rec-type').value;
    const day = parseInt(document.getElementById('rec-day').value);
    const categoryId = document.getElementById('rec-category').value;

    if (!name || isNaN(amount) || isNaN(day) || day < 1 || day > 31) {
      this.showToast('אנא מלא את כל השדות בצורה תקינה', true);
      return;
    }

    const item = {
      id: id || 'rec_' + Date.now(),
      name,
      amount: type === 'expense' ? -amount : amount,
      dayOfMonth: day,
      categoryId
    };

    db.saveRecurring(item);
    this.closeRecurringModal();
    this.renderSettings();
    this.renderDashboard();
    this.showToast(id ? 'הוראת הקבע עודכנה בהצלחה' : 'הוראת קבע נוספה בהצלחה');
  },

  // --- Manage Categories Modals ---
  openCategoryModal(editCat = null) {
    const modal = document.getElementById('category-modal');
    const titleEl = document.getElementById('category-modal-title');
    const nameInput = document.getElementById('cat-name');
    const iconInput = document.getElementById('cat-icon');
    const limitInput = document.getElementById('cat-limit');
    const bucketSelect = document.getElementById('cat-bucket');
    const idInput = document.getElementById('category-edit-id');

    if (editCat) {
      idInput.value = editCat.id;
      nameInput.value = editCat.name;
      iconInput.value = editCat.icon;
      limitInput.value = editCat.limit;
      if (bucketSelect) bucketSelect.value = editCat.bucket || 'wants';
      if (titleEl) titleEl.innerText = 'עריכת קטגוריה';
    } else {
      idInput.value = '';
      nameInput.value = '';
      iconInput.value = '';
      limitInput.value = '0';
      if (bucketSelect) bucketSelect.value = 'wants';
      if (titleEl) titleEl.innerText = 'הוספת קטגוריה חדשה';
    }

    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.add('open'), 10);
  },

  closeCategoryModal() {
    const modal = document.getElementById('category-modal');
    modal.classList.remove('open');
    setTimeout(() => modal.classList.add('hidden'), 300);
    document.getElementById('category-form').reset();
  },

  handleSaveCategory() {
    const id = document.getElementById('category-edit-id').value;
    const name = document.getElementById('cat-name').value.trim();
    const icon = document.getElementById('cat-icon').value.trim();
    const limit = parseFloat(document.getElementById('cat-limit').value) || 0;
    const bucket = document.getElementById('cat-bucket')?.value || 'wants';

    if (!name || !icon) {
      this.showToast('אנא מלא את שם הקטגוריה והאייקון', true);
      return;
    }

    const cat = {
      id: id || 'cat_' + Date.now(),
      name,
      icon,
      limit,
      bucket
    };

    db.saveCategory(cat);
    this.closeCategoryModal();

    // Auto-select newly added category if the Numpad picker is open
    const numpadOverlay = document.getElementById('numpad-overlay');
    if (numpadOverlay && !numpadOverlay.classList.contains('hidden')) {
      state.numpad.categoryId = cat.id;
      this.renderNumpadCategoryPicker(); // Re-render picker to display and select the new category
    }

    this.renderSettings();
    this.renderReports();
    this.renderDashboard();
    this.showToast(id ? 'הקטגוריה עודכנה בהצלחה' : 'הקטגוריה נוספה בהצלחה');
  },

  // --- Notification Toast Helper ---
  showToast(message, isWarning = false) {
    const toast = document.getElementById('app-toast');
    if (!toast) return;

    toast.innerText = message;
    
    if (isWarning) {
      toast.style.borderColor = 'rgba(255, 74, 90, 0.4)';
      toast.style.color = '#ff4a5a';
    } else {
      toast.style.borderColor = 'var(--panel-border-glow)';
      toast.style.color = 'white';
    }

    toast.classList.add('show');
    
    // Clear previous timeout if exists
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    
    this.toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }
};
