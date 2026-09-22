# Cloakly — Development Specification

## 1. Project Goal

Create a browser extension for Google Chrome and Mozilla Firefox that improves Reddit browsing and posting safety without using AI, external servers, or cloud processing.

The extension should work primarily through local JavaScript, HTML, CSS, browser APIs, and information already available in the user's Reddit browser session.

The extension has two main functions:

1. Protect the user while browsing Reddit by automatically blurring NSFW and spoiler content.
2. Check subreddit posting/comment requirements before submission, helping users avoid preventable removals caused by account age, karma, flair, title, or community-specific rules.

The extension must not claim that it can detect or prevent Reddit-wide shadow bans. It should identify visible or detectable community requirements and warn the user about possible automatic removal.

---

## 2. Core Principles

- No AI.
- No external AI API.
- No extension backend/server.
- No sending Reddit content to a third-party server.
- Local processing wherever possible.
- Chrome and Firefox support.
- Privacy-first design.
- User remains in control of posting.
- Never automatically post or comment.
- Never automatically delete user content.
- Never claim that a post will definitely be removed.
- Clearly distinguish between detected requirements and uncertain/inferred requirements.
- Use Reddit's currently available page information where possible.
- Cache information locally when useful.
- Handle Reddit UI changes gracefully.

---

# 3. Feature A — NSFW and Spoiler Protection

The extension should automatically detect Reddit posts marked as:

- NSFW
- Spoiler
- NSFW + Spoiler

The extension should blur associated media.

Supported media should include:

- Images
- Videos
- GIFs
- Thumbnails
- Embedded media where technically possible

The title and normal post information should remain visible unless the user chooses otherwise.

A "Reveal" control should allow the user to view the content.

---

# 4. Blur Settings

The extension should provide local settings:

- NSFW Protection: ON/OFF
- Spoiler Protection: ON/OFF
- Blur Images: ON/OFF
- Blur Videos: ON/OFF
- Blur GIFs: ON/OFF
- Blur Thumbnails: ON/OFF
- Blur Intensity: Low / Medium / High
- Reveal Method: Click / Hover / Click only
- Optional automatic re-blur after navigation
- Optional keep revealed content visible until page refresh

All settings should be stored locally using browser storage.

---

# 5. Do Not Use AI for NSFW Detection

The initial version should NOT attempt to identify whether an unmarked image is sexually explicit using computer vision or AI.

The extension should primarily rely on Reddit's own NSFW/Spoiler indicators and metadata exposed to the browser.

Example logic:

```text
IF Reddit post = NSFW
    AND NSFW protection = ON
THEN blur media

IF Reddit post = Spoiler
    AND spoiler protection = ON
THEN blur media

IF post = NSFW + Spoiler
    blur media

IF user clicks Reveal
    remove blur for that post
```

This keeps the feature lightweight and offline-friendly.

---

# 6. Feature B — Pre-Post / Pre-Comment Checker

Before the user submits a Reddit post or comment, the extension should check available community requirements.

Possible checks include:

- Account age
- Total karma
- Post karma
- Comment karma
- Subreddit-specific karma
- Required flair
- Allowed post type
- Title requirements
- Title format
- Required words in title
- Prohibited words where detectable
- Link restrictions
- Content restrictions
- Promotional/self-promotion restrictions
- Community-specific posting rules
- Other clearly detectable requirements

The extension should show a warning before submission when a requirement appears not to be satisfied.

---

# 7. Example Pre-Post Warning

```text
REDDIT POST CHECK

Community: r/example

Account age:
184 days
Required: 30 days
PASS

Karma:
1,240
Required: 500
PASS

Comment karma:
87
Required: 100
WARNING

Post flair:
Required
Selected: Yes
PASS

Title:
Requirement detected
PASS

--------------------------------

WARNING:
Your comment karma appears to be below the community requirement.

This does not guarantee that Reddit will remove the comment.

[View Details] [Post Anyway]
```

The extension should not automatically delete the post/comment.

By default, the user can still submit it.

---

# 8. Three Warning Levels

The extension should classify findings into three categories.

## Requirement Not Met

