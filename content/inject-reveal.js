/**
 * Reddit Privacy & Posting Safety Extension
 * Injected Main World Script (Chrome MV3 CSP Bypass)
 */

document.addEventListener('rs-reveal-native', function(e) {
  const containerId = e.detail && e.detail.id;
  if (!containerId) return;
  
  const c = document.querySelector('[data-rs-auto-id="' + containerId + '"]');
  if (c) {
     // Exploit Lit reactive properties to natively reveal without clicking
     c.blurred = false;
     c.isBlurred = false;
     c._blur = false;
     c.revealed = true;
     
     // Reddit's new enforcement
     c.removeAttribute('reason'); 
     
     // Cleanup
     c.removeAttribute('data-rs-auto-id');
  }
});
