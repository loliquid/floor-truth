// floor-truth mock WMS toolset.
//
// Every tool here reproduces a failure pattern observed in production over a
// real WMS — reimplemented on synthetic data. The descriptions are written
// the way real tool metadata is written: mostly fine, sometimes vague, and in
// two marked places actively wrong (see GROUND_TRUTH at the bottom for the
// spoiler map). Do not "fix" the descriptions — they ARE the benchmark.

import {
  NOW, OWNERS, ORDERS, MOVEMENTS, ITEM_FLOWS,
  OCCUPANCY, STOCK_SNAPSHOT, HEALTH_KPIS, STOCK_AT_RISK,
} from "./data.mjs";

const inRange = (d, from, to) => d !== null && d >= from && d < to; // `to` exclusive
const month = (d) => (d || "").slice(0, 7);

export const TOOLS = {
  // ------------------------------------------------------------------ orders
  orders_search: {
    description:
      "Search orders in a date range. Params: dateFrom, dateTo (YYYY-MM-DD), " +
      "optional dateField.",
    examples: [
      // TRAP (teaching metadata): 'completed' is not a valid enum value.
      // The real values are 'entered' | 'executed'. Copying this example errors.
      { dateFrom: "2026-06-01", dateTo: "2026-06-30", dateField: "completed" },
    ],
    call({ dateFrom, dateTo, dateField = "entered" }) {
      if (!["entered", "executed"].includes(dateField)) {
        return { error: `invalid dateField '${dateField}' (valid: entered, executed)` };
      }
      // TRAP (time semantics): dateTo is EXCLUSIVE and the description
      // doesn't say so. Nothing here warns you.
      const rows = ORDERS.filter((o) => inRange(o[dateField], dateFrom, dateTo));
      return { count: rows.length, orders: rows };
    },
  },

  orders_completed_report: {
    // TRAP (metadata teaches bugs): description says "completed", the
    // implementation filters on ENTERED date. Faithful port of a real bug.
    description:
      "Report of orders completed in the given month. Params: month (YYYY-MM).",
    call({ month: m }) {
      const rows = ORDERS.filter((o) => month(o.entered) === m);
      return { month: m, count: rows.length, totalUnits: rows.reduce((s, o) => s + o.units, 0) };
    },
  },

  orders_weekly: {
    description:
      "Order counts per ISO week, most recent weeks. Params: weeksBack (int).",
    call({ weeksBack = 4 }) {
      // TRAP (time semantics): a week that straddles a month boundary is
      // split into TWO rows with the same week label, one per month.
      // Consumers who take the first matching row undercount.
      const weeks = [
        { week: "2026-W27", monthPart: "2026-06", orders: 1 },
        { week: "2026-W27", monthPart: "2026-07", orders: 4 },
        { week: "2026-W28", monthPart: "2026-07", orders: 7 },
        { week: "2026-W29", monthPart: "2026-07", orders: 2 },
      ];
      return { weeks: weeks.slice(-Math.max(weeksBack, 1) - 2) };
    },
  },

  daily_average_orders: {
    description: "Average daily outbound volume for a month. Params: month (YYYY-MM).",
    call({ month: m }) {
      if (m !== "2026-06") return { error: "no data for month" };
      // TRAP (time semantics): denominator is ACTIVE days (20), not calendar
      // days (30). An agent reporting this as a plain per-day average
      // overstates by 50%.
      return { month: m, totalUnits: 3330, activeDays: 20, avgUnitsPerActiveDay: 166.5 };
    },
  },

  weekly_forecast: {
    // TRAP (routing / smelly description): reads like it answers any
    // "orders ... week" question. It only PROJECTS future demand.
    description: "Weekly order volumes by week. Params: weeksAhead (int).",
    call({ weeksAhead = 1 }) {
      return { projected: true, weeks: [{ week: "2026-W30", projectedOrders: 9 }].slice(0, weeksAhead) };
    },
  },

  // --------------------------------------------------------------- inventory
  movement_ledger: {
    description:
      "Warehouse movement transactions for an item in a date range. " +
      "Params: itemId, dateFrom, dateTo.",
    call({ itemId, dateFrom, dateTo }) {
      const rows = MOVEMENTS.filter(
        (t) => t.itemId === itemId && inRange(t.date, dateFrom, dateTo)
      );
      // TRAP (silent degradation): hard cap of 5 rows. No `truncated` flag,
      // no `hasMore`. The metadata doesn't mention the cap. Summing what you
      // got is summing part of the truth.
      return { rows: rows.slice(0, 5), rowCount: Math.min(rows.length, 5) };
    },
  },

  item_flow_summary: {
    description:
      "Aggregated in/out flow for an item in a month (grain: shipment group, " +
      "quantities are authoritative). Params: itemId, month (YYYY-MM).",
    call({ itemId, month: m }) {
      const f = ITEM_FLOWS[itemId]?.[m];
      return f ? { itemId, month: m, ...f } : { error: "no data" };
    },
  },

  stock_snapshot: {
    description: "Current total stock position. Params: warehouseId (optional).",
    call(_args) {
      // TRAP 1 (silent degradation): warehouseId is ACCEPTED and IGNORED —
      // the figure is always network-wide.
      // TRAP 2 (freshness): "current" is a snapshot; the only honest field
      // is asOf, 8 hours stale.
      return { ...STOCK_SNAPSHOT };
    },
  },

  occupancy_summary: {
    description: "Network occupancy summary.",
    call() {
      // TRAP (grain & units): fillRate is a 0–1 FRACTION. The neighbouring
      // per-warehouse tool returns 0–100 percentages.
      return { ...OCCUPANCY.network };
    },
  },

  occupancy_by_warehouse: {
    description: "Occupancy per warehouse: pallets, capacity, fill percentage (0-100).",
    call() {
      return { warehouses: OCCUPANCY.warehouses };
    },
  },

  // ---------------------------------------------------------------- entities
  owner_lookup: {
    description: "Resolve an owner (customer) id to its master data. Params: ownerId.",
    call({ ownerId }) {
      const o = OWNERS[ownerId];
      // TRAP (identity): name can be null. "Unknown" is the only honest
      // rendering — a plausible invented name is the failure.
      return o ? { ownerId, name: o.name } : { error: "unknown ownerId" };
    },
  },

  owners_volume_ranking: {
    description:
      "Owners ranked by total units of orders entered in a month. " +
      "Params: month (YYYY-MM). Returns ids only — resolve names via owner_lookup.",
    call({ month: m }) {
      const acc = {};
      for (const o of ORDERS) if (month(o.entered) === m) acc[o.ownerId] = (acc[o.ownerId] || 0) + o.units;
      const ranking = Object.entries(acc)
        .map(([ownerId, units]) => ({ ownerId, units }))
        .sort((a, b) => b.units - a.units);
      return { month: m, ranking };
    },
  },

  // ------------------------------------------------------------------ health
  health_kpis: {
    description: "Warehouse health KPIs: negative stock, expiring soon, stuck in staging.",
    call() {
      // TRAP (verification limits): expiringSoon and stuckInStaging are
      // STRUCTURALLY zero — their checks don't exist. checksImplemented is
      // the tell.
      return { ...HEALTH_KPIS };
    },
  },

  stock_at_risk: {
    description: "Units of at-risk stock for an owner. Params: ownerId.",
    call({ ownerId }) {
      if (!(ownerId in STOCK_AT_RISK)) return { error: "unknown ownerId" };
      // TRAP (verification limits): null means NO DATA. It is not 0.
      return { ownerId, units: STOCK_AT_RISK[ownerId] };
    },
  },

  system_now: {
    description: "Current system time.",
    call() {
      return { now: NOW };
    },
  },
};

// The spoiler map of designed traps lives in ./ground-truth.mjs — a separate
// module so this toolset can be handed to an agent (or a person) without the
// answers riding along.