Use only when there is reliable evidence.

Examples:

- Account age requirement not met.
- Required flair has not been selected.
- Community requires a post type that is not currently selected.

## Possible Rule Conflict

Use when a subreddit rule appears relevant but cannot be reliably interpreted.

Examples:

- Community rules appear to restrict promotional posts.
- Your post may fall under this rule. Review the community rules before submitting.

## General Caution

Use for common posting mistakes that are not necessarily subreddit requirements.

Examples:

- Check whether this community allows external links.
- Check whether a flair is required.
- Check the community rules if unsure.

General advice must not be presented as a confirmed subreddit requirement.

---

# 9. Rule Detection Without AI

The extension should use deterministic rule parsing.

It can identify common rule patterns using:

- Regular expressions
- Keyword matching
- Known Reddit page structures
- DOM parsing
- Structured information exposed by Reddit
- Local rule definitions

Examples:

```text
"minimum 100 karma"
"100 karma required"
"account must be 30 days old"
"account must be at least 30 days old"
"10 comment karma required"
"minimum 50 comment karma"
"post flair required"
"select a flair"
"title must contain"
"title must include"
"no links"
"links are not allowed"
"no self promotion"
"self promotion is prohibited"
```

Example structured result:

```javascript
{
    accountAgeDays: 30,
    combinedKarma: 500,
    commentKarma: 100,
    postKarma: null,
    flairRequired: true
}
```

Unknown rules must not be guessed.

---

# 10. Rule Confidence

Every detected rule should have a confidence/status indicator.

Examples:

```text
Detected requirement:
"Account must be 30 days old"

Status:
Confirmed from community information
```

If uncertain:

```text
Possible requirement:
"Users may need 100 karma"

Status:
Detected from community rule text
```

If it cannot be interpreted:

```text
Could not automatically interpret this rule.
Please review the community rules.
```

---

# 11. Reddit Account Information

Use information available to the logged-in Reddit session where technically and legitimately accessible.

Potential information:

- Account age
- Karma
- Comment karma
- Post karma
- Verification status
- Other relevant account eligibility information exposed by Reddit

The extension must not request or store the user's Reddit password.

The extension must not attempt to bypass Reddit authentication.

---

# 12. Subreddit Rule Cache

Maintain a local cache of parsed community rules.

Example:

```text
r/another_example
Last checked: 2026-09-21
Rules cached locally

r/example
Last checked: 2026-09-20
Rules cached locally
```

When Reddit is available, refresh the information.

When Reddit is unavailable, the extension may use the last cached information.

Clearly show when information is cached and potentially outdated.

Example:

> Using rules cached 3 days ago.

Do not present cached information as current.

---

# 13. Offline Architecture

The processing should work offline wherever possible.

Architecture:

```text
Reddit page
    ↓
Content Script
    ↓
DOM / available Reddit information
    ↓
Local Parser
    ↓
Local Rule Engine
    ↓
Local Result
    ↓
Browser UI
```

No external processing server is required.

### Offline

- Existing settings work.
- Cached rules can be displayed.
- Existing blur functionality works where page information is available.
- No fresh Reddit account/rule information can be retrieved.

### Online

- Current Reddit information can be read/refreshed.
- Cached information can be updated.

The processing is local, but fresh Reddit information naturally requires an internet connection.

---

# 14. Browser Compatibility

Support:

- Google Chrome
- Mozilla Firefox
- Microsoft Edge where possible

Use WebExtensions-compatible APIs.

Prefer Manifest V3 architecture where practical.

Isolate browser-specific differences behind a compatibility layer.

---

# 15. Proposed Project Structure

```text
reddit-safety-extension/

    manifest.json

    background/
        background.js

    content/
        reddit.js
        detector.js
        blur.js
        post-checker.js
        rule-parser.js
        ui.js

    popup/
        popup.html
        popup.css
        popup.js

    options/
        options.html
        options.css
        options.js

    rules/
        rule-patterns.js
        rule-engine.js

    styles/
        blur.css
        warning.css

    utils/
        storage.js
        browser-api.js
        logger.js

    icons/
        icon16.png
        icon32.png
        icon48.png
        icon128.png
```

