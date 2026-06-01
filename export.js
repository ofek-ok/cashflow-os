// export.js - Utility for exporting financial data to CSV

import { db } from './db.js';

export const exporter = {
  /**
   * Export all transactions to CSV format.
   * Includes UTF-8 BOM so Excel on Windows displays Hebrew characters correctly.
   */
  exportTransactionsToCSV() {
    const transactions = db.getTransactions();
    const categories = db.getCategories();
    
    // Create a lookup for category names
    const categoryMap = {};
    categories.forEach(c => {
      categoryMap[c.id] = `${c.icon} ${c.name}`;
    });

    // Define CSV Headers
    const headers = ['מזהה', 'תאריך', 'סוג', 'סכום', 'קטגוריה', 'הערה'];
    
    // Map rows
    const rows = transactions.map(tx => {
      const typeLabel = tx.type === 'income' ? 'הכנסה' : 'הוצאה';
      const categoryLabel = categoryMap[tx.categoryId] || 'כללי';
      
      return [
        tx.id,
        tx.date,
        typeLabel,
        tx.amount,
        categoryLabel,
        tx.note.replace(/"/g, '""') // Escape double quotes for CSV safety
      ];
    });

    // Construct CSV content (semicolon or comma separated, comma is standard)
    let csvContent = headers.join(',') + '\n';
    rows.forEach(row => {
      const escapedRow = row.map(value => {
        // Enclose in double quotes if there are commas or spaces
        const strValue = String(value);
        if (strValue.includes(',') || strValue.includes(' ') || strValue.includes('\n')) {
          return `"${strValue}"`;
        }
        return strValue;
      });
      csvContent += escapedRow.join(',') + '\n';
    });

    // Add UTF-8 BOM marker for Excel Hebrew support
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    
    link.setAttribute('href', url);
    link.setAttribute('download', `CashFlow_OS_Transactions_${dateStr}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  /**
   * Import transactions from CSV format.
   * This is a value-added feature that makes the app feel extremely complete.
   */
  importTransactionsFromCSV(file, callback) {
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const text = e.target.result;
        const lines = text.split('\n');
        if (lines.length < 2) {
          throw new Error('הקובץ ריק או לא תקין');
        }

        const categories = db.getCategories();
        const transactions = db.getTransactions();
        
        let importCount = 0;

        // Skip header
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          // Simple CSV parser that handles double quotes
          const columns = [];
          let currentColumn = '';
          let insideQuotes = false;

          for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
              insideQuotes = !insideQuotes;
            } else if (char === ',' && !insideQuotes) {
              columns.push(currentColumn.trim());
              currentColumn = '';
            } else {
              currentColumn += char;
            }
          }
          columns.push(currentColumn.trim());

          if (columns.length < 5) continue;

          const date = columns[1];
          const typeLabel = columns[2];
          const amount = parseFloat(columns[3]);
          const categoryLabel = columns[4];
          const note = columns[5] || '';

          if (!date || isNaN(amount)) continue;

          const type = typeLabel === 'הכנסה' || amount > 0 ? 'income' : 'expense';

          // Try to match category by name/icon
          let categoryId = 'cat_general';
          const cleanCategoryLabel = categoryLabel.replace(/[\uE000-\uF8FF]|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDDFF]|\uD83E[\uDD00-\uDFFF]/g, '').trim(); // Remove emojis to match name
          
          const matchedCat = categories.find(c => c.name === cleanCategoryLabel || categoryLabel.includes(c.name));
          if (matchedCat) {
            categoryId = matchedCat.id;
          }

          const newTx = {
            id: 'tx_imported_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            amount: type === 'expense' && amount > 0 ? -amount : amount,
            date,
            type,
            categoryId,
            note
          };

          db.saveTransaction(newTx);
          importCount++;
        }

        callback(null, importCount);
      } catch (err) {
        callback(err);
      }
    };
    reader.readAsText(file, 'UTF-8');
  }
};
