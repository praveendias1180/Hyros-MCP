import { OAuthProvider } from '@cloudflare/workers-oauth-provider';
import { HyrosMCP } from './mcp.js';
import authHandler from './auth.js';

// The Durable Object class must be exported from the Worker entrypoint so the
// `MCP_OBJECT` binding in wrangler.jsonc can resolve it.
export { HyrosMCP };

export default new OAuthProvider({
  apiRoute: '/mcp',
  // Streamable HTTP MCP endpoint, backed by the HyrosMCP Durable Object.
  apiHandler: HyrosMCP.serve('/mcp') as any,
  // Everything else (the API-key authorization page, health check) is handled here.
  defaultHandler: authHandler as any,
  authorizeEndpoint: '/authorize',
  tokenEndpoint: '/token',
  clientRegistrationEndpoint: '/register',
});
