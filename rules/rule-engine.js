/**
 * Reddit Privacy & Posting Safety Extension
 * Local Rule Engine (Deterministic Evaluation)
 */

const WARNING_LEVELS = {
  NOT_MET: 'REQUIREMENT_NOT_MET',
  CONFLICT: 'POSSIBLE_RULE_CONFLICT',
  CAUTION: 'GENERAL_CAUTION'
};

const RuleEngine = {
  /**
   * Evaluates post/comment input against user account stats & subreddit rules.
   * 
   * @param {Object} accountInfo - { accountAgeDays, commentKarma, postKarma, combinedKarma, isEmailVerified }
   * @param {Object} submission - { subreddit, type: 'post'|'comment', title, text, flairSelected, linksCount }
   * @param {Object} parsedRules - Output from RulePatterns.parseRuleText
   * @returns {Object} { status: 'PASS'|'WARNING'|'BLOCK', checks: [...], summary: string }
   */
  evaluate(accountInfo = {}, submission = {}, parsedRules = null) {
    const checks = [];
    let hasNotMet = false;
    let hasConflict = false;

    // Default account info if unpopulated
    const userAge = accountInfo.accountAgeDays ?? null;
    const userCommentKarma = accountInfo.commentKarma ?? null;
    const userPostKarma = accountInfo.postKarma ?? null;
    const userTotalKarma = accountInfo.combinedKarma ?? ((userCommentKarma || 0) + (userPostKarma || 0));

    if (!parsedRules) {
      checks.push({
        title: 'Community Rules',
        level: WARNING_LEVELS.CAUTION,
        statusText: 'Could not automatically interpret this community ruleset.',
        detail: 'Please review r/' + (submission.subreddit || 'this community') + ' rules manually before posting.',
        confidence: 'Uncertain / Inferred'
      });
      return { status: 'PASS', checks, summary: 'No specific requirements parsed.' };
    }

    // 1. Account Age Check
    if (parsedRules.accountAgeDays !== null) {
      if (userAge !== null) {
        if (userAge < parsedRules.accountAgeDays) {
          hasNotMet = true;
          checks.push({
            title: 'Account Age Requirement',
            level: WARNING_LEVELS.NOT_MET,
            userValue: `${userAge} days`,
            requiredValue: `${parsedRules.accountAgeDays} days`,
            statusText: 'Requirement appears not to be met.',
            detail: `Your account age (${userAge} days) is less than the detected requirement of ${parsedRules.accountAgeDays} days.`,
            confidence: 'Confirmed from community information'
          });
        } else {
          checks.push({
            title: 'Account Age Requirement',
            level: 'PASS',
            userValue: `${userAge} days`,
            requiredValue: `${parsedRules.accountAgeDays} days`,
            statusText: 'PASS',
            confidence: 'Confirmed from community information'
          });
        }
      } else {
        checks.push({
          title: 'Account Age Requirement',
          level: WARNING_LEVELS.CAUTION,
          requiredValue: `${parsedRules.accountAgeDays} days`,
          statusText: 'Unable to detect account age.',
          detail: `Community requires ${parsedRules.accountAgeDays} days account age. Ensure your account meets this.`,
          confidence: 'Detected from community rule text'
        });
      }
    }

    // 2. Comment Karma Check
    if (parsedRules.commentKarma !== null) {
      if (userCommentKarma !== null) {
        if (userCommentKarma < parsedRules.commentKarma) {
          hasNotMet = true;
          checks.push({
            title: 'Comment Karma Requirement',
            level: WARNING_LEVELS.NOT_MET,
            userValue: userCommentKarma,
            requiredValue: parsedRules.commentKarma,
            statusText: 'Requirement appears not to be met.',
            detail: `Your comment karma (${userCommentKarma}) is below the required threshold of ${parsedRules.commentKarma}.`,
            confidence: 'Confirmed from community information'
          });
        } else {
          checks.push({
            title: 'Comment Karma Requirement',
            level: 'PASS',
            userValue: userCommentKarma,
            requiredValue: parsedRules.commentKarma,
            statusText: 'PASS',
            confidence: 'Confirmed from community information'
          });
        }
      } else {
        checks.push({
          title: 'Comment Karma Requirement',
          level: WARNING_LEVELS.CAUTION,
          requiredValue: parsedRules.commentKarma,
          statusText: 'Unable to verify comment karma.',
          detail: `Community requires ${parsedRules.commentKarma} comment karma.`,
          confidence: 'Detected from community rule text'
        });
      }
    }

    // 3. Post Karma Check
    if (parsedRules.postKarma !== null) {
      if (userPostKarma !== null) {
        if (userPostKarma < parsedRules.postKarma) {
          hasNotMet = true;
          checks.push({
            title: 'Post Karma Requirement',
            level: WARNING_LEVELS.NOT_MET,
            userValue: userPostKarma,
            requiredValue: parsedRules.postKarma,
            statusText: 'Requirement appears not to be met.',
            detail: `Your post karma (${userPostKarma}) is below the required threshold of ${parsedRules.postKarma}.`,
            confidence: 'Confirmed from community information'
          });
        } else {
          checks.push({
            title: 'Post Karma Requirement',
            level: 'PASS',
            userValue: userPostKarma,
            requiredValue: parsedRules.postKarma,
            statusText: 'PASS',
            confidence: 'Confirmed from community information'
          });
        }
      }
    }

    // 4. Combined Karma Check
    if (parsedRules.combinedKarma !== null && parsedRules.commentKarma === null && parsedRules.postKarma === null) {
      if (userTotalKarma !== null) {
        if (userTotalKarma < parsedRules.combinedKarma) {
          hasNotMet = true;
          checks.push({
            title: 'Total Karma Requirement',
            level: WARNING_LEVELS.NOT_MET,
            userValue: userTotalKarma,
            requiredValue: parsedRules.combinedKarma,
            statusText: 'Requirement appears not to be met.',
            detail: `Your total karma (${userTotalKarma}) is below the required threshold of ${parsedRules.combinedKarma}.`,
            confidence: 'Confirmed from community information'
          });
        } else {
          checks.push({
            title: 'Total Karma Requirement',
            level: 'PASS',
            userValue: userTotalKarma,
            requiredValue: parsedRules.combinedKarma,
            statusText: 'PASS',
            confidence: 'Confirmed from community information'
          });
        }
      }
    }

    // 4.5 Generic Karma Check (when exact number is unspecified)
    if (parsedRules.hasGenericKarmaReq && parsedRules.commentKarma === null && parsedRules.postKarma === null && parsedRules.combinedKarma === null) {
      // If we don't know the exact threshold, assume 100 is a safe minimum for most generic requirements
      if (userTotalKarma !== null && userTotalKarma < 100) {
        checks.push({
          title: 'Minimum Karma Threshold',
          level: WARNING_LEVELS.CAUTION,
          statusText: 'General Caution',
          detail: 'This community requires a minimum karma threshold. Your karma is relatively low, so your post may be restricted.',
          confidence: 'Detected from community rule text'
        });
        hasConflict = true;
      } else {
        checks.push({
          title: 'Minimum Karma Threshold',
          level: 'PASS',
          statusText: 'PASS',
          detail: 'Community has a generic karma requirement, which you likely meet with your current high karma.',
          confidence: 'Inferred based on high karma'
        });
      }
    }

    // 5. Post Flair Requirement (only for posts)
    if (submission.type === 'post' && parsedRules.flairRequired) {
      if (!submission.flairSelected) {
        hasNotMet = true;
        checks.push({
          title: 'Post Flair Required',
          level: WARNING_LEVELS.NOT_MET,
          userValue: 'None selected',
          requiredValue: 'Flair required',
          statusText: 'Requirement appears not to be met.',
          detail: 'This community requires choosing a post flair before submitting.',
          confidence: 'Confirmed from community settings'
        });
      } else {
        checks.push({
          title: 'Post Flair Required',
          level: 'PASS',
          statusText: 'PASS',
          confidence: 'Confirmed from community settings'
        });
      }
    }

    // 6. Title Requirements (only for posts)
    if (submission.type === 'post' && parsedRules.titleRequirements.length > 0) {
      const title = submission.title || '';
      for (const tag of parsedRules.titleRequirements) {
        if (!title.toLowerCase().includes(tag.toLowerCase())) {
          hasConflict = true;
          checks.push({
            title: 'Title Format Requirement',
            level: WARNING_LEVELS.CONFLICT,
            requiredValue: `Must include tag/keyword: [${tag}]`,
            statusText: 'Possible rule conflict.',
            detail: `Your title does not appear to contain the required pattern: [${tag}].`,
            confidence: 'Detected from community rule text'
          });
        }
      }
    }

    // 7. Link Restrictions
    if (parsedRules.noLinks && (submission.linksCount > 0 || (submission.text && /https?:\/\//i.test(submission.text)))) {
      hasConflict = true;
      checks.push({
        title: 'Link Restriction Warning',
        level: WARNING_LEVELS.CONFLICT,
        statusText: 'Possible rule conflict.',
        detail: 'This community appears to restrict or disallow external links in posts.',
        confidence: 'Detected from community rule text'
      });
    }

    // 8. Self-Promotion Warning
    if (parsedRules.selfPromotionWarning) {
      checks.push({
        title: 'Self-Promotion Caution',
        level: WARNING_LEVELS.CAUTION,
        statusText: 'General Caution',
        detail: 'Community rules restrict self-promotion. Ensure your post aligns with community guidelines.',
        confidence: 'Detected from community rule text'
      });
    }

    let overallStatus = 'PASS';
    if (hasNotMet) overallStatus = 'WARNING_NOT_MET';
    else if (hasConflict) overallStatus = 'WARNING_CONFLICT';

    return {
      status: overallStatus,
      checks,
      hasNotMet,
      hasConflict,
      summary: hasNotMet
        ? 'Some community posting requirements appear not to be satisfied.'
        : hasConflict
        ? 'Potential community rule conflicts were identified.'
        : 'All detected checks passed.'
    };
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RuleEngine, WARNING_LEVELS };
}
