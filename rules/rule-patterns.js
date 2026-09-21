/**
 * Reddit Privacy & Posting Safety Extension
 * Deterministic Rule Patterns (No AI / Local Regex Parsing)
 */

const RulePatterns = {
  // Account Age Patterns (handles "7+ days", "7 days", "at least 7 days" etc.)
  accountAge: [
    { regex: /account\s+must\s+be\s+(?:at\s+least\s+)?(\d+)\+?\s*(day|days|month|months|year|years)(?:\s+old)?/i, type: 'days' },
    { regex: /minimum\s+(?:account\s+age\s+(?:of\s+)?)?(\d+)\+?\s*(day|days|month|months|year|years)/i, type: 'days' },
    { regex: /(\d+)\+?\s*(day|days|month|months|year|years)\s+old\s+account/i, type: 'days' },
    { regex: /accounts?\s+(?:must\s+be\s+)?(?:at\s+least\s+)?(\d+)\+?\s*(day|days|month|months|year|years)/i, type: 'days' },
    { regex: /(\d+)\+?\s*(?:day|days|month|months|year|years)\s+(?:old|minimum|min)/i, type: 'days' }
  ],

  // Karma Requirements
  commentKarma: [
    { regex: /(\d+)\s*(?:minimum\s+)?comment\s+karma(?:\s+required|\s+needed|\s+minimum|\s+min)?/i },
    { regex: /comment\s+karma(?:\s+of|\s+must\s+be)?\s*(?:at\s+least\s+)?(\d+)/i },
    { regex: /minimum\s+(\d+)\s+comment\s+karma/i }
  ],

  postKarma: [
    { regex: /(\d+)\s*(?:minimum\s+)?post\s+karma(?:\s+required|\s+needed|\s+minimum|\s+min)?/i },
    { regex: /post\s+karma(?:\s+of|\s+must\s+be)?\s*(?:at\s+least\s+)?(\d+)/i },
    { regex: /minimum\s+(\d+)\s+post\s+karma/i }
  ],

  combinedKarma: [
    { regex: /(\d+)\s*(?:total|combined)?\s*karma(?:\s+required|\s+needed|\s+minimum|\s+min)?/i },
    { regex: /karma(?:\s+of|\s+must\s+be)?\s*(?:at\s+least\s+)?(\d+)/i },
    { regex: /minimum\s+(\d+)\s+karma/i }
  ],

  // Generic Karma Requirements (no specific number)
  genericKarma: [
    { regex: /minimum\s+karma\s+(?:thresholds?|requirement|needed|required)/i },
    { regex: /(?:meet|have)\s+minimum\s+karma/i },
    { regex: /karma\s+and\s+account\s+age\s+requirement/i },
    { regex: /karma\s+requirement/i }
  ],

  // Flair Requirements
  flairRequired: [
    /post\s+flair\s+(?:is\s+)?required/i,
    /flair\s+your\s+post/i,
    /select\s+a\s+(?:post\s+)?flair/i,
    /must\s+add\s+a\s+flair/i
  ],

  // Title Requirements
  titlePattern: [
    { regex: /title\s+must\s+(?:start\s+with|begin\s+with|contain|include)\s*\[?([A-Z0-9_\-\s\/,]+)\]?/i },
    { regex: /tag\s+(?:your\s+)?title\s+with\s*\[?([A-Z0-9_\-\s\/,]+)\]?/i }
  ],

  // Content Restrictions
  linkRestrictions: [
    /no\s+(?:external\s+)?links\s+(?:allowed|permitted)/i,
    /links\s+are\s+not\s+allowed/i,
    /text\s+posts\s+only/i,
    /no\s+direct\s+links/i
  ],

  selfPromotionRestrictions: [
    /no\s+self[-_\s]?promotion/i,
    /self[-_\s]?promotion\s+is\s+(?:not\s+allowed|prohibited|restricted)/i,
    /10:1\s+rule/i
  ],

  // Converter helper for age to days
  convertToDays(value, unit) {
    const num = parseInt(value, 10);
    if (isNaN(num)) return 0;
    const u = unit.toLowerCase();
    if (u.startsWith('day')) return num;
    if (u.startsWith('month')) return num * 30;
    if (u.startsWith('year')) return num * 365;
    return num;
  },

  /**
   * Parses raw subreddit text/rules into structured requirements.
   * @param {Array<string>|string} ruleTexts 
   * @returns {Object} Structured rules parsed deterministically
   */
  parseRuleText(ruleTexts) {
    const lines = Array.isArray(ruleTexts) ? ruleTexts : [ruleTexts];
    const fullText = lines.join('\n');

    const result = {
      accountAgeDays: null,
      commentKarma: null,
      postKarma: null,
      combinedKarma: null,
      hasGenericKarmaReq: false,
      flairRequired: false,
      titleRequirements: [],
      noLinks: false,
      selfPromotionWarning: false,
      rawRules: lines
    };

    // Account age scan
    for (const pat of this.accountAge) {
      const match = fullText.match(pat.regex);
      if (match) {
        result.accountAgeDays = this.convertToDays(match[1], match[2]);
        break;
      }
    }

    // Comment Karma scan
    for (const pat of this.commentKarma) {
      const match = fullText.match(pat.regex);
      if (match) {
        result.commentKarma = parseInt(match[1], 10);
        break;
      }
    }

    // Post Karma scan
    for (const pat of this.postKarma) {
      const match = fullText.match(pat.regex);
      if (match) {
        result.postKarma = parseInt(match[1], 10);
        break;
      }
    }

    // Combined Karma scan (if comment or post karma wasn't explicitly extracted)
    for (const pat of this.combinedKarma) {
      const match = fullText.match(pat.regex);
      if (match && !result.commentKarma && !result.postKarma) {
        result.combinedKarma = parseInt(match[1], 10);
        break;
      }
    }

    // Generic Karma scan (if no specific number was found)
    if (!result.commentKarma && !result.postKarma && !result.combinedKarma) {
      for (const pat of this.genericKarma) {
        if (pat.regex.test(fullText)) {
          result.hasGenericKarmaReq = true;
          break;
        }
      }
    }

    // Flair requirement scan
    for (const pat of this.flairRequired) {
      if (pat.test(fullText)) {
        result.flairRequired = true;
        break;
      }
    }

    // Title pattern scan
    for (const pat of this.titlePattern) {
      const match = fullText.match(pat.regex);
      if (match && match[1]) {
        result.titleRequirements.push(match[1].trim());
      }
    }

    // Link restriction scan
    for (const pat of this.linkRestrictions) {
      if (pat.test(fullText)) {
        result.noLinks = true;
        break;
      }
    }

    // Self promotion scan
    for (const pat of this.selfPromotionRestrictions) {
      if (pat.test(fullText)) {
        result.selfPromotionWarning = true;
        break;
      }
    }

    return result;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = RulePatterns;
}
