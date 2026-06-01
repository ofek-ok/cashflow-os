// app.js - Main Application Orchestrator for CashFlow OS

import { db } from './db.js';
import { ui } from './ui.js';

// Boot the application
document.addEventListener('DOMContentLoaded', () => {
  // Initialize Database
  db.init();

  // Initialize UI renderer and interaction events
  ui.init();

  // Hook save button in numpad (since we keep the event binding in JS)
  const submitBtn = document.getElementById('numpad-submit');
  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      ui.submitTransaction();
    });
  }

  // Handle window resizing to redraw the SVG chart responsively
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      // Re-render chart on resize
      ui.renderProjectionChart();
    }, 200);
  });
});
