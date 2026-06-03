import type { Tool } from '@modelcontextprotocol/sdk/types.js';

// Human-friendly display names shown by MCP clients (e.g. Claude's tool list
// and permission settings). The programmatic `name` stays unchanged; `title`
// is purely for display.
export const TOOL_TITLES: Record<string, string> = {
  // Read-only
  hyros_get_user_info: 'Account Info',
  hyros_get_leads: 'Get Leads',
  hyros_get_lead_journey: 'Lead Journey',
  hyros_get_sales: 'Get Sales',
  hyros_get_calls: 'Get Calls',
  hyros_get_subscriptions: 'Get Subscriptions',
  hyros_get_clicks: 'Get Clicks',
  hyros_get_tags: 'Get Tags',
  hyros_get_stages: 'Get Funnel Stages',
  hyros_get_domains: 'Get Domains',
  hyros_get_sources: 'Get Ad Sources',
  hyros_get_ads: 'Get Ads',
  hyros_get_keywords: 'Get Keywords',
  hyros_get_tracking_script: 'Get Tracking Script',
  hyros_get_attribution_report: 'Attribution Report',
  hyros_get_ad_account_report: 'Ad Account Report',
  hyros_best_performers: 'Best Performers',
  hyros_compare_periods: 'Compare Periods',
  hyros_daily_summary: 'Daily Summary',
  hyros_funnel_overview: 'Funnel Overview',
  hyros_subscription_health: 'Subscription Health',

  // Write / delete
  hyros_create_lead: 'Create Lead',
  hyros_update_lead: 'Update Lead',
  hyros_create_order: 'Create Order',
  hyros_refund_order: 'Refund Order',
  hyros_update_sale: 'Update Sale',
  hyros_delete_sale: 'Delete Sale',
  hyros_create_call: 'Create Call',
  hyros_update_call: 'Update Call',
  hyros_delete_call: 'Delete Call',
  hyros_create_subscription: 'Create Subscription',
  hyros_update_subscription: 'Update Subscription',
  hyros_create_source: 'Create Ad Source',
  hyros_create_custom_cost: 'Add Custom Cost',
  hyros_create_product: 'Create Product',
  hyros_create_cart: 'Create Cart',
  hyros_update_cart: 'Update Cart',
  hyros_create_click: 'Create Click',
};

/**
 * Derive a readable title from a tool name as a fallback
 * (e.g. `hyros_create_call` → `Create Call`).
 */
function deriveTitle(name: string): string {
  return name
    .replace(/^hyros_/, '')
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Returns copies of the given tools with a display `title` set both at the top
 * level and on `annotations.title` (for client compatibility), without mutating
 * the originals or dropping existing annotations.
 */
export function withTitles(tools: Tool[]): Tool[] {
  return tools.map((tool) => {
    const title = TOOL_TITLES[tool.name] ?? deriveTitle(tool.name);
    return {
      ...tool,
      title,
      annotations: { ...tool.annotations, title },
    };
  });
}
