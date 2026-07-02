// Regenerates extract-standalone.js from the shipped loader so the Inspector
// always reflects the real extraction code (no drift). Run:
//   node build-inspector.js
const fs = require('fs');
const path = require('path');

const REF = path.resolve(
  __dirname,
  '../salescloser-dashboard/resources/js/embedded/page-awareness.js'
);

const src = fs.readFileSync(REF, 'utf8');
const lines = src.split('\n');
const start = lines.findIndex((l) => l.startsWith('const MAX_TEXT'));
const end = lines.findIndex((l) => /export function setupPageAwareness/.test(l));
if (start < 0 || end < 0) {
  console.error('Could not find slice markers in', REF);
  process.exit(1);
}

let block = lines.slice(start, end).join('\n').replace(/^export /gm, '');
block = block.split('\n').map((l) => (l ? '    ' + l : l)).join('\n');

const banner = `/**
 * GENERATED — do not edit. Sliced verbatim from the shipped loader
 * resources/js/embedded/page-awareness.js (extraction surface only).
 * Regenerate with: node build-inspector.js
 * Exposes window.SCExtract bound to an arbitrary same-origin window/document.
 */
window.SCExtract = (function () {
  function build(win, doc) {
    const window = win;
    const document = doc;
    const location = win.location;
`;

const footer = `
    return { extractPageContext, extractFacts, extractInteractive, fitToBudget, isRestrictedPath };
  }
  return {
    extractPageContext: (win, doc) => build(win, doc).extractPageContext(),
    extractFacts: (win, doc, data) => build(win, doc).extractFacts(data),
    extractInteractive: (win, doc, root) => build(win, doc).extractInteractive(root),
    // Pure helpers (no DOM needed) — bind against a throwaway context.
    isRestrictedPath: (pathname, paths) => build(globalThis, {}).isRestrictedPath(pathname, paths),
  };
})();
`;

fs.writeFileSync(path.join(__dirname, 'extract-standalone.js'), banner + block + footer);
console.log('Wrote extract-standalone.js from the shipped loader.');
