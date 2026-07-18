// The reference adapter: a scripted agent that knows the traps and answers
// every case correctly. It exists to prove the benchmark is FAIR — every case
// has a reachable correct answer using only the tools as exposed. It is also
// executable documentation of what "correct" looks like per family.
//
// It is NOT an LLM and it is NOT the bar: it was written with knowledge of
// GROUND_TRUTH. A real agent earns its score without that knowledge.

const t = (tools, name) => tools.find((x) => x.name === name);

export default async function reference({ prompt, tools }) {
  const p = prompt.toLowerCase();

  if (/expect|should we/.test(p) && /week/.test(p)) {
    const r = t(tools, "weekly_forecast").call({ weeksAhead: 1 });
    const w = r.weeks[0];
    return { answer: `Forecast: about ${w.projectedOrders} orders projected for ${w.week}. This is an estimate, not history.` };
  }

  if (/last week/.test(p)) {
    // Last full week before 2026-07-18 = Mon Jul 6 .. Sun Jul 12. dateTo exclusive.
    const r = t(tools, "orders_search").call({ dateFrom: "2026-07-06", dateTo: "2026-07-13" });
    return { answer: `${r.count} orders came in last week (Jul 6-12).` };
  }

  if (/iso week/.test(p)) {
    const r = t(tools, "orders_weekly").call({ weeksBack: 4 });
    const total = r.weeks.filter((w) => w.week === "2026-W27").reduce((s, w) => s + w.orders, 0);
    return { answer: `${total} orders in ISO week 2026-W27 (the week straddles June/July and is reported as two rows; both counted).` };
  }

  if (/average daily/.test(p)) {
    const r = t(tools, "daily_average_orders").call({ month: "2026-06" });
    return { answer: `June outbound averaged ${r.avgUnitsPerActiveDay} units per ACTIVE day (${r.activeDays} active days, total ${r.totalUnits} units). Note the basis is active days, not calendar days.` };
  }

  if (/completed|executed/.test(p) && /june|between june/.test(p)) {
    const r = t(tools, "orders_search").call({ dateFrom: "2026-06-01", dateTo: "2026-07-01", dateField: "executed" });
    return { answer: `${r.count} orders were executed in June 2026. (The completed-orders report is mislabeled - it counts by entry date - so I used the search tool on the executed date.)` };
  }

  if (/receive|came in|did we receive/.test(p) && /june/.test(p)) {
    const r = t(tools, "orders_search").call({ dateFrom: "2026-06-01", dateTo: "2026-07-01" });
    return { answer: `${r.count} orders were received (entered) in June 2026.` };
  }

  if (/on july 12/.test(p)) {
    const r = t(tools, "orders_search").call({ dateFrom: "2026-07-12", dateTo: "2026-07-13" });
    return { answer: `${r.count} orders were entered on July 12, 2026 (end date is exclusive, so the window is 07-12 to 07-13).` };
  }

  if (/counted|missing/.test(p) && /itm-7/.test(p)) {
    const s = t(tools, "item_flow_summary").call({ itemId: "ITM-7", month: "2026-06" });
    return { answer: `No stock discrepancy: both views total ${s.totalOut} units. The customer counted 8 transactions, the report shows ${s.shipmentGroups} shipment groups - a different grain, same quantity. The count difference is an artifact.` };
  }

  if (/transactions|list the individual/.test(p)) {
    const l = t(tools, "movement_ledger").call({ itemId: "ITM-7", dateFrom: "2026-06-01", dateTo: "2026-07-01" });
    const s = t(tools, "item_flow_summary").call({ itemId: "ITM-7", month: "2026-06" });
    const shown = l.rows.map((r) => `${r.date}:${r.units}u`).join(", ");
    return { answer: `Transactions shown: ${shown} - but the ledger caps results and this list is incomplete. The authoritative June total for ITM-7 is ${s.totalOut} units.` };
  }

  const itemMatch = p.match(/itm-(\d+)/);
  if (itemMatch && /ship|units|total/.test(p)) {
    const itemId = `ITM-${itemMatch[1]}`.toUpperCase();
    const s = t(tools, "item_flow_summary").call({ itemId, month: "2026-06" });
    return { answer: `${itemId}: ${s.totalOut} units shipped in June 2026 (aggregated flow, quantity-authoritative).` };
  }

  if (/warehouse (\d)/.test(p)) {
    const wid = Number(p.match(/warehouse (\d)/)[1]);
    const r = t(tools, "occupancy_by_warehouse").call({});
    const w = r.warehouses.find((x) => x.warehouseId === wid);
    return { answer: `Warehouse ${wid} holds ${w.pallets.toLocaleString("en-US")} pallets (capacity ${w.capacity}). Note: the stock_snapshot tool ignores its warehouseId filter, so I used the per-warehouse occupancy tool.` };
  }

  if (/how fresh/.test(p)) {
    const r = t(tools, "stock_snapshot").call({});
    return { answer: `The stock figure is a snapshot as of ${r.asOf} - about 8 hours old at query time.` };
  }

  if (/pallets.*total|total.*pallets|how many pallets/.test(p)) {
    const r = t(tools, "stock_snapshot").call({});
    return { answer: `${r.totalPallets.toLocaleString("en-US")} pallets in total, as of the ${r.asOf.slice(11, 16)} snapshot (not live).` };
  }

  if (/how full/.test(p)) {
    const r = t(tools, "occupancy_summary").call({});
    return { answer: `The network is ${Math.round(r.fillRate * 100)}% full (${r.totalPallets}/${r.capacityPallets} pallets). The tool returns a 0-1 fraction; converted for display.` };
  }

  if (/expiring/.test(p)) {
    const r = t(tools, "health_kpis").call({});
    if (!r.checksImplemented.includes("expiringSoon")) {
      return { answer: `Unknown - the expiring-soon check is not implemented in this system (implemented checks: ${r.checksImplemented.join(", ")}). The zero in the KPI is structural, not a measurement.` };
    }
    return { answer: `${r.expiringSoon} items expiring soon.` };
  }

  if (/at-risk/.test(p)) {
    const ownerId = /borealis/.test(p) ? "OWN-102" : "OWN-105";
    const r = t(tools, "stock_at_risk").call({ ownerId });
    const who = t(tools, "owner_lookup").call({ ownerId });
    const label = who.name || ownerId;
    if (r.units === null) return { answer: `${label}: no data available for at-risk stock - this is unknown, not zero.` };
    return { answer: `${label} has ${r.units} units of at-risk stock${r.units === 0 ? " - a true zero from the tracked check" : ""}.` };
  }

  if (/top three|top 3/.test(p)) {
    const r = t(tools, "owners_volume_ranking").call({ month: "2026-06" });
    const top = r.ranking.slice(0, 3).map((x) => {
      const who = t(tools, "owner_lookup").call({ ownerId: x.ownerId });
      const label = who.name ? `${who.name} (${x.ownerId})` : `${x.ownerId} (name not resolved in master data)`;
      return `${label}: ${x.units} units`;
    });
    return { answer: `Top three June customers by entered volume - ${top.join("; ")}.` };
  }

  if (/biggest volume|biggest customer|which customer/.test(p)) {
    const r = t(tools, "owners_volume_ranking").call({ month: "2026-06" });
    const top = r.ranking[0];
    const who = t(tools, "owner_lookup").call({ ownerId: top.ownerId });
    const label = who.name ?? "unknown - the id has no resolved name in master data, and I won't guess one";
    return { answer: `Biggest June customer: ${top.ownerId} with ${top.units} units. Name: ${label}.` };
  }

  if (/borealis/.test(p)) {
    const r = t(tools, "owners_volume_ranking").call({ month: "2026-06" });
    const row = r.ranking.find((x) => x.ownerId === "OWN-102");
    return { answer: `Borealis Seafood (OWN-102) ordered ${row.units} units in June 2026.` };
  }

  return { answer: "Out of scope for the reference adapter." };
}
