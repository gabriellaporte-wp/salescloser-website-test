// Headless validation: load each fixture in jsdom, run the REAL loader
// extraction (extract-standalone.js, sliced from the shipped loader), and
// assert the snapshot matches the scenario's expectation. Run: node validate.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const extractorSrc = fs.readFileSync(path.join(__dirname, 'extract-standalone.js'), 'utf8');

let pass = 0;
let fail = 0;
const failures = [];

function snapshotFor(relPath, { runScripts = true, waitMutation = false } = {}) {
  const html = fs.readFileSync(path.join(__dirname, relPath), 'utf8');
  const dom = new JSDOM(html, {
    url: 'https://shop.example' + '/' + relPath,
    runScripts: runScripts ? 'dangerously' : 'outside-only',
    pretendToBeVisual: true,
  });
  const { window } = dom;
  // jsdom lacks TextEncoder on older builds; Node provides it globally.
  if (typeof window.TextEncoder === 'undefined') window.TextEncoder = TextEncoder;
  // Run the generated extractor inside the jsdom window context.
  const ctx = dom.getInternalVMContext();
  vm.runInContext(extractorSrc, ctx);
  if (waitMutation) {
    // Fixtures use setTimeout(...,6000); advance by replaying via the timer.
    // jsdom runs real timers; we just re-read after a synchronous tick isn't
    // enough, so callers handle mutation pages separately.
  }
  return window.SCExtract.extractPageContext(window, window.document);
}

// Returns the live jsdom window + the SCExtract API, for tests that need to
// reach into the DOM (compare a selector against the element it should target)
// or call a helper in isolation.
function domFor(relPath) {
  const html = fs.readFileSync(path.join(__dirname, relPath), 'utf8');
  const dom = new JSDOM(html, {
    url: 'https://shop.example/' + relPath,
    runScripts: 'dangerously',
    pretendToBeVisual: true,
  });
  const { window } = dom;
  if (typeof window.TextEncoder === 'undefined') window.TextEncoder = TextEncoder;
  vm.runInContext(extractorSrc, dom.getInternalVMContext());
  return { window, SC: window.SCExtract };
}

function check(name, cond, detail) {
  if (cond) { pass++; console.log('  \x1b[32m✓\x1b[0m ' + name); }
  else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); console.log('  \x1b[31m✗\x1b[0m ' + name + (detail ? ' — ' + detail : '')); }
}

function bytes(snap) { return Buffer.byteLength(JSON.stringify(snap), 'utf8'); }

console.log('\n=== Velar: velar.html (Product JSON-LD, 3 anchor tiers) ===');
{
  const s = snapshotFor('velar-motors/velar.html');
  check('facts.price === 84000', s.facts.price === '84000', JSON.stringify(s.facts));
  check('facts.currency === USD', s.facts.currency === 'USD');
  check('facts.availability === InStock', s.facts.availability === 'InStock');
  check('facts.sku === LRD-VEL-2026', s.facts.sku === 'LRD-VEL-2026');
  check('facts.brand === Land Rover', s.facts.brand === 'Land Rover');
  check('text contains "$84,000"', /\$84,000/.test(s.text));
  check('text preserves img alt', /coastal road/.test(s.text));
  const anchors = s.interactive.map(i => i.anchor);
  check('opt-in anchor btn.test_drive present (high)', s.interactive.some(i => i.anchor === 'btn.test_drive' && i.stability === 'high'), JSON.stringify(anchors));
  check('stable id -> #book-now selector (high)', s.interactive.some(i => i.selector === '#book-now' && i.stability === 'high'));
  check('fingerprint anchor for "Add to favorites" (low)', s.interactive.some(i => i.stability === 'low' && /favorites/.test(i.anchor)));
  check('version 1.0', s.version === '1.0');
  check('within 32KB', bytes(s) <= 32768, bytes(s) + ' bytes');
}

console.log('\n=== Velar: pricing.html (text-only, no JSON-LD) ===');
{
  const s = snapshotFor('velar-motors/pricing.html');
  check('facts is empty {}', Object.keys(s.facts).length === 0, JSON.stringify(s.facts));
  check('text has $129 per month', /\$129 per month/.test(s.text));
  check('structured_data null', s.structured_data === null);
}