---

# 16. Content Script Responsibilities

The content script should:

1. Detect Reddit pages.
2. Identify Reddit posts.
3. Detect NSFW/Spoiler indicators.
4. Apply/remove blur.
5. Add Reveal controls.
6. Detect post/comment composition areas.
7. Trigger the pre-post checker.
8. Read available community information.
9. Pass information to the local rule engine.
10. Display warnings.

Reddit uses dynamically loaded content, so the extension should use appropriate DOM observation such as `MutationObserver`.

---

# 17. Dynamic Content Requirement

The extension must work while the user scrolls.

Example:

```text
User opens Reddit
        ↓
10 posts loaded
        ↓
Extension scans them
        ↓
User scrolls
        ↓
20 more posts loaded
        ↓
Extension detects new posts
        ↓
NSFW/Spoiler protection is applied
```

Avoid repeatedly processing the same post.

---

# 18. Pre-Submission Detection

The extension should detect when the user is preparing to:

- Create a post
- Submit an image
- Submit a video
- Submit a link
- Submit a text post
- Submit a comment

Before submission, run the local checker.

Example:

```text
User clicks Post
       ↓
Checker runs
       ↓
No issue
       ↓
Continue normally
```

If a warning exists:

```text
User clicks Post
       ↓
Checker runs
       ↓
Warning
       ↓
[Go Back] [Review Rules] [Post Anyway]
```

The extension must not silently prevent posting.

---

# 19. Comment Requirement Warning

When the user opens a comment/reply box, identify the current subreddit and check available requirements.

Example:

```text
COMMENT CHECK

⚠ Account requirement may not be met

Required:
100 comment karma

Your account:
72 comment karma

Your comment may be removed automatically.

[View Details]
```

By default, the user can still submit the comment.

---

# 20. Post Requirement Warning

When the user starts creating a post:

```text
POST CHECK

Community: r/example

✓ Account age
✓ Post karma
⚠ Comment karma
✓ Verified email
⚠ Required flair

Potential issue:
This community appears to require a minimum amount of comment karma.

[Review] [Continue]
```

Use Reddit's own eligibility information when it is exposed rather than assuming that every subreddit publicly discloses exact thresholds.

---

# 21. Optional Disable Post and Comment Creation

Add a simple protection setting for users who want to prevent accidental submissions.

Settings:

```text
POSTING PROTECTION

[ON] Check posts before submission
[ON] Warn when requirements are not met
[OFF] Disable post creation

COMMENT PROTECTION

[ON] Check comments before submission
[ON] Warn when requirements are not met
[OFF] Disable comment creation
```

Post and comment controls must be independent.

Example:

```text
Post creation: Disabled
Comment creation: Enabled
```

The user can comment but cannot accidentally create a new post.

---

# 22. Disable Post Creation

When enabled, hide or disable Reddit's post creation controls where technically possible.

Possible controls:

- Create Post button
- Create a post button inside a subreddit
- Relevant submission controls

Display:

> Post creation is disabled by Cloakly.

Provide an extension setting to temporarily enable it.

Do not delete drafts.

Do not modify existing posts.

Do not prevent the user from reading Reddit.

---

# 23. Disable Comment Creation

When enabled, disable or hide comment submission controls.

The user should still be able to:

- Read comments
- Expand comments
- Copy text
- Write a draft locally where Reddit supports drafts
- Navigate Reddit

Display:

> Comment creation is disabled.

The user can enable commenting again from the extension popup.

---

# 24. Temporary Enable

Provide a simple temporary override.

Example:

```text
POSTING

Currently:
Disabled

[Enable for 10 minutes]

COMMENTING

Currently:
Disabled

[Enable for 10 minutes]
```

This lets users temporarily enable a disabled feature without changing their permanent preference.

---

# 25. General Post Safety Checks

The extension should have a deterministic checklist for common mistakes.

This is NOT an AI content-quality judgment.

Possible checks:

### Community compatibility

