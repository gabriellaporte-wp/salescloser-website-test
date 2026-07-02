# Page Navigation (HYB-21) — test guide

Uses the same Velar Motors fake site as the Page Awareness lab. Every page embeds the real
floating widget, so the agent can move you between them.

## 1. Serve the lab

```sh
npm run serve            # http://localhost:9000
```

Point `config.js` at the dashboard running the HYB-21 branch:

```js
dashboardUrl: 'https://localhost',
```

The bot process must be running the HYB-21 branch (`gabriellaporte3121/sc-74650/hyb-21-page-navigation`).

## 2. Configure the agent

Test Widget page (`https://localhost/test-widget?edit=1`) → More Settings → **Page Navigation**:

- Page Navigation: **on** · Always confirm before navigating: **on** · Page scope: **Allowlist**
- Pages (drag order = priority; paths are as served by the lab):

| Path | Label | Description |
|---|---|---|
| `/velar-motors/pricing.html` | Pricing Page | Service plans and monthly pricing |
| `/velar-motors/financing.html` | Financing Page | Leases, loans, APR, trade-in credit |
| `/velar-motors/test-drive.html` | Test Drive Page | Booking a test drive, showroom or at home |
| `/velar-motors/service.html` | Service Center Page | Maintenance and repair prices, booking a service slot |
| `/velar-motors/trade-in.html` | Trade-In Page | Instant appraisal and trade-in credit for the current car |
| `/velar-motors/warranty.html` | Warranty Page | Coverage durations, what's included, how to claim |
| `/velar-motors/about.html` | About Page | Dealership story, reviews, no-commission sales team |
| `/velar-motors/contact.html` | Contact Page | Showroom address, phone, opening hours |

Save with the appearance bar's **Save** button.

### Sitemap import

The lab serves a real sitemap at `http://localhost:9000/sitemap.xml` listing all ten pages.
In the drawer, **Import from sitemap** → paste that URL → **Fetch** → select pages → **Add
selected**; labels are derived from the paths. The dashboard fetches it server-side — the
SSRF guard allows localhost only when `APP_ENV=local`.

## 3. Walk the acceptance criteria

Start on `http://localhost:9000/velar-motors/index.html` and open the widget.

1. **Suggest + accept** — ask *"how much does the service plan cost?"* → the agent should state
   (not ask) *"I'll take you to our Pricing Page now — just say no thanks if you'd rather stay"*,
   with no clickable link. Reply *"yes"* → the browser navigates to the pricing page and the
   widget reopens with the conversation intact.
2. **Decline** — trigger another suggestion (e.g. *"can I finance the car?"*), reply
   *"no thanks"* → the agent acknowledges and stays.
3. **Priority** — make a vague ask that matches several pages (*"I want to know more before
   buying"*) → the highest card in the list should win.
4. **List pages** — ask *"what pages can you show me?"* → verbal list of the four labels.
5. **Disabled page** — toggle the Pricing card off, save, new conversation → pricing must never
   be suggested; all cards off → no suggestions at all.
6. **Blocklist** — switch scope to Blocklist with `/velar-motors/checkout` listed → ask to be
   taken to checkout → the agent must refuse/stay (the tool rejects it server-side, including
   `?promo=x` / `#top` / `/../checkout` variants).
7. **Mid-call (voice)** — escalate to a call, accept a suggestion verbally → navigation happens
   via the LiveKit data channel and the call survives the page load (60s rejoin grace).

## Caveats

- On the dashboard's own Test Widget page navigation is **suppressed by design** (it would
  navigate the dashboard tab); the would-be destination is logged to the console instead. Real
  navigation only happens here in the lab (or any real embed).
- Conversation history persists per agent in the widget iframe's localStorage; use the widget's
  "new conversation" to reset between scenarios.