console.log('\n=== Velar: contact.html (PRIVACY — form values + data-sc-private) ===');
{
  const s = snapshotFor('velar-motors/contact.html');
  const blob = JSON.stringify(s);
  check('no form input value leaks (SECRET-NAME)', !blob.includes('SECRET-NAME'));
  check('no email value leaks', !blob.includes('do-not-capture'));
  check('no card value leaks', !blob.includes('4111-SECRET'));
  check('no textarea value leaks', !blob.includes('SECRET-NOTES'));
  check('no data-sc-private content leaks', !blob.includes('SECRET-PRIVATE-BLOCK'));
  check('no private CRM button in interactive', !s.interactive.some(i => /CRM/i.test(i.label)));
  check('public address text still captured', /Fictional Drive/.test(s.text));
}

console.log('\n=== Edge: multi-jsonld.html (Product is 3rd script) ===');
{
  const s = snapshotFor('edge-lab/multi-jsonld.html');
  check('facts.price 649.99 from 3rd script', s.facts.price === '649.99', JSON.stringify(s.facts));
  check('facts.currency EUR', s.facts.currency === 'EUR');
  check('facts.availability PreOrder', s.facts.availability === 'PreOrder');
  check('structured_data is the Organization (1st script)', s.structured_data && s.structured_data['@type'] === 'Organization');
}

console.log('\n=== Edge: graph-mainentity.html (Product in @graph mainEntity) ===');
{
  const s = snapshotFor('edge-lab/graph-mainentity.html');
  check('facts.price 89 from mainEntity', s.facts.price === '89', JSON.stringify(s.facts));
  check('facts.currency GBP', s.facts.currency === 'GBP');
  check('facts.name Glacier Backpacking Stove', s.facts.name === 'Glacier Backpacking Stove');
}

console.log('\n=== Edge: malformed.html (broken 1st script, valid 2nd) ===');
{
  const s = snapshotFor('edge-lab/malformed.html');
  check('did not throw / snapshot exists', !!s);
  check('structured_data null (1st script unparseable)', s.structured_data === null);
  check('facts.price 34.50 from valid 2nd script', s.facts.price === '34.50', JSON.stringify(s.facts));
}

console.log('\n=== Edge: huge-jsonld.html (60KB JSON-LD, envelope budget) ===');
{
  const s = snapshotFor('edge-lab/huge-jsonld.html');
  check('structured_data shed to null', s.structured_data === null);
  check('facts.price 189 survived', s.facts.price === '189', JSON.stringify(s.facts));
  check('text survived', /Expedition Duffel/.test(s.text));
  check('within 32KB envelope (no 413)', bytes(s) <= 32768, bytes(s) + ' bytes');
}

console.log('\n=== Edge: cjk.html (Japanese, byte budget) ===');
{
  const s = snapshotFor('edge-lab/cjk.html');
  check('facts.price 24800 JPY', s.facts.price === '24800' && s.facts.currency === 'JPY', JSON.stringify(s.facts));
  check('price ¥24,800 survives in text head', /¥24,800/.test(s.text));
  check('within 32KB despite multibyte', bytes(s) <= 32768, bytes(s) + ' bytes');
}

