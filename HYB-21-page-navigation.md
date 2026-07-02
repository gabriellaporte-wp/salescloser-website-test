# HYB-21 — Page Navigation — test guide

A step-by-step walkthrough that assumes no prior context. It uses the same Velar
Motors fake site as the Page Awareness lab: every page embeds the real floating
widget, so the agent can actually move you between pages during a conversation.

---

## 1. What is this? (30 seconds)

Page Awareness gave the agent **eyes** (it reads the page the visitor is looking
at). Page Navigation gives it **legs**: mid-conversation, it can **take the
visitor to another page of the same site** — over voice or text.

The whole flow is spoken/typed, with no clickable button or link:

1. The visitor asks something ("how much does it cost?").
2. The agent **announces** the intent as a statement, not a question:
   *"I'll take you to our Pricing Page now — just say 'no thanks' if you'd rather
   stay."*
3. If the visitor **accepts** ("yes", "sure", "take me there"), the browser
   navigates on its own. If they **decline** ("no thanks", "stay here"), the
   agent stays and keeps talking.
4. The conversation **continues where it left off** on the new page — history is
   never lost.

### Three terms you'll see constantly

- **Config drawer**: the "More Settings" panel on the dashboard's Test Widget
  page, where the feature is turned on and pages are registered.
- **Allowlist / Blocklist**: the "scope". Allowlist = the agent may only
  suggest/visit the registered pages. Blocklist = it may go to any page of the
  site EXCEPT the registered ones. These are the only two modes — the page list
  is what teaches the agent about the site, so a list always exists.
- **Test site (Velar Motors)**: a fictional dealership with 8 pages on different
  topics, built solely for these tests.

---

## 2. What you need open (ask the dev if something is missing)

| What | Where | For what |
|---|---|---|
| Local dashboard | `https://localhost` | Configuring the agent |
| Velar Motors fake site | `http://localhost:9000/velar-motors/index.html` | Chatting and being navigated for real |
| Bot on the HYB-21 branch | (the dev brings it up) | The brain that decides to navigate |

The bot must be running the HYB-21 branch
(`gabriellaporte3121/sc-74650/hyb-21-page-navigation`).

---

## 3. Bringing up the test site (~2 min, first time only)

You already know how to bring up the dashboard and the bot — this section covers
only the fake site.

**Requirements:** Node.js installed (any recent version; `node -v` should
respond).

1. Open a terminal in the project folder:
   ```sh
   cd ~/work/salescloser/salescloser-website-test
   ```
2. First time only, install the dependencies:
   ```sh
   npm install
   ```
3. Check `config.js` in the project root — it has two editable values:
   - `dashboardUrl`: must point at the dashboard running the HYB-21 branch,
     e.g. `'https://localhost'`.
   - `agentUuid`: the UUID of the Hybrid / Live Chat agent you configure in
     section 4. (It's in the URL of that agent's Test Widget page.)
4. Start the server:
   ```sh
   npm run serve
   ```
   It keeps running in that terminal (stop it with `Ctrl+C`). Open
   `http://localhost:9000/velar-motors/index.html` — the page should load with
   the chat bubble in the corner. If the bubble doesn't appear, `dashboardUrl`
   is wrong or the dashboard isn't up.

> Edited `config.js` while the server is running? No need to restart anything —
> just reload the page in the browser.

---

## 4. Configuring the agent (~3 min)

1. Open `https://localhost/test-widget?edit=1` and click **More Settings**.
2. In the **Page Navigation** section (right below Page Awareness):
   - Turn on the **Page Navigation** toggle.
   - Leave **Always confirm before navigating** on (this is the default: the
     agent always waits for a "yes" before navigating).
   - Under **Page scope**, choose **Allowlist**.
3. Register the pages below (use "Add page" manually, or **Import from sitemap**
   and adjust). The **card order is the priority** — drag to reorder. The
   **Label** is what the agent calls the page out loud; the **Description** is
   what it uses to decide when to suggest it.

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

