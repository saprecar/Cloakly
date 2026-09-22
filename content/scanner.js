/**
 * Reddit Privacy & Posting Safety Extension
 * Pre-Submission Content Scanner
 * Detects sensitive information, custom keywords, and rule-breaking keywords.
 */

const ContentScanner = {
  // Common Sensitive Patterns
  PATTERNS: {
    // PAN: 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F)
    PAN: /\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/gi,
    
    // Aadhaar: 12 digits, optional spaces/dashes (e.g. 1234 5678 9012)
    AADHAAR: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    
    // Credit/Debit Cards: 13-19 digits, optional spaces/dashes
    CARD: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})\b/g,
    
    // Phone numbers (General format, mostly Indian context + generic 10 digit)
    PHONE: /\b(?:\+?91[\s-]?)?[6789]\d{9}\b/g,
    
    // Email addresses
    EMAIL: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
  },

  /**
   * Scans text for rule violations, sensitive information, and custom keywords.
   * @param {string} text - The content to scan.
   * @param {Object} settings - The extension settings (contains custom keywords and toggles).
   * @param {Array} parsedRules - The parsed subreddit rules containing extracted keywords.
   * @returns {Array} List of matched objects { type, category, text, reason }.
   */
  scan(text, settings = {}, parsedRules = []) {
    const matches = [];
    if (!text || typeof text !== 'string') return matches;

    const config = settings.contentProtection || {
      rulesEnabled: true,
      sensitiveEnabled: true,
      customEnabled: true,
      customKeywords: []
    };

    // 1. Scan for Sensitive Information
    if (config.sensitiveEnabled) {
      for (const [type, regex] of Object.entries(this.PATTERNS)) {
        // Reset lastIndex for global regexes
        regex.lastIndex = 0;
        let match;
        while ((match = regex.exec(text)) !== null) {
          // Avoid matching overlapping strings excessively
          matches.push({
            category: 'SENSITIVE',
            type: type,
            text: match[0],
            reason: `Potentially sensitive information detected (${type})`
          });
        }
      }
    }

    // 2. Scan for User-Defined Custom Keywords
    if (config.customEnabled && config.customKeywords && config.customKeywords.length > 0) {
      for (const kw of config.customKeywords) {
        if (!kw.word) continue;
        
        let flags = 'g';
        if (!kw.caseSensitive) flags += 'i';

        let regexString = this.escapeRegExp(kw.word);
        if (kw.exact) {
          regexString = `\\b${regexString}\\b`;
        }

        try {
          const regex = new RegExp(regexString, flags);
          let match;
          while ((match = regex.exec(text)) !== null) {
            matches.push({
              category: 'CUSTOM',
              type: 'USER_KEYWORD',
              text: match[0],
              reason: `Custom keyword matched: "${kw.word}"`
            });
            // If not global, break to prevent infinite loops (though 'g' is forced above)
            if (!regex.global) break; 
          }
        } catch (e) {
          console.warn('Invalid regex generated for custom keyword:', kw.word);
        }
      }
    }

    // 3. Scan for Subreddit Rule Keywords
    if (config.rulesEnabled && parsedRules && parsedRules.extractedKeywords && parsedRules.extractedKeywords.length > 0) {
      for (const ruleKw of parsedRules.extractedKeywords) {
        if (!ruleKw) continue;
        const regex = new RegExp(`\\b${this.escapeRegExp(ruleKw)}\\b`, 'gi');
        let match;
        while ((match = regex.exec(text)) !== null) {
          matches.push({
            category: 'RULE',
            type: 'RULE_KEYWORD',
            text: match[0],
            reason: `May violate Subreddit Rule: Prohibited keyword "${ruleKw}"`
          });
        }
      }
    }

    // Deduplicate exact same text matches overlapping
    const uniqueMatches = [];
    const seen = new Set();
    for (const m of matches) {
      const key = `${m.category}-${m.type}-${m.text.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueMatches.push(m);
      }
    }

    return uniqueMatches;
  },

  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ContentScanner;
}
