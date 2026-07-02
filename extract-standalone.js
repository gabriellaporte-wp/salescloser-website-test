/**
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
    const MAX_TEXT = 8000;
    const MAX_STRUCTURED_DATA = 256 * 1024;
    const OWN_IFRAME_SELECTOR = 'iframe[src*="/embedded-agent/"]';

    // Forward-compatible snapshot schema version (consumers tolerate added fields).
    const DOC_VERSION = '1.0';

    // Budget with margin under the bot's 32 KB cap; an over-budget snapshot is
    // rejected whole, so fitToBudget sheds fields until the doc fits.
    const MAX_DOC_BYTES = 28 * 1024;

    // Sites often put Organization/Breadcrumb first and the Product in a later script.
    const MAX_LD_SCRIPTS = 10;

    // Distilled facts (price, currency, …) pulled deterministically from JSON-LD.
    const MAX_FACTS = 20;
    const MAX_FACT_LENGTH = 200;

    // Addressable interactive elements (buttons/links/CTAs) the agent can reference.
    const MAX_INTERACTIVE = 30;
    const MAX_LABEL_LENGTH = 120;
    const INTERACTIVE_SELECTOR =
        'a[href],button,[role="button"],[role="link"],[role="tab"],' +
        'input[type="button"],input[type="submit"]';
    // Anchors are agent-facing identifiers; keep them to a safe, predictable shape.
    const ANCHOR_PATTERN = /^[a-z][a-z0-9_.]{0,63}$/;
    // Privacy / visibility opt-outs — interactive elements under these are skipped.
    const PRIVATE_SELECTOR =
        '[data-sc-private],[data-sc-no-context],[data-sc-redact],[aria-hidden="true"],[hidden]';

    // Stripped before reading text: non-content nodes, form fields (typed values
    // must never leak), and the data-sc-private / no-context / redact opt-outs.
    const NOISE_SELECTOR =
        'script,style,svg,iframe,img,video,nav,header,footer,aside,noscript,' +
        'input,textarea,select,option,' +
        '[data-sc-private],[data-sc-no-context],[data-sc-redact],' +
        '[aria-hidden="true"],[hidden]';

    /**
     * djb2 — non-crypto, for cheap change detection. Masked to a 32-bit unsigned
     * int so the base36 string stays positive and stable.
     */
    function hashString(str) {
        let h = 5381;
        for (let i = 0; i < str.length; i++) {
            h = (((h << 5) + h) + str.charCodeAt(i)) & 0xffffffff;
        }
        return (h >>> 0).toString(36);
    }

    /**
     * A path is restricted when it equals an entry or sits beneath it on a segment
     * boundary — `/checkout` covers `/checkout/payment`, not `/checkoutish`; a typed
     * `checkout` is normalized to `/checkout`. Enforced here because only the
     * loader can read the host path: the rule is "no content extracted", not "not sent".
     */
    function isRestrictedPath(pathname, restrictedPaths) {
        if (!Array.isArray(restrictedPaths) || restrictedPaths.length === 0) return false;
        return restrictedPaths.some((entry) => {
            if (typeof entry !== 'string' || entry === '') return false;
            const prefix = (entry[0] === '/' ? entry : `/${entry}`).replace(/\/+$/, '');
            return pathname === prefix || pathname.indexOf(`${prefix}/`) === 0;
        });
    }

    /** Read a cleaned snapshot of the current page, or `null` if there's nothing worth sending. */
    function extractPageContext() {
        let url = '';
        try {
            url = location.origin + location.pathname;
        } catch (e) {
            url = (location && location.href) ? location.href.split('?')[0] : '';
        }

        const title = (document.title || '').trim();
        const lang = ((document.documentElement && document.documentElement.lang) || '').trim();

        let description = '';
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) description = (metaDesc.getAttribute('content') || '').trim();

        const h1El = document.querySelector('h1');
        const h1 = h1El ? (h1El.textContent || '').trim() : '';

        let structuredData = null;
        try {
            const ld = document.querySelector('script[type="application/ld+json"]');
            if (ld && ld.textContent && ld.textContent.length <= MAX_STRUCTURED_DATA) {
                structuredData = JSON.parse(ld.textContent);
            }
        } catch (e) {
            structuredData = null;
        }

        const root = document.querySelector('main')
            || document.querySelector('[role="main"]')
            || document.querySelector('article')
            || document.body;
        let text = '';
        if (root) {
            const clone = root.cloneNode(true);
            const mediaText = collectMediaText(clone);
            const noise = clone.querySelectorAll(NOISE_SELECTOR);
            for (let i = 0; i < noise.length; i++) {
                if (noise[i] && noise[i].parentNode) noise[i].parentNode.removeChild(noise[i]);
            }
            text = `${clone.textContent || ''} ${mediaText}`.replace(/\s+/g, ' ').trim();
        }

        text = truncateHeadAndTail(text);

        if (!url && !title && !text) return null;

        const doc = fitToBudget({
            version: DOC_VERSION,
            url,
            title,
            lang,
            description,
            h1,
            structured_data: structuredData,
            facts: extractFacts(collectLdJsonDocs()),
            interactive: extractInteractive(root),
            text,
        });
        // Hash after fitting, so the dedup hash describes what is actually sent.
        doc.content_hash = hashString(`${doc.url}|${doc.title}|${doc.text}`);
        doc.captured_at = Math.floor(Date.now() / 1000);
        return doc;
    }

    /** All parseable JSON-LD blocks on the page, bounded in count and per-script size. */
    function collectLdJsonDocs() {
        const docs = [];
        let scripts;
        try {
            scripts = document.querySelectorAll('script[type="application/ld+json"]');
        } catch (e) {
            return docs;
        }
        for (let i = 0; i < scripts.length && docs.length < MAX_LD_SCRIPTS; i++) {
            const raw = scripts[i] && scripts[i].textContent;
            if (!raw || raw.length > MAX_STRUCTURED_DATA) continue;
            try {
                docs.push(JSON.parse(raw));
            } catch (e) {
                /* skip malformed script */
            }
        }
        return docs;
    }

    function docByteSize(doc) {
        const json = JSON.stringify(doc);
        if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(json).length;
        // No TextEncoder (ancient WebView): over-count at the 3-bytes-per-char
        // BMP worst case — shrinking too eagerly beats blowing the bot's cap.
        return json.length * 3;
    }

    /**
     * Shed lowest-value fields until the serialized snapshot fits the bot's
     * envelope cap: raw structured_data goes first (facts already distill the
     * commerce essentials), then interactive entries, then the text shrinks.
     */
    function fitToBudget(doc) {
        if (docByteSize(doc) <= MAX_DOC_BYTES) return doc;
        doc.structured_data = null;
        if (docByteSize(doc) <= MAX_DOC_BYTES) return doc;
        while (doc.interactive.length && docByteSize(doc) > MAX_DOC_BYTES) doc.interactive.pop();
        let max = MAX_TEXT;
        while (doc.text.length > 500 && docByteSize(doc) > MAX_DOC_BYTES) {
            max = Math.floor(max / 2);
            doc.text = truncateHeadAndTail(doc.text, max);
        }
        return doc;
    }

    /**
     * Distill a flat, human-readable facts map (price, currency, availability, …)
     * from one JSON-LD block or a list of them. Deterministic — no model involved —
     * and defensive: malformed or absent commerce data yields an empty map rather
     * than throwing.
     */
    function extractFacts(structuredData) {
        const docs = Array.isArray(structuredData) ? structuredData : [structuredData];
        let node = null;
        for (let i = 0; i < docs.length && !node; i++) node = findCommerceNode(docs[i]);
        if (!node) return {};

        const facts = {};
        addFact(facts, 'name', node.name);
        addFact(facts, 'brand', node.brand && (node.brand.name || node.brand));
        addFact(facts, 'sku', node.sku);

        const offer = node.offers && (Array.isArray(node.offers) ? node.offers[0] : node.offers);
        if (offer && typeof offer === 'object') {
            const spec = offer.priceSpecification || {};
            addFact(facts, 'price', offer.price != null ? offer.price : spec.price);
            addFact(facts, 'currency', offer.priceCurrency || spec.priceCurrency);
            addFact(facts, 'availability', schemaTail(offer.availability));
        }

        const rating = node.aggregateRating;
        if (rating && typeof rating === 'object') addFact(facts, 'rating', rating.ratingValue);

        return facts;
    }

    /** Find the first Product/Offer-like node in JSON-LD (object, array, @graph, or mainEntity). */
    function findCommerceNode(data, depth) {
        if (!data || typeof data !== 'object' || (depth || 0) > 4) return null;
        const candidates = Array.isArray(data) ? data : (Array.isArray(data['@graph']) ? data['@graph'] : [data]);
        for (let i = 0; i < candidates.length; i++) {
            const node = candidates[i];
            if (!node || typeof node !== 'object') continue;
            if (isCommerceType(node['@type']) && (node.name || node.offers || node.sku)) return node;
            const nested = findCommerceNode(node.mainEntity, (depth || 0) + 1);
            if (nested) return nested;
        }
        return null;
    }

    function isCommerceType(type) {
        const types = Array.isArray(type) ? type : [type];
        return types.some((t) => typeof t === 'string' && /(Product|Offer|Vehicle|Service)/i.test(t));
    }

    /** Keep only primitive values, trimmed and capped, up to the facts limit. */
    function addFact(facts, key, value) {
        if (value == null || Object.keys(facts).length >= MAX_FACTS) return;
        if (typeof value !== 'string' && typeof value !== 'number') return;
        const text = String(value).trim();
        if (text) facts[key] = text.slice(0, MAX_FACT_LENGTH);
    }

    /** "https://schema.org/InStock" → "InStock". */
    function schemaTail(value) {
        if (typeof value !== 'string') return value;
        const parts = value.split(/[/#]/);
        return parts[parts.length - 1];
    }

    /**
     * Collect addressable interactive elements (buttons, links, CTAs) with a stable
     * anchor + real selector, so the agent can later reference, highlight, or scroll
     * to a specific control. Capped, de-duplicated, and privacy-filtered; the anchor
     * never reaches the visitor — it only lets the agent speak about the right element.
     */
    function extractInteractive(root) {
        if (!root || typeof root.querySelectorAll !== 'function') return [];

        const items = [];
        const seen = {};
        const candidates = root.querySelectorAll(INTERACTIVE_SELECTOR);
        for (let i = 0; i < candidates.length && items.length < MAX_INTERACTIVE; i++) {
            const el = candidates[i];
            if (el.closest && el.closest(PRIVATE_SELECTOR)) continue;
            // Mirror the text pipeline's structural strip — otherwise header/nav
            // chrome exhausts the cap before the content CTA on body-rooted pages.
            if (el.closest && el.closest('nav,header,footer,aside')) continue;
            const label = interactiveLabel(el);
            if (!label) continue;
            const anchor = resolveAnchor(el, label);
            if (seen[anchor.value]) continue;
            seen[anchor.value] = true;
            items.push({
                anchor: anchor.value,
                role: interactiveRole(el),
                label,
                selector: anchor.selector,
                stability: anchor.stability,
            });
        }
        return items;
    }

    function interactiveLabel(el) {
        const raw = (el.getAttribute && el.getAttribute('aria-label'))
            || el.textContent
            || (el.getAttribute && el.getAttribute('value'))
            || '';
        return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL_LENGTH);
    }

    function interactiveRole(el) {
        const explicit = el.getAttribute && el.getAttribute('role');
        // ARIA fallback lists resolve to the first token; clamp to the API cap.
        if (explicit) return explicit.trim().split(/\s+/)[0].slice(0, 32);
        return el.tagName === 'A' ? 'link' : 'button';
    }

    /**
     * Three-tier anchor resolution: an opt-in `data-sc-anchor` or a stable DOM `id`
     * is trusted ("high"); otherwise we fingerprint role + label ("low"), which the
     * agent should verify before acting on. Always pairs the anchor with a real CSS
     * selector pointing at the element.
     */
    function resolveAnchor(el, label) {
        const explicit = el.getAttribute && el.getAttribute('data-sc-anchor');
        if (explicit && ANCHOR_PATTERN.test(explicit)) {
            return { value: explicit, selector: `[data-sc-anchor="${cssEscape(explicit)}"]`, stability: 'high' };
        }

        const prefix = el.tagName === 'A' ? 'lnk' : 'btn';
        const id = el.getAttribute && el.getAttribute('id');
        if (id && isStableId(id)) {
            return { value: `${prefix}.${slugify(id)}`, selector: `#${cssEscape(id)}`, stability: 'high' };
        }

        return { value: `${prefix}.${slugify(label)}`, selector: cssPath(el), stability: 'low' };
    }

    /** Reject random-looking ids (framework-generated) so anchors stay meaningful. */
    function isStableId(id) {
        if (id.length > 64 || !/^[A-Za-z][\w-]*$/.test(id)) return false;
        return !/^[a-z]*[0-9a-f]{6,}$/i.test(id);
    }

    function slugify(text) {
        const slug = String(text).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
        return slug || 'item';
    }

    function cssEscape(value) {
        if (typeof window !== 'undefined' && window.CSS && typeof window.CSS.escape === 'function') {
            return window.CSS.escape(value);
        }
        return String(value).replace(/["\\\]]/g, '\\$&');
    }

    /**
     * A structural selector (tag + nth-of-type), built to 4 levels and then
     * extended one ancestor at a time until it resolves back to the element
     * itself — so a low-stability selector never silently targets a structural
     * lookalike elsewhere in the document. Capped ~900 chars to stay under the
     * server's 1024-char validation limit.
     */
    function cssPath(el) {
        const segments = [];
        let node = el;
        while (node && node.tagName) {
            const id = node.getAttribute && node.getAttribute('id');
            if (id && isStableId(id)) {
                segments.unshift(`#${cssEscape(id)}`);
                break;
            }
            const tag = node.tagName.toLowerCase();
            const index = nthOfType(node);
            segments.unshift(index ? `${tag}:nth-of-type(${index})` : tag);
            node = node.parentElement;
            const path = segments.join(' > ');
            if (segments.length >= 4 && (resolvesToSelf(path, el) || path.length > 900)) break;
        }
        return segments.join(' > ');
    }

    /** True when the composed path resolves back to the element itself (or cannot be verified). */
    function resolvesToSelf(path, el) {
        if (typeof document === 'undefined' || !document.querySelector) return true;
        try {
            return document.querySelector(path) === el;
        } catch (e) {
            return true;
        }
    }

    function nthOfType(node) {
        if (!node.parentElement) return 0;
        const siblings = node.parentElement.children;
        let index = 0;
        for (let i = 0; i < siblings.length; i++) {
            if (siblings[i].tagName === node.tagName) {
                index++;
                if (siblings[i] === node) return index;
            }
        }
        return index;
    }

    /** Keep head and tail, drop the middle — so a price up top and a CTA at the foot both survive the cap. */
    function truncateHeadAndTail(text, max = MAX_TEXT) {
        if (text.length <= max) return text;
        const head = text.slice(0, Math.floor(max * 0.7));
        const tail = text.slice(text.length - Math.floor(max * 0.3));
        return `${head} […] ${tail}`;
    }

    /**
     * Images/SVGs are stripped from the text, but their `alt` / `aria-label` /
     * `<title>` often carry real content — collect it before the strip.
     */
    function collectMediaText(node) {
        const parts = [];
        const media = node.querySelectorAll('img[alt], svg[aria-label], svg title');
        for (let i = 0; i < media.length; i++) {
            const el = media[i];
            const label = (el.getAttribute && (el.getAttribute('alt') || el.getAttribute('aria-label'))) || el.textContent || '';
            const trimmed = label.trim();
            if (trimmed) parts.push(trimmed);
        }
        return parts.join(' ');
    }

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
