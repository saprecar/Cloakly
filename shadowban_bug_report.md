# Shadowban Checker Bug Report

## Issue Description
The shadowban checker intermittently reports false positives ("SHADOWBANNED") despite various attempts to fetch the `/appeal` page securely.

## What Was Attempted
1. **Background Fetch with `credentials: 'omit'`**:
   - Fetched `https://www.reddit.com/user/<username>/about.json`
   - *Result*: Reddit API blocks unauthenticated automated requests and returns HTTP 403.
   
2. **Background Fetch with `credentials: 'include'`**:
   - Fetched `https://www.reddit.com/appeal` with user cookies.
   - *Result*: The raw HTML often returns an empty React shell (`<shreddit-app>`) without the actual human-readable text, causing a false positive because the expected text is missing.

3. **Content Script Iframe Injection**:
   - Injected a 1x1 invisible iframe into `www.reddit.com` via the content script to allow React to render the page, then read `textContent`.
   - *Result*: Frame-busting security or delayed React hydration occasionally causes the script to read the DOM before it's ready, or fail to read it entirely.

4. **Content Script Native Fetch**:
   - Sent a direct `fetch()` from the Content Script to `https://www.reddit.com/appeal` to bypass CORS and read the SSR HTML/JSON state.
   - *Result*: Still encountering intermittent false positives.

## Root Cause Hypothesis
Reddit's new Shreddit architecture heavily relies on client-side state hydration. Depending on server load, A/B testing flags, and endpoint routing, the `/appeal` page may not consistently embed the `is_suspended` JSON flag in the initial HTML response. 

## Visual Logic for Future Implementation
According to user testing on the `/appeal` page:
1. **Logged Out**: Redirects to the login screen (Image 1).
2. **Normal Account**: The page displays a banner stating *"You cannot submit an appeal"* and *"Your account is currently neither suspended nor restricted."* The appeal form is still visible below it, but the banner confirms the account is healthy (Image 2).
3. **Shadowbanned Account**: The banner containing the text *"You cannot submit an appeal"* and *"neither suspended nor restricted"* is entirely missing. The user only sees the appeal form.

Therefore, the most reliable detection method is to check for the absence of the "cannot submit an appeal" banner on a logged-in session.

## Proposed Future Fixes to Investigate
- Fix the Content Script `iframe` injection to ensure React fully renders the page (e.g., make it larger than 1x1, ensure it's in the viewport, or wait for specific React hydration events).
- Reverse-engineer Reddit's GraphQL endpoints (`https://gql.reddit.com/`) to query user status directly with the active bearer token.
- Use `https://oauth.reddit.com/api/v1/me` via an implicit OAuth grant.
