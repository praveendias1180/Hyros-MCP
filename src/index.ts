#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { HyrosClient } from './client.js';
import { readTools, handleReadTool } from './tools/reads.js';
import { writeTools, handleWriteTool } from './tools/writes.js';
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
    name: 'hyros-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  },
);

// ─── All Tools ─────────────────────────────────────────────────────────────

const allTools = withTitles([...readTools, ...writeTools, ...compoundTools]);

const readToolNames = new Set(readTools.map((t) => t.name));
const writeToolNames = new Set(writeTools.map((t) => t.name));
const compoundToolNames = new Set(compoundTools.map((t) => t.name));

// ─── Tool Handlers ─────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: allTools,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  const toolArgs = args as Record<string, unknown>;

  try {
    let result: unknown;

    if (readToolNames.has(name)) {
      result = await handleReadTool(name, toolArgs, client);
    } else if (writeToolNames.has(name)) {
      result = await handleWriteTool(name, toolArgs, client);
    } else if (compoundToolNames.has(name)) {
      result = await handleCompoundTool(name, toolArgs, client);
    } else {
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

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

// ─── Resources ─────────────────────────────────────────────────────────────

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

// ─── Prompts ───────────────────────────────────────────────────────────────

const prompts = [
  {
    name: 'daily_briefing',
    description: 'Get a complete daily performance briefing for your Hyros account',
    arguments: [
      {
        name: 'date',
        description: 'Date in YYYY-MM-DD format (defaults to today)',
        required: false,
      },
      {
        name: 'timezone',
        description: 'Timezone offset (e.g., -05:00 for EST)',
        required: false,
      },
    ],
  },
  {
    name: 'campaign_analysis',
    description: 'Analyze the performance of your ad campaigns for a given period',
    arguments: [
      {
        name: 'fromDate',
        description: 'Start date in ISO 8601 format',
        required: true,
      },
      {
        name: 'toDate',
        description: 'End date in ISO 8601 format',
        required: true,
      },
      {
        name: 'platform',
        description: 'Specific platform to analyze (FACEBOOK, GOOGLE, etc.) — leave empty for all',
        required: false,
      },
    ],
  },
  {
    name: 'lead_lookup',
    description: 'Investigate everything about a specific lead: their profile, purchase history, call history, and ad attribution journey',
    arguments: [
      {
        name: 'email',
        description: 'Lead email address',
        required: false,
      },
      {
        name: 'leadId',
        description: 'Lead ID',
        required: false,
      },
    ],
  },
];

server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts,
}));

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: promptArgs = {} } = request.params;

  switch (name) {
    case 'daily_briefing': {
      const date = (promptArgs.date as string | undefined) ?? new Date().toISOString().split('T')[0];
      const timezone = (promptArgs.timezone as string | undefined) ?? '+00:00';
      return {
        description: `Daily performance briefing for ${date}`,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please give me a complete daily performance briefing for my Hyros account for ${date} (timezone: ${timezone}).

Use the hyros_daily_summary tool to get today's data, then provide:
1. Revenue summary: total revenue, ad spend, ROAS, ROI
2. Lead acquisition: how many new leads came in
3. Sales performance: number of sales
4. Call team performance (if any calls happened): total calls, qualification rate
5. Top performing ads: which ads drove the most revenue
6. Key insights and recommendations based on the data

Be concise but comprehensive. Use clear formatting with sections.`,
            },
          },
        ],
      };
    }

    case 'campaign_analysis': {
      const fromDate = promptArgs.fromDate as string;
      const toDate = promptArgs.toDate as string;
      const platform = promptArgs.platform as string | undefined;
      return {
        description: `Campaign performance analysis from ${fromDate} to ${toDate}`,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please analyze my Hyros ad campaign performance from ${fromDate} to ${toDate}${platform ? ` for ${platform}` : ''}.

Use these tools to get comprehensive data:
1. hyros_best_performers (rankBy: "revenue") — get top performing ads by revenue
2. hyros_best_performers (rankBy: "roas") — get top performing ads by ROAS
3. hyros_compare_periods — compare this period vs the previous equivalent period
4. hyros_get_ad_account_report — get account-level breakdown

Then provide:
- Overall performance summary (revenue, cost, ROAS, ROI)
- Best performing ads and why they worked
- Worst performing ads (high cost, low ROAS) — candidates for pausing
- Comparison with previous period (trend analysis)
- Specific actionable recommendations: what to scale, what to pause, what to test

Format with clear sections and use tables where helpful.`,
            },
          },
        ],
      };
    }

    case 'lead_lookup': {
      const email = promptArgs.email as string | undefined;
      const leadId = promptArgs.leadId as string | undefined;
      const identifier = email ? `email: ${email}` : leadId ? `ID: ${leadId}` : 'unknown';
      return {
        description: `Lead investigation for ${identifier}`,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please investigate everything about the lead with ${identifier} in my Hyros account.

Steps:
1. Use hyros_get_leads to find the lead${email ? ` (search by email: "${email}")` : leadId ? ` (search by id: "${leadId}")` : ''}
2. Once you have their lead ID, use hyros_get_lead_journey to get their complete journey
3. Use hyros_get_clicks to see their click history

Then provide a complete profile:
- Basic info: email, phone, join date, tags, current stage
- Purchase history: all sales with amounts and products
- Call history: any sales calls and their outcomes
- Ad attribution: which ads brought them in (first touch and last touch)
- Total revenue generated from this lead
- Timeline of their customer journey

Be thorough and organized.`,
            },
          },
        ],
      };
    }

    default:
      return {
        description: `Unknown prompt: ${name}`,
        messages: [
          {
            role: 'user',
            content: { type: 'text', text: `Prompt "${name}" not found.` },
          },
        ],
      };
  }
});

// ─── Start Server ──────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Hyros MCP server running on stdio');
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await server.close();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await server.close();
  process.exit(0);
});

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
