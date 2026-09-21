/**
 * Reddit Privacy & Posting Safety Extension
 * Logger Utility
 */

const Logger = {
  log: (...args) => {
    console.log('[Reddit Safety]', ...args);
  },
  warn: (...args) => {
    console.warn('[Reddit Safety Warning]', ...args);
  },
  error: (...args) => {
    console.error('[Reddit Safety Error]', ...args);
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Logger;
}
