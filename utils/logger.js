/**
 * Cloakly
 * Logger Utility
 */

const Logger = {
  log: (...args) => {
    console.log('[Cloakly]', ...args);
  },
  warn: (...args) => {
    console.warn('[Cloakly Warning]', ...args);
  },
  error: (...args) => {
    console.error('[Cloakly Error]', ...args);
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Logger;
}