- Is the selected post type allowed?
- Is the community restricted?
- Is the user apparently eligible to post?
- Is required flair selected?
- Is the community marked NSFW/mature?
- Are links allowed?
- Are images allowed?
- Are videos allowed?
- Are polls allowed?
- Are text posts allowed?

### Title checks

Where an explicit rule is detectable:

- Required prefix
- Required keyword
- Required title format
- Maximum/minimum title length where detectable
- Required tag format
- Prohibited title pattern

Example:

```text
Community rule:
Titles must begin with [QUESTION]

Extension:

⚠ Title requirement

Your title does not start with:
[QUESTION]

[Edit Title]
```

### Flair checks

```text
⚠ Post flair required

No flair selected.

[Select Flair]
```

### Link checks

If the community does not allow external links:

```text
⚠ External links may not be allowed in this community.

Review the community rules before submitting.
```

Do not automatically remove the link.

---

# 26. General Things to Review Before Posting

Present this as general guidance, not a universal Reddit rule.

```text
BEFORE YOU POST

□ Community allows this type of post
□ Required flair selected
□ Title follows the community format
□ External links are allowed
□ Image/video is appropriate for the community
□ Post does not appear to violate a visible community rule
□ NSFW/spoiler marking is used when appropriate
□ Account requirements appear satisfied
□ Read the community rules if unsure
```

Different subreddits have different requirements.

---

# 27. General Things to Review Before Commenting

```text
COMMENT CHECK

□ Account requirements appear satisfied
□ Community allows comments from the current user
□ Comment does not appear to violate a visible rule
□ No prohibited links if the community restricts them
□ No obvious spam/repeated content
□ Required thread format followed, if applicable
□ Comment is being posted in the appropriate thread
```

These are reminders, not universal Reddit rules.

---

# 28. Spam / Repetition Warning

Add a lightweight local check for obvious repeated submissions.

If the user attempts to submit the same or very similar comment repeatedly:

```text
WARNING

This comment appears very similar to one you recently submitted.

You may want to review it before submitting again.

[Cancel] [Continue]
```

This is only a local warning.

The extension must not claim that Reddit will classify the activity as spam.

---

# 29. Final Submission Confirmation

Add an optional strict mode.

### Normal Mode

```text
User clicks Post
↓
Checker runs
↓
No issue
↓
Post normally
```

### Warning

```text
User clicks Post
↓
Checker runs
↓
Warning
↓
[Go Back] [Post Anyway]
```

### Strict Mode

```text
User clicks Post
↓
Checker runs
↓
Requirement failure
↓
Submission temporarily blocked
↓
[Review] [Override]
```

Strict mode must be disabled by default.

The user must explicitly enable it.

---

# 30. Extension Popup

The popup should be simple enough for a non-technical user.

```text
Cloakly

Browsing

NSFW Blur                 ON
Spoiler Blur              ON

Posting

Check Posts               ON
Create Posts              ON

Commenting

Check Comments            ON
Create Comments           ON

Protection Level

○ Warning
● Strict

Temporary Controls

[Disable Posting]
[Disable Commenting]

[Open Settings]
```

---

# 31. Important Distinction

The extension must distinguish between:

- Requirement confirmed
- Requirement appears not to be met
- Possible rule conflict
- General reminder
- Unable to determine

Example:

```text
✓ Confirmed requirement satisfied
⚠ Requirement appears not to be satisfied
? Unable to determine
```

Do not display:

- SAFE
- GUARANTEED
- YOU WILL NOT BE BANNED
- YOU WILL NOT BE REMOVED

The extension cannot guarantee these outcomes.

---

# 32. No Universal List of "Bad" Posts

Do not create a universal blacklist of things Reddit users should not post.

Instead, check:

1. Reddit-wide requirements that can be reliably detected.
2. Current community rules.
3. Community-specific posting requirements.
4. User-configured personal restrictions.
5. Obvious technical mistakes.

A post acceptable in one subreddit may be prohibited in another.

---

# 33. Privacy Requirements

The extension must not:

- Sell user information.
- Send Reddit posts to an external server.
- Send account information to an external server.
- Send browsing history to an external server.
- Use third-party analytics by default.
- Use advertising trackers.
- Store Reddit passwords.
- Collect unnecessary personal information.