console.log('\n=== Edge: injection.html (hostile anchor + prompt) ===');
{
  const s = snapshotFor('edge-lab/injection.html');
  const evilAnchor = s.interactive.find(i => /discount/i.test(i.label));
  check('hostile data-sc-anchor rejected -> fingerprint', !!evilAnchor && /^btn\./.test(evilAnchor.anchor) && !/img|onerror|"/.test(evilAnchor.anchor), evilAnchor && JSON.stringify(evilAnchor));
  check('attack text IS captured (so bot frames it untrusted)', /IGNORE ALL PREVIOUS/i.test(JSON.stringify(s)) || /SYSTEM OVERRIDE/i.test(s.text));
}

console.log('\n=== Edge: body-rooted.html (nav chrome vs interactive cap) ===');
{
  const s = snapshotFor('edge-lab/body-rooted.html');
  const labels = s.interactive.map(i => i.label);
  check('content CTA "Add to cart" present', labels.includes('Add to cart'), JSON.stringify(labels));
  check('"Schedule a fitting" present', labels.includes('Schedule a fitting'));
  check('nav menu links excluded (no "Salomon")', !labels.includes('Salomon'), JSON.stringify(labels));
  check('footer links excluded', !labels.some(l => /Footer link/.test(l)));
}

console.log('\n=== Edge: empty.html (degenerate) ===');
{
  const s = snapshotFor('edge-lab/empty.html');
  // url+title only, or null — either is acceptable "no useful content".
  const trivial = s === null || (!s.facts || Object.keys(s.facts).length === 0);
  check('no crash; trivial-or-null snapshot', trivial, JSON.stringify(s));
}

console.log('\n=== Velar: spa.html initial render (Defender) ===');
{
  const s = snapshotFor('velar-motors/spa.html');
  check('initial SPA price $62,500 (Defender)', /\$62,500/.test(s.text), s.text.slice(0, 120));
  check('title reflects Defender', /Defender/.test(s.title));
}

console.log('\n=== [1] restricted_pages — segment boundary + leading-slash ===');
{
  const { SC } = domFor('velar-motors/velar.html');
  const r = (p, list) => SC.isRestrictedPath(p, list);
  check('exact match restricts', r('/velar-motors/checkout', ['/velar-motors/checkout']));
  check('sub-path /checkout/payment restricts', r('/velar-motors/checkout/payment', ['/velar-motors/checkout']));
  check('NEIGHBOUR /checkout-deals does NOT restrict', !r('/velar-motors/checkout-deals', ['/velar-motors/checkout']));
  check('entry without leading slash still works', r('/checkout', ['checkout']));
  check('trailing slash on entry is normalized', r('/checkout/pay', ['/checkout/']));
  check('empty + non-string entries ignored', !r('/x', ['', null, 123]) && r('/x', ['', '/x']));
  check('no entries -> nothing restricted', !r('/anything', []) && !r('/anything', null));
}

console.log('\n=== [2] framework-ids — random ids rejected, stable id kept ===');
{
  const s = snapshotFor('edge-lab/framework-ids.html');
  const byLabel = (l) => s.interactive.find(i => i.label === l);
  ['Random hex id A', 'Random hex id B', 'Random hex id C'].forEach(l => {
    const it = byLabel(l);
    check(`"${l}" rejected -> fingerprint (low, no #id)`, !!it && it.stability === 'low' && !it.selector.startsWith('#'), it && JSON.stringify(it));
  });
  const trial = byLabel('Start free trial');
  check('stable "start-trial" kept as #start-trial (high)', !!trial && trial.selector === '#start-trial' && trial.stability === 'high', trial && JSON.stringify(trial));
  // Documented gap: ember-style prefix+dash id currently passes as high.
  const ember = byLabel('Ember-style id (gap)');
  check('KNOWN GAP recorded: ember-* still high (#id)', !!ember && ember.stability === 'high' && ember.selector === '#ember-1a2b3c4d', ember && JSON.stringify(ember));
}

console.log('\n=== [3] repeated-cards — each selector resolves to its own element ===');
{
  const { window, SC } = domFor('edge-lab/repeated-cards.html');
  const snap = SC.extractPageContext(window, window.document);
  const cardButtons = window.document.querySelectorAll('.card button');
  ['Buy Trail A', 'Buy Trail B', 'Buy Trail C'].forEach((label, idx) => {
    const it = snap.interactive.find(i => i.label === label);
    const resolved = it && window.document.querySelector(it.selector);
    check(`"${label}" selector targets card #${idx + 1} (not a look-alike)`, resolved === cardButtons[idx], it && it.selector);
  });
}

console.log('\n=== [4] JSON-LD variants — number price, offers array, priceSpecification ===');
{
  const s = snapshotFor('edge-lab/jsonld-variants.html');
  check('numeric price 199 coerced to string', s.facts.price === '199', JSON.stringify(s.facts));
  check('first offer of the array is used (not 249)', s.facts.price !== '249');
  check('currency USD', s.facts.currency === 'USD');
  check('availability InStock', s.facts.availability === 'InStock');
  // extractFacts direct unit shapes (signature: win, doc, data).
  const { window: w, SC } = domFor('velar-motors/velar.html');
  const facts = (shape) => SC.extractFacts(w, w.document, shape);
  check('extractFacts: price as bare number', facts({ '@type': 'Product', name: 'X', offers: { price: 500 } }).price === '500');
  check('extractFacts: offers as array', facts({ '@type': 'Product', name: 'X', offers: [{ price: '7' }, { price: '9' }] }).price === '7');
  check('extractFacts: nested priceSpecification', facts({ '@type': 'Product', name: 'X', offers: { priceSpecification: { price: '42', priceCurrency: 'BRL' } } }).price === '42');
}

console.log('\n=== [5] re-extraction after SPA navigation (click -> new snapshot) ===');
{
  const { window, SC } = domFor('velar-motors/spa.html');
  const before = SC.extractPageContext(window, window.document);
  check('before: Defender $62,500', /\$62,500/.test(before.text));
  window.document.getElementById('show-discovery').click(); // runs the page's listener
  const after = SC.extractPageContext(window, window.document);
  check('after click: re-extract shows Discovery $49,900', /\$49,900/.test(after.text), after.text.slice(0, 100));
  check('after click: url reflects pushState (/spa/discovery)', /\/spa\/discovery$/.test(after.url), after.url);
  check('content_hash changed after navigation', before.content_hash !== after.content_hash);
}

console.log('\n=== [IND-1] marketing agency, NO JSON-LD (nimbus index) ===');
{
  const s = snapshotFor('industries/nimbus-marketing/index.html');
  check('structured_data is null (no JSON-LD on page)', s.structured_data === null);
  check('facts is empty', Object.keys(s.facts).length === 0, JSON.stringify(s.facts));
  check('retainer price reachable via text ($2,500/month)', /\$2,500\/month/.test(s.text));
  check('full-funnel price in text ($9,000/month)', /\$9,000\/month/.test(s.text));
  check('CRO audit price in text ($1,800)', /\$1,800/.test(s.text));
  const cta = (s.interactive || []).find((i) => i.anchor === 'cta.strategy_call');
  check('strategy-call CTA anchored high-stability', !!cta && cta.stability === 'high');
}

console.log('\n=== [IND-2] marketing agency, WITH @type:Service (nimbus services) ===');
{
  const s = snapshotFor('industries/nimbus-marketing/services.html');
  check('Service is a commerce type → facts populated', Object.keys(s.facts).length > 0, JSON.stringify(s.facts));
  check('facts.name from Service node', s.facts.name === 'Growth Retainer — Full Funnel', s.facts.name);
  check('facts.price 2500 USD', s.facts.price === '2500' && s.facts.currency === 'USD');
  check('facts.rating 4.9', s.facts.rating === '4.9');
  check('structured_data carries the raw Service block', s.structured_data && s.structured_data['@type'] === 'Service');
}

console.log('\n=== [IND-3] SaaS pricing, @type:SoftwareApplication (cloudkeep) ===');
{
  const s = snapshotFor('industries/cloudkeep-saas/pricing.html');
  check('SoftwareApplication is NOT a commerce type → facts empty (known gap)',
    Object.keys(s.facts).length === 0, JSON.stringify(s.facts));
  check('raw structured_data still ships (agent can read offers there)',
    s.structured_data && s.structured_data['@type'] === 'SoftwareApplication');
  check('structured_data retains the three offers', Array.isArray(s.structured_data.offers) && s.structured_data.offers.length === 3);
  check('comparison table flattened into text (Team $79)', /Team\s*\$79/.test(s.text), s.text.slice(0, 200));
  check('table storage column survives flattening (2 TB)', /2 TB/.test(s.text));
  check('discount policy in text (nonprofits 50%)', /50% off/.test(s.text));
}

console.log('\n=== [IND-4] restaurant, @type:Restaurant (luna bistro) ===');
{
  const s = snapshotFor('industries/luna-bistro/index.html');
  check('Restaurant is NOT a commerce type → facts empty', Object.keys(s.facts).length === 0, JSON.stringify(s.facts));
  check('structured_data carries Restaurant block (priceRange $$)',
    s.structured_data && s.structured_data['@type'] === 'Restaurant' && s.structured_data.priceRange === '$$');
  check('menu price in text (ossobuco $34)', /Ossobuco.*\$34/.test(s.text));
  check('wine policy in text (corkage $25)', /Corkage \$25/.test(s.text));
  const reserve = (s.interactive || []).find((i) => i.anchor === 'cta.reserve');
  check('reserve CTA anchored high-stability', !!reserve && reserve.stability === 'high');
}

console.log('\n=== [IND-5] dental clinic, NO JSON-LD + privacy (harborlight) ===');
{
  const s = snapshotFor('industries/harborlight-dental/index.html');
  check('structured_data is null', s.structured_data === null);
  check('facts is empty', Object.keys(s.facts).length === 0);
  check('service price in text (cleaning $120)', /cleaning — \$120/i.test(s.text));
  check('membership price in text ($29/month)', /\$29\/month/.test(s.text));
  check('data-sc-private patient block NOT in text (no PAT-99231)', !/PAT-99231/.test(s.text));
  check('no patient name leaked from private block or form values', !/Maria Quintana/.test(s.text), s.text.slice(0, 150));
  check('no insurance member id leaked', !/BCBS-883-2210/.test(s.text));
  const appt = (s.interactive || []).find((i) => i.anchor === 'cta.request_appointment');
  check('request-appointment CTA anchored', !!appt && appt.stability === 'high');
}

console.log('\n' + '='.repeat(50));
console.log(`RESULT: ${pass} passed, ${fail} failed`);
if (fail) { console.log('\nFAILURES:'); failures.forEach(f => console.log('  - ' + f)); process.exit(1); }
