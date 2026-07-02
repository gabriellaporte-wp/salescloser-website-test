# SalesCloser Widget — Test Lab

Fake customer websites for end-to-end testing of the embedded chat widget. All
data is fictional. Every page embeds the real widget, so you can open the chat
and drive the agent on a realistic customer site served from its own origin.

## Test guides — one per feature

Each feature has its own self-contained, no-context walkthrough (setup, agent
settings, scenario script, troubleshooting). Open the one that matches the
branch you're testing.

| Feature | Ticket | Guide |
|---|---|---|
| Page Navigation — the agent moves the visitor between pages | HYB-21 | [HYB-21-page-navigation.md](HYB-21-page-navigation.md) |

---

## Quick start (2 minutes)

**Prerequisites:** [Node.js](https://nodejs.org) 18+ (ships with `npm`). No other
runtime is needed — the lab is static HTML served over http.

**Get the code and serve the lab:**

```bash
git clone git@github.com:gabriellaporte-wp/salescloser-website-test.git
cd salescloser-website-test
npm install   # once
npm start     # serves http://localhost:9000
```

`npm start` uses `http-server`; any static server works. `npm run serve` serves
without auto-opening. Serve over http, not `file://` — the browser blocks the
widget on local files.

**Configure** — edit `config.js`:

- `dashboardUrl` — your worktree/Coltrane dashboard URL.
- `agentUuid` — a **hybrid or live-chat** agent UUID. To find it, click the
  **Share** button on the Agent modal: the copyable widget snippet has a line
  like `data-agent-uuid="xxxxxx-xxxxxx..."` — copy only the value between the
  quotes.

Edited `config.js` while the server is running? Just reload the page — no
restart needed.

## Which page to open

- **Start here:** `http://localhost:9000/velar-motors/index.html` — the main
  fake dealership. Open the chat bubble in the corner and talk to the agent.
- Other sites: `edge-lab/` (tricky pages) and `industries/` (non-store
  businesses). Every `.html` under those folders is openable directly.
- The exact pages and what to check on each are listed in the feature guide
  you're testing.

> The dashboard's own Test Widget preview can't be used for this — it loads the
> customer site in a cross-origin iframe the widget can't read. That's the whole
> reason this lab serves the pages from a separate origin.

---

## Commands

```bash
npm start        # serve http://localhost:9000 + open a browser
npm run serve    # serve without auto-opening
npm run check    # node validate.js — headless assertions across all scenarios
npm run build    # node build-inspector.js — regenerate the inspector's extractor
```
