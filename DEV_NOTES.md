# Developer Notes & Architecture Decisions

This document contains technical post-mortems and architectural notes for future reference.

## The Auto-Reveal Saga (Manifest V3 vs. Modern Reddit)

### The Problem
Reddit's new "Shreddit" architecture uses Lit web components (`<shreddit-blurred-container>`). To unblur them without triggering a click event (which often redirects you or triggers login walls), you need to directly modify the component's internal properties (e.g. `element.blurred = false;`). 
However, Content Scripts run in an "Isolated World" and do not have access to these JavaScript objects.

### Failed Attempt 1: Dynamic Script Injection
Our initial approach was to inject a `<script>` tag into the DOM from the content script containing the bypass code. 
- **Why it failed:** Chrome's strict Manifest V3 Content Security Policy (CSP) completely blocks `unsafe-inline` scripts injected this way. It worked on Firefox, but failed silently on Chrome.

### Failed Attempt 2: MV3 Web Accessible Resources + Custom Events
We moved the bypass code to a dedicated file (`inject-reveal.js`), declared it as a `web_accessible_resource`, injected it via a `script src` tag, and used `document.dispatchEvent(new CustomEvent(...))` to pass data from the Isolated World to the Main World.
- **Why it failed:** Firefox's "Xray Vision" security sandbox actively scrubs and strips the `detail` object from `CustomEvent` payloads passed between the extension and the main page. This caused the script to fail on Firefox because it never received the settings payload.

### The Solution: `"world": "MAIN"` + HTML DOM Datasets
Taking inspiration from [andradeatdev's Reddit-NSFW-Unblur](https://github.com/andradeatdev/Reddit-NSFW-Unblur), we completely bypassed dynamic injection and CustomEvents.

1. **Main World Execution:** Chrome 111+ and Firefox 120+ support executing content scripts natively in the Main World by adding `"world": "MAIN"` to the `manifest.json` entry. We created `content/auto-reveal.js` and registered it this way.
2. **Cross-World Communication:** To bypass Firefox's Xray Vision, we abandoned `CustomEvent`. Instead, the Isolated World script (`content/reddit.js`) writes its state directly to the DOM as a primitive string attribute (`document.documentElement.dataset.rsAutoReveal = 'true'`).
3. **Mutation Observer:** The Main World script (`auto-reveal.js`) sets up a `MutationObserver` on `document.documentElement` filtering for `data-rs-auto-reveal`. When the attribute changes, it reads the primitive string and executes the Lit bypass.

This architecture is robust, extremely fast, completely bypasses Chrome's MV3 CSP, and safely passes through Firefox's Xray Vision.

## Duplicate Safety Cards Bug (Reddit's Virtualized DOM)

### The Problem
The "Comment Safety" guides were frequently duplicating themselves when the user scrolled through long comment threads.

### The Cause
Modern Reddit uses aggressive DOM virtualization (re-using the same DOM nodes for different comments as they scroll in and out of view). Because the extension was attaching UI elements based on simple DOM queries without tracking the lifecycle of the parent `<shreddit-composer>`, the `MutationObserver` would continually re-trigger and blindly inject new safety cards into re-used containers.

### The Solution
We implemented strict lifecycle tracking and cleanup in `content/ui.js`:
1. **Sibling-Based Injection:** The safety guide is now strictly injected as a controlled sibling relative to the composer box, ensuring predictable placement.
2. **Orphan Cleanup Routine:** Before attaching a new card, the UI manager actively scans for and destroys "orphaned" safety cards that no longer correspond to the currently active active element, preventing the virtualized DOM from accumulating stale UI components.