4. **Important:** click **Save** in the bottom bar (the drawer alone does not
   save).

### Testing Import from sitemap

The test site publishes a real sitemap at `http://localhost:9000/sitemap.xml`
(needs the server from section 3 running):

1. In the drawer, click **Import from sitemap**.
2. Paste `http://localhost:9000/sitemap.xml` into the field and click **Fetch**.
   The dashboard fetches it server-side — the SSRF guard allows localhost only
   when `APP_ENV=local`.
3. The list of all ten site pages should appear (as paths, e.g.
   `/velar-motors/pricing.html`).
4. Select a few and click **Add selected** — they become cards in the list, with
   the label auto-derived from the path (you can edit it).
5. Error cases worth checking: a URL that doesn't exist
   (`http://localhost:9000/nothing.xml`) should show an error message, not hang.

---

## 5. Test script

Always start on `http://localhost:9000/velar-motors/index.html`, open the chat,
and use **a fresh conversation** for each scenario (new-conversation button in
the widget).

| # | Do this | Expected |
|---|---|---|
| 1 | Ask *"how much does the service plan cost?"* | The agent **states** (not asks) that it will take you to the Pricing Page and offers the way out ("just say no thanks…"). **No link or button may appear.** |
| 2 | Reply *"yes"* | The browser navigates to the pricing page on its own and **the chat reopens with the full history intact**. |
| 3 | Trigger another suggestion (*"can I finance the car?"*) and reply *"no thanks"* | The agent acknowledges ("no problem…"), **stays on the page**, and keeps talking. It doesn't immediately re-push the same page. |
| 4 | Ignore a suggestion and send some other message | The agent may re-offer **exactly once**, then drops the subject. |
| 5 | Ask *"what pages can you show me?"* | It lists the registered pages **out loud** (the labels), with no links. |
| 6 | Ask something ambiguous (*"my car needs some work"*) | Between Service and Trade-In, the **higher card in the list** should win — test by dragging the order and repeating. |
| 7 | Turn the Pricing card off, save, new conversation, repeat scenario 1 | The Pricing Page is **never** suggested. With **all** cards off, no navigation is suggested at all. |
| 8 | Switch scope to **Blocklist** with `/velar-motors/checkout` listed, then ask *"take me to the checkout"* | The agent **refuses/stays** — checkout is blocked (the tool rejects it server-side, including `?promo=x` / `#top` / `/../checkout` variants). Other pages stay reachable. |
| 9 | Escalate to a **call** (voice) and accept a suggestion verbally | Navigation happens over the LiveKit data channel and **the call survives** the page load (reconnects on its own within a few seconds, 60s rejoin grace). |

---

## 6. Expected behaviors that are NOT bugs

- **On the dashboard's own Test Widget page, navigation is suppressed by
  design** — otherwise the dashboard tab itself would navigate away. There the
  would-be destination is only logged to the browser console. Real navigation
  happens here in the lab (or any real embed).
- **The agent only navigates within its own site.** It never sends the visitor
  to another domain, even if asked.
- **There is no literal 5-second-of-silence timer** from the PRD: text has no
  "silence", and on voice the agent re-offers once alongside the normal
  inactivity reminders. This is an implementation decision recorded in the PRs.
- **The exact phrasing varies.** The announcement ("I'll take you to…") is
  instruction-guided, not fixed text — small wording variations are normal; what
  must hold is: a statement + an option to decline + nothing clickable.
- **Plain phone and standalone web-call don't have the feature** — only the
  embedded widgets (Hybrid / Live Chat), because it's the visitor's browser that
  navigates.

---

## 7. Found something odd? Report it like this

1. The **scenario** (row number from the table above) and the **exact phrase**
   you sent.
2. What the agent **replied** (a chat screenshot helps).
3. If it navigated: **where to**, and whether the history was preserved.
4. The drawer configuration at that moment (scope, card order, toggles).

With those four items a dev can reproduce the case in minutes.
