# Hyros MCP Server

[![npm version](https://img.shields.io/npm/v/hyros-mcp.svg)](https://www.npmjs.com/package/hyros-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Connect [Hyros](https://hyros.com) advertising attribution to AI assistants (Claude, Cursor, etc.) through the [Model Context Protocol](https://modelcontextprotocol.io). Ask questions about your leads, sales, calls, subscriptions, and ad performance — and let the AI pull the data and run the reports for you.

**38 tools** covering leads, sales, calls, subscriptions, attribution reports, ad management, and smart analytics.

Built by [Carlos Aragon](https://carlosaragon.online).

---

## 🚀 Install in 60 seconds (recommended — no downloads, no setup)

You only need the **Claude app** (desktop or web). Nothing to install. No terminal. No Node.js. No config files.

1. Open **Claude** → **Settings** → **Connectors**.
2. Click **Add custom connector**.
3. Paste this address and click **Add**:

   ```
   https://hyrosmcp.callwithcarlos.com/mcp
   ```

4. A small page opens in your browser asking for your **Hyros API key**.
   Get it from **Hyros → Settings → Integrations → API**, paste it, and click **Connect**.
5. Done ✅ — Hyros now shows up in Claude's tools. Try asking *"What was my revenue today?"*

That's the whole thing. Your key is checked the moment you paste it (so you know
right away if it's wrong) and is stored **encrypted on the server** — it never
lives on your computer, and you never edit any files.

### Controlling what the AI can do (permissions)

Inside Claude, every tool can be set to:

- **Always allow** — runs without asking (great for read-only reports and lookups)
- **Ask every time** — Claude asks for your approval before each use
- **Blocked** — never runs

You'll find these in the connector's settings in Claude. The tools that *change*
data (create a lead, refund an order, etc.) are flagged so Claude asks first by default.

### How it works (the short version)

```
You (Claude app)  ──▶  hyrosmcp.callwithcarlos.com  ──▶  Hyros API
                       (a secure hosted server)
```

There's a small server running in the cloud (on Cloudflare) that speaks to Hyros
on your behalf. When you connect, it asks for your API key once, verifies it, and
keeps it encrypted. From then on, when you ask Claude a question, Claude talks to
that server, which fetches your real Hyros data and hands it back. You don't host
or maintain anything.

> **For developers / self-hosters:** the server lives in [`worker/`](worker/) and
> runs on Cloudflare Workers. See [DEPLOY.md](DEPLOY.md) to deploy your own copy.

---

## Alternative — Run it locally (advanced / developers)

Prefer to run the server on your own machine instead of using the hosted one?
This uses the npm package and Claude Desktop's local config. You'll need Node.js 18+.

### Step 1 — Install the package

Open a terminal and run:

```bash
npm install -g hyros-mcp
```

This works on **Windows, macOS, and Linux**.

### Step 2 — Add to Claude Desktop

Open your Claude Desktop config file:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Add this (replace `your_api_key_here` with your key from **Hyros → Settings → Integrations → API**):

```json
{
  "mcpServers": {
    "hyros": {
      "command": "hyros-mcp",
      "args": [],
      "env": {
        "HYROS_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

### Step 3 — Restart Claude Desktop

Close and reopen Claude Desktop. That's it — you're ready to use it.

---

### Claude Code (CLI)

```bash
npm install -g hyros-mcp
claude mcp add hyros -e HYROS_API_KEY=your_api_key_here -- hyros-mcp
```

### Cursor / Windsurf

Same config as Claude Desktop above — add it to your MCP settings file.

---

## Troubleshooting

### Remote connector (the 60-second install)

**"That key didn't work" when you paste it** — The key is wrong, expired, or
lacks permissions. Copy it again, exactly, from **Hyros → Settings →
Integrations → API**. The page tells you immediately if it's valid.

**Hyros tools don't appear in Claude** — Make sure you finished the browser step
(pasting the key and clicking **Connect**). Re-open **Settings → Connectors** and
confirm Hyros is listed and connected.

**Need to change your API key later** — Just disconnect and re-add the connector
(or reconnect) and paste the new key. Nothing else to update.

### Local install

**"401 Unauthorized"** — Your API key is wrong or missing. Make sure:
1. `HYROS_API_KEY` is inside the `env` block
2. The key is copied exactly from Hyros → Settings → Integrations → API
3. You restarted Claude Desktop after saving the config

**MCP tools not showing up** — Restart Claude Desktop. The config is only read at startup.

**"command not found: hyros-mcp"** — The global install didn't complete. Run `npm install -g hyros-mcp` again and make sure npm's global bin folder is in your PATH.

## Configuration

| Variable | Required | Description |
|---|---|---|
| `HYROS_API_KEY` | Yes | Your Hyros API key (Settings > Integrations > API) |
| `HYROS_BASE_URL` | No | API base URL (default: `https://api.hyros.com/v1`) |

## Tools

### Read Operations (16)

| Tool | Description |
|---|---|
| `hyros_get_user_info` | Account information |
| `hyros_get_leads` | Search and retrieve leads |
| `hyros_get_lead_journey` | Full customer journey with attribution |
| `hyros_get_sales` | Query sales records |
| `hyros_get_calls` | Query call records |
| `hyros_get_subscriptions` | Query subscriptions |
| `hyros_get_clicks` | Get click history for a lead |
| `hyros_get_tags` | List all tags |
| `hyros_get_stages` | List funnel stages |
| `hyros_get_domains` | List verified domains |
| `hyros_get_sources` | Get ad sources and campaigns |
| `hyros_get_ads` | Get ads by platform |
| `hyros_get_keywords` | Get keywords by ad group |
| `hyros_get_tracking_script` | Get tracking script HTML |
| `hyros_get_attribution_report` | Attribution metrics (ROAS, ROI, CPA, etc.) |
| `hyros_get_ad_account_report` | Account-level attribution metrics |

### Write Operations (17)

| Tool | Description |
|---|---|
| `hyros_create_lead` | Create a new lead |
| `hyros_update_lead` | Update lead data and tags |
| `hyros_create_order` | Register a sale/order |
| `hyros_refund_order` | Process a refund |
| `hyros_update_sale` | Update sale status |
| `hyros_delete_sale` | Delete a sale |
| `hyros_create_call` | Register a call event |
| `hyros_update_call` | Update call qualification |
| `hyros_delete_call` | Delete a call |
| `hyros_create_subscription` | Create subscription |
| `hyros_update_subscription` | Update subscription |
| `hyros_create_source` | Create ad source |
| `hyros_create_custom_cost` | Add custom ad cost |
| `hyros_create_product` | Create product |
| `hyros_create_cart` | Track a shopping cart |
| `hyros_update_cart` | Update pending cart |
| `hyros_create_click` | Manually record a click |

### Smart Analytics (5)

| Tool | Description |
|---|---|
| `hyros_daily_summary` | Today's performance: revenue, leads, calls, subscriptions |
| `hyros_best_performers` | Top ads/campaigns ranked by any metric |
| `hyros_compare_periods` | Compare metrics between two date ranges |
| `hyros_funnel_overview` | Full funnel from leads to revenue |
| `hyros_subscription_health` | MRR, ARR, churn, and subscription breakdown |

## Resources

| URI | Description |
|---|---|
| `hyros://account` | Account information |
| `hyros://tags` | Available tags |
| `hyros://stages` | Funnel stages |

## Prompts

| Name | Description |
|---|---|
| `daily_briefing` | Daily performance summary |
| `campaign_analysis` | Campaign performance analysis |
| `lead_lookup` | Investigate a specific lead |

## Example Questions

Once connected, you can ask things like:

- "What was my revenue today?"
- "Show me my best performing Facebook ads this month"
- "Compare last week vs this week"
- "Look up the customer journey for john@example.com"
- "What's my current MRR?"
- "Which campaigns have the highest ROAS?"
- "Create a lead with email test@example.com and tag them as VIP"

## Security

- HTTPS-only connections (API key never sent over plaintext)
- Domain-restricted to `*.hyros.com` (prevents SSRF)
- Runtime input validation on all tool parameters
- Request timeouts (30s) with retry logic
- Client-side rate limiting (25 req/sec)
- Path traversal prevention on URL parameters

## Development

```bash
git clone https://github.com/CachoMX/Hyros-MCP.git
cd Hyros-MCP
npm install
cp .env.example .env    # Add your API key
npm run build           # Compile TypeScript (local/stdio version)
npm run dev             # Run in development mode
npm test                # Run tests
```

### Remote server (Cloudflare Worker)

The hosted connector lives in [`worker/`](worker/) and reuses all the tool logic
in [`src/`](src/). It adds a Streamable HTTP transport plus an OAuth layer that
collects each user's Hyros API key on a single-field page.

```bash
npm run worker:check    # Validate the bundle (wrangler dry-run, no deploy)
npm run worker:dev      # Local dev server (wrangler dev)
npm run worker:deploy   # Deploy to Cloudflare
```

Full operator instructions — Cloudflare token scopes, KV setup, custom domain —
are in [DEPLOY.md](DEPLOY.md).

## License

MIT - [Carlos Aragon](https://carlosaragon.online)
