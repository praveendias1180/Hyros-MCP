#!/usr/bin/env node
/**
 * Gravity read-only entrypoint.
 *
 * This file is OWNED BY THE GRAVITY FORK — it does not exist upstream
 * (CachoMX/Hyros-MCP). It is a deliberately self-contained copy of the
 * stdio server wiring from `src/index.ts` with the 17 write tools removed,
 * so `git merge upstream/main` never conflicts on the upstream files.
 *
 * It registers ONLY the read (16) + smart-analytics/compound (5) tools and
 * the three read-only resources. The write tools (`writeTools`) are never
 * imported, never listed, and never routed — they are uncallable here. A
 * belt-and-suspenders allowlist guard in the CallTool handler rejects any
 * tool name that is not on the read/compound allowlist, so a future upstream
 * tool is excluded by default (fail-safe) until we vet it.
 *
 * Why a separate file (not a patch to index.ts): keeps our diff to a single
 * new file so pulling upstream updates stays conflict-free. See
 * gravity_docs/docs/platform/mcp/hyros-mcp-server.md.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { HyrosClient } from './client.js';
import { readTools, handleReadTool } from './tools/reads.js';
import { compoundTools, handleCompoundTool } from './tools/compound.js';
import { withTitles } from './tools/titles.js';

// ─── Configuration ─────────────────────────────────────────────────────────

const apiKey = process.env.HYROS_API_KEY;
if (!apiKey) {
  console.error('Error: HYROS_API_KEY environment variable is required.');
  process.exit(1);
}

const baseUrl = process.env.HYROS_BASE_URL ?? 'https://api.hyros.com/v1';

let client: HyrosClient;
try {
  client = new HyrosClient(apiKey, baseUrl);
} catch (error) {
  console.error(`Error: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}

// ─── Server Setup ──────────────────────────────────────────────────────────

const server = new Server(
  {
    name: 'hyros-mcp-readonly',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  },
);

// ─── Read-only tool surface (reads + analytics only; writes excluded) ────────

const allTools = withTitles([...readTools, ...compoundTools]);

const readToolNames = new Set(readTools.map((t) => t.name));
const compoundToolNames = new Set(compoundTools.map((t) => t.name));
const allowedToolNames = new Set([...readToolNames, ...compoundToolNames]);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: allTools,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  const toolArgs = args as Record<string, unknown>;

  // Fail-safe allowlist: anything not explicitly read/compound is refused,
  // so write tools (and any future upstream tool) can never be invoked here.
  if (!allowedToolNames.has(name)) {
    return {
      content: [
        {
          type: 'text',
          text: `Tool "${name}" is not available in this read-only deployment.`,
        },
      ],
      isError: true,
    };
  }

  try {
    const result = readToolNames.has(name)
      ? await handleReadTool(name, toolArgs, client)
      : await handleCompoundTool(name, toolArgs, client);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// ─── Resources (all read-only) ───────────────────────────────────────────────

const resources = [
  {
    uri: 'hyros://account',
    name: 'Hyros Account Info',
    description: 'Current Hyros account information including timezone and currency settings',
    mimeType: 'application/json',
  },
  {
    uri: 'hyros://tags',
    name: 'Hyros Tags',
    description: 'All available tags in the Hyros account. Product tags start with $, source tags with @, action tags with !',
    mimeType: 'application/json',
  },
  {
    uri: 'hyros://stages',
    name: 'Hyros Funnel Stages',
    description: 'All lead funnel stages configured in the Hyros account',
    mimeType: 'application/json',
  },
];

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources,
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  try {
    let data: unknown;

    if (uri === 'hyros://account') {
      data = await client.getUserInfo();
    } else if (uri === 'hyros://tags') {
      data = await client.getTags();
    } else if (uri === 'hyros://stages') {
      data = await client.getStages({});
    } else {
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({ error: `Unknown resource: ${uri}` }),
          },
        ],
      };
    }

    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({ error: message }),
        },
      ],
    };
  }
});

// ─── Start ───────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Hyros MCP (Gravity read-only) server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
