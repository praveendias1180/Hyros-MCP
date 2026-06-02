import type { AuthRequest, OAuthHelpers } from '@cloudflare/workers-oauth-provider';
import { HyrosClient } from '../src/client.js';
import type { HyrosProps } from './mcp.js';

type Env = {
  OAUTH_PROVIDER: OAuthHelpers;
  HYROS_BASE_URL?: string;
};

// ─── HTML rendering ──────────────────────────────────────────────────────────

function page(body: string): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Connect Hyros</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: #0f1115; color: #e6e8eb; padding: 24px;
  }
  .card {
    width: 100%; max-width: 420px; background: #1a1d23; border: 1px solid #2a2e37;
    border-radius: 16px; padding: 32px; box-shadow: 0 12px 40px rgba(0,0,0,.4);
  }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p.sub { margin: 0 0 24px; color: #9aa0aa; font-size: 14px; line-height: 1.5; }
  label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 8px; }
  input[type="password"], input[type="text"] {
    width: 100%; padding: 12px 14px; border-radius: 10px; border: 1px solid #2a2e37;
    background: #0f1115; color: #e6e8eb; font-size: 15px; font-family: ui-monospace, monospace;
  }
  input:focus { outline: none; border-color: #5b8cff; }
  button {
    margin-top: 20px; width: 100%; padding: 13px; border: none; border-radius: 10px;
    background: #5b8cff; color: #fff; font-size: 15px; font-weight: 600; cursor: pointer;
  }
  button:hover { background: #4a7bf0; }
  .err { background: #3a1d22; border: 1px solid #6e2b34; color: #ffb3bd;
    padding: 12px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 20px; }
  .hint { margin-top: 16px; font-size: 12px; color: #6b7280; line-height: 1.5; }
  a { color: #8ab0ff; }
</style>
</head>
<body><div class="card">${body}</div></body>
</html>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

function formPage(encodedReq: string, clientName: string, error?: string): Response {
  return page(`
    <h1>Connect your Hyros account</h1>
    <p class="sub">${escapeHtml(clientName)} wants to access your Hyros data. Paste your Hyros API key to authorize. Nothing else is required.</p>
    ${error ? `<div class="err">${escapeHtml(error)}</div>` : ''}
    <form method="POST" action="/authorize">
      <input type="hidden" name="oauth_req" value="${escapeHtml(encodedReq)}" />
      <label for="api_key">Hyros API Key</label>
      <input type="password" id="api_key" name="api_key" placeholder="Paste your key here" autocomplete="off" autofocus required />
      <button type="submit">Connect</button>
    </form>
    <p class="hint">Find your key in Hyros → Settings → Integrations → API. It is stored encrypted and only used to reach the Hyros API on your behalf.</p>
  `);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── OAuth request (de)serialization across the GET → POST round trip ──────────

function encodeReq(req: AuthRequest): string {
  return btoa(JSON.stringify(req));
}

function decodeReq(encoded: string): AuthRequest {
  return JSON.parse(atob(encoded)) as AuthRequest;
}

async function userIdFromKey(apiKey: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(apiKey));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

// ─── Handler ───────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/authorize' && request.method === 'GET') {
      const oauthReq = await env.OAUTH_PROVIDER.parseAuthRequest(request);
      const client = await env.OAUTH_PROVIDER.lookupClient(oauthReq.clientId);
      const clientName = client?.clientName || 'An MCP client';
      return formPage(encodeReq(oauthReq), clientName);
    }

    if (url.pathname === '/authorize' && request.method === 'POST') {
      const form = await request.formData();
      const encodedReq = String(form.get('oauth_req') ?? '');
      const apiKey = String(form.get('api_key') ?? '').trim();

      let oauthReq: AuthRequest;
      try {
        oauthReq = decodeReq(encodedReq);
      } catch {
        return new Response('Invalid authorization request.', { status: 400 });
      }

      if (!apiKey) {
        return formPage(encodedReq, 'An MCP client', 'Please paste your Hyros API key.');
      }

      // Verify the key works before issuing a token, so the client gets
      // immediate feedback instead of failing later inside Claude.
      const baseUrl = env.HYROS_BASE_URL ?? 'https://api.hyros.com/v1';
      try {
        const hyros = new HyrosClient(apiKey, baseUrl);
        await hyros.getUserInfo();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not verify the API key.';
        return formPage(encodedReq, 'An MCP client', `That key didn't work: ${message}`);
      }

      const props: HyrosProps = { apiKey };
      const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
        request: oauthReq,
        userId: await userIdFromKey(apiKey),
        metadata: {},
        scope: oauthReq.scope ?? [],
        props,
      });

      return Response.redirect(redirectTo, 302);
    }

    if (url.pathname === '/' || url.pathname === '/health') {
      return page('<h1>Hyros MCP</h1><p class="sub">This is a remote MCP server. Add it as a custom connector in Claude using this URL.</p>');
    }

    return new Response('Not found', { status: 404 });
  },
};
