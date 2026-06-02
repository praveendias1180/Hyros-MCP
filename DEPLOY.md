# Deploying the Hyros MCP remote connector (operator guide)

This is the **remote** deployment that lets non-technical clients add Hyros to
Claude with zero installation — they just paste a URL and their Hyros API key.

The remote server lives in [`worker/`](worker/) and runs on **Cloudflare
Workers**. It reuses 100% of the tool/client logic in [`src/`](src/); the only
difference from the local (stdio) version is the transport and the OAuth layer
that collects each client's API key.

```
Claude Desktop ──(Streamable HTTP + OAuth)──▶ Cloudflare Worker ──(API-Key header)──▶ Hyros API
                                              │
                          OAuthProvider (workers-oauth-provider)
                          • /authorize  → 1-field "paste your API key" page (worker/auth.ts)
                          • /token, /register, /.well-known/*  → handled automatically
                          • HyrosMCP Durable Object (worker/mcp.ts) = the MCP server
                          • OAUTH_KV = stores client registrations + encrypted grants
```

The client's Hyros API key is captured on the `/authorize` page, verified
against Hyros, then encrypted into the OAuth access token (delivered as
`this.props.apiKey` inside the Durable Object). It is **not** stored in plain
text and never touches the client's machine.

---

## Architecture / files

| File | Role |
|------|------|
| `wrangler.jsonc` | Worker config: Durable Object (`MCP_OBJECT`/`HyrosMCP`), `OAUTH_KV`, `nodejs_compat`, `ai` alias |
| `worker/index.ts` | Wires `OAuthProvider` and exports the `HyrosMCP` Durable Object |
| `worker/mcp.ts` | `HyrosMCP` extends `McpAgent`; registers the 38 tools + resources + prompts |
| `worker/auth.ts` | The `/authorize` API-key page + completes the OAuth grant |
| `worker/stubs/ai.ts` | Tiny stub so the unused Vercel AI SDK isn't bundled |

---

## One-time setup

### 1. Cloudflare API token

Create an API token at https://dash.cloudflare.com/profile/api-tokens with these
**Account** permissions (all **Edit** level):

- **Workers Scripts** → Edit
- **Workers KV Storage** → Edit
- **Account Settings** → Read

Then export it (or `wrangler login` for browser OAuth instead):

```bash
export CLOUDFLARE_API_TOKEN=your_token_here
```

> In this repo the token is read from `.env.local` (`CLOUDFLRARE_API_KEY`).
> `.env.local` is gitignored — never commit it.

### 2. Create the KV namespace (already done once)

```bash
npx wrangler kv namespace create OAUTH_KV
```

Copy the returned `id` into the `kv_namespaces` block in `wrangler.jsonc`.
(Current value: `6c432eefa916402484aafc5de2f0d5ff`.)

---

## Deploy / update

```bash
npm install
export CLOUDFLARE_API_TOKEN=...   # or rely on .env.local
npm run worker:deploy             # = wrangler deploy
```

Live URL: **https://hyros-mcp.caragon.workers.dev**
Clients add: **https://hyros-mcp.caragon.workers.dev/mcp**

Validate a build without deploying:

```bash
npm run worker:check              # wrangler deploy --dry-run
```

Local dev:

```bash
npm run worker:dev                # wrangler dev
```

---

## Smoke tests

```bash
# Health page
curl -s -o /dev/null -w "%{http_code}\n" https://hyros-mcp.caragon.workers.dev/        # 200

# OAuth discovery (Claude reads this)
curl -s https://hyros-mcp.caragon.workers.dev/.well-known/oauth-authorization-server

# MCP endpoint refuses unauthenticated calls
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  https://hyros-mcp.caragon.workers.dev/mcp \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'                       # 401
```

---

## Notes & gotchas

- **`ai` alias** — the `agents` runtime lazy-imports the Vercel AI SDK in a code
  path we never hit (`getAITools`). `wrangler.jsonc` aliases `ai` to
  `worker/stubs/ai.ts` so it isn't bundled. If you remove the alias the build
  fails with `Could not resolve "ai"`.
- **`.js` import specifiers** — `worker/*` imports `../src/*.js`; esbuild
  resolves these to the `.ts` sources automatically. Keep the `.js` extension to
  stay consistent with the npm-package build (`tsc`).
- **npm package build is unaffected** — `tsconfig.json` only includes `src/**`,
  so `npm run build` / publishing the stdio version ignores `worker/`.
- **Custom domain (optional)** — to serve from `mcp.carlosaragon.online` instead
  of `*.workers.dev`, add a `routes` entry in `wrangler.jsonc` and a DNS record;
  then give clients the custom URL. The OAuth issuer updates automatically.
- **Rotating a client's key** — the client just re-runs Add custom connector (or
  reconnects) and pastes the new key. Nothing to resend.