All settings should remain locally stored.

No AI is required.

---

# 34. Security

Use a strict Content Security Policy.

Avoid:

- `eval()`
- Dynamically executing arbitrary code
- Unsafe HTML injection

Sanitize all text inserted into the page.

Do not trust Reddit page content as executable code.

Prefer safe DOM APIs.

---

# 35. Performance Requirements

The extension should be lightweight.

Avoid:

- Continuous full-page scanning
- Large frameworks unless necessary
- AI models
- Large local models
- Heavy background processing

Prefer:

- MutationObserver
- Event listeners
- Small rule parser
- Local browser storage
- CSS blur effects
- Efficient DOM selectors

The extension should have minimal impact on Reddit performance.

---

# 36. Development Phases

## Phase 1 — Feed Protection

- NSFW detection
- Spoiler detection
- Media blur
- Reveal button
- Settings
- Chrome support

## Phase 2 — Firefox Support

Make the same code compatible with Firefox.

## Phase 3 — Account Requirement Detection

Add:

- Account age
- Karma
- Comment karma
- Post karma
- Other available eligibility information

## Phase 4 — Subreddit Rule Parser

Parse common deterministic rules.

## Phase 5 — Pre-Post Checker

Check posts before submission.

## Phase 6 — Comment Checker

Check comments before submission.

## Phase 7 — Local Rule Cache

Store parsed community rules locally.

## Phase 8 — Disable Post/Comment Controls

Add optional post and comment creation blocking.

## Phase 9 — Performance and Compatibility

Test across Reddit layouts and browser versions.

## Phase 10 — Privacy and Security Review

Review permissions, storage, injected code, and external connections.

---

# 37. Minimum Viable Product

The first working version should contain:

1. NSFW blur
2. Spoiler blur
3. Click-to-reveal
4. Enable/disable settings
5. Chrome support
6. Firefox support
7. Basic account age check
8. Basic karma check
9. Basic subreddit rule display
10. Pre-post warning
11. Pre-comment warning
12. Optional disable post creation
13. Optional disable comment creation

Do not add AI.

Do not add a server.

Do not add automatic posting.

Do not add automatic deletion.

---

# 38. Future Features

Possible future additions:

- Custom keyword warnings
- User-defined subreddit rules
- Local personal blocklist
- Local personal allowlist
- Custom blur settings per subreddit
- Rule-change notifications
- Export/import settings
- Backup local rules
- Dark/light extension UI
- More sophisticated deterministic rule parsing
- Optional local-only content classification if technically needed

---

# 39. Shadow-Ban Wording

Do NOT call the feature "Shadow Ban Prevention."

The extension cannot reliably determine whether Reddit has shadow-banned an account.

Use:

- Posting Safety Check
- Community Requirement Check
- Pre-Post Check
- Removal Risk Warning

Preferred wording:

> This requirement appears not to be satisfied and may cause automatic removal.

Do not say:

> You will be shadow banned.

---

# 40. Final Development Objective

Build a lightweight, privacy-focused Reddit browser extension that helps users:

1. Browse Reddit without unexpectedly seeing NSFW or spoiler media.
2. Reveal blurred media intentionally.
3. Understand subreddit posting requirements.
4. Check account age and karma requirements before posting/commenting.
5. Identify obvious community-rule problems before submission.
6. Reduce preventable post/comment removals.
7. Disable post creation if desired.
8. Disable comment creation if desired.
9. Work without AI.
10. Process information locally.
11. Support Chrome and Firefox.
12. Keep the user in control of every submission.

The extension should be presented as a "Cloakly & Posting Checker," not as a guaranteed shadow-ban prevention system.

---

# 41. Suggested Default Configuration

First installation:

```text
NSFW Blur: ON
Spoiler Blur: ON
Click to Reveal: ON

Post Check: ON
Comment Check: ON

Post Creation: ON
Comment Creation: ON

Warning Mode: ON
Strict Blocking: OFF

Local Processing: ON
Rule Cache: ON
```

The extension should remain useful without unexpectedly preventing normal Reddit usage.
