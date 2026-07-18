// SPOILERS. The designed traps of the mock WMS, in one place — for graders,
// case authors, and the patterns/ documentation. Deliberately isolated from
// tools.mjs so the toolset can be distributed to an agent under test without
// the answers riding along. Agents under test must never be shown this file.

export const GROUND_TRUTH = {
  "orders_search":           ["dateTo exclusive (undocumented)", "dateField defaults to 'entered'", "example uses invalid enum 'completed'"],
  "orders_completed_report": ["description says completed, code filters entered"],
  "orders_weekly":           ["month-straddling ISO week splits into two rows"],
  "daily_average_orders":    ["denominator is active days, not calendar days"],
  "weekly_forecast":         ["projection tool with a description that smells historical"],
  "movement_ledger":         ["silent 5-row cap, no truncation flag"],
  "stock_snapshot":          ["warehouseId accepted and ignored", "8h-stale snapshot presented as current"],
  "occupancy_summary":       ["fillRate is 0-1 fraction; sibling tool uses 0-100"],
  "owner_lookup":            ["name can be null — inventing one is the failure"],
  "health_kpis":             ["expiringSoon/stuckInStaging structurally zero"],
  "stock_at_risk":           ["null = no data, not zero"],
};
