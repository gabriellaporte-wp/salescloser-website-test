# SalesCloser Widget — Test Lab

Fake customer websites for end-to-end testing of the embedded chat widget
features. All data is fictional. Two ways to use it:

1. **Inspector** (`inspector.html`) — shows the **exact JSON snapshot** the loader
   produces for any page, side-by-side with the page. No bot needed. This is how
   you compare "what the JSON abstracted" against "what's on the page".
2. **Live embed** — every page also embeds the real widget, so once your bot is
   running the right feature branch you can open the chat and drive the agent.

## Test guides — one per feature

Each feature has its own self-contained, no-context walkthrough. Start with the
one that matches the branch you're testing.

| Feature | Ticket | Guide |
|---|---|---|
| Page Awareness — the agent reads the current page | HYB-20 | [HYB-20-page-awareness.md](HYB-20-page-awareness.md) |
| Page Navigation — the agent moves the visitor between pages | HYB-21 | [HYB-21-page-navigation.md](HYB-21-page-navigation.md) |

Each guide is standalone: it covers the branch it needs, the agent settings, the
scenario script, and troubleshooting. The rest of this README is the shared lab
setup they all build on.

---

## Quick start (2 minutes)

**Prerequisites:** [Node.js](https://nodejs.org) 18+ (ships with `npm`). No other
runtime is needed — the lab is static HTML served over http.

**Get the code and serve the lab:**

```bash
git clone git@github.com:gabriellaporte-wp/salescloser-website-test.git
cd salescloser-website-test
npm install   # once
npm start     # serves http://localhost:9000 and opens the inspector
```

`npm start` uses `http-server`; any static server works. `npm run serve` serves
without auto-opening. Serving over http matters: the inspector reads an iframe's
document, which the browser blocks under `file://`.

**Configure** — edit `config.js`:

- `dashboardUrl` — your worktree/Coltrane dashboard URL.
- `agentUuid` — a **hybrid or live-chat** agent UUID. To find it, click the
  **Share** button on the Agent modal: the copyable widget snippet has a line
  like `data-agent-uuid="xxxxxx-xxxxxx..."` — copy only the value between the
  quotes.

Edited `config.js` while the server is running? Just reload the page — no
restart needed. The per-feature agent settings and the bot branch each guide
needs are documented in that guide.

> The dashboard's own Test Widget preview can't be used for this — it loads the
> customer site in a cross-origin iframe the loader can't read. That's the whole
> reason this lab serves the pages from a separate origin.

---

## How the Inspector stays honest

The extractor the Inspector uses (`extract-standalone.js`) is **sliced verbatim
from the shipped loader** (`resources/js/embedded/page-awareness.js`) — what you
see is exactly what production sends. Regenerate it with `npm run build`, then
re-run `npm run check`.

---

## Files

```
config.js                 # dashboardUrl + agentUuid (edit this)
inspector.html            # side-by-side page vs JSON
extract-standalone.js     # GENERATED — real loader extraction surface
build-inspector.js        # regenerates the above from the shipped loader
validate.js               # headless jsdom assertions (npm run check)
shared/                   # embed.js (injects the FAB loader), style.css
velar-motors/             # Site 1: dealership — happy path, privacy, SPA, mutation, restricted
edge-lab/                 # Site 2: JSON-LD edge cases, budget, hostile, body-rooted, degenerate
industries/               # Site 3+: marketing agency, SaaS, restaurant, dental — with/without JSON-LD
```

## Commands
```bash
npm start        # serve http://localhost:9000 + open the inspector
npm run serve    # serve without auto-opening
npm run check    # node validate.js — 104 headless assertions, all scenarios
npm run build    # node build-inspector.js — re-slice extractor from the shipped loader
```
