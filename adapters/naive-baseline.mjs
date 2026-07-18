// The naive baseline: a keyword-routing agent that trusts every tool at face
// value. It exists to demonstrate that the traps are real — it falls into
// nearly all of them. This is roughly how an agent behaves when its only
// knowledge of the tools is their (sometimes wrong) descriptions.
//
// The invented customer name below is deliberate: it demonstrates the
// identity-and-naming failure (an LLM filling an unresolved id from "memory").

const t = (tools, name) => tools.find((x) => x.name === name);

export default async function naiveBaseline({ prompt, tools }) {
  const p = prompt.toLowerCase();

  // "expect / should we" or plain "week" → the forecast tool smells right.
  if (/expect|next week/.test(p) || (/week/.test(p) && !/iso week/.test(p))) {
    const r = t(tools, "weekly_forecast").call({ weeksAhead: 1 });
    const w = r.weeks?.[0];
    return { answer: `Projected orders for ${w.week}: ${w.projectedOrders} (forecast).` };
  }

  if (/iso week/.test(p)) {
    const r = t(tools, "orders_weekly").call({ weeksBack: 4 });
    const row = r.weeks.find((w) => w.week === "2026-W27"); // first matching row
    return { answer: `Week ${row.week}: ${row.orders} orders.` };
  }

  if (/completed/.test(p)) {
    const r = t(tools, "orders_completed_report").call({ month: "2026-06" });
    return { answer: `${r.count} orders completed in ${r.month}.` };
  }

  if (/executed/.test(p)) {
    // Copies the tool's own example verbatim — including the invalid enum.
    const r = t(tools, "orders_search").call({
      dateFrom: "2026-06-01", dateTo: "2026-07-01", dateField: "completed",
    });
    if (r.error) return { answer: "Sorry — I was unable to retrieve the executed orders." };
    return { answer: `${r.count} orders.` };
  }

  if (/on july 12/.test(p)) {
    const r = t(tools, "orders_search").call({ dateFrom: "2026-07-12", dateTo: "2026-07-12" });
    return { answer: `${r.count === 0 ? "0 orders (none)" : r.count + " orders"} were entered on July 12.` };
  }

  if (/receive|came in|did we receive/.test(p) && /june/.test(p)) {
    const r = t(tools, "orders_search").call({ dateFrom: "2026-06-01", dateTo: "2026-06-30" });
    return { answer: `${r.count} orders in June.` }; // exclusive dateTo also bites here
  }

  if (/average daily/.test(p)) {
    const r = t(tools, "daily_average_orders").call({ month: "2026-06" });
    return { answer: `Average daily outbound in June: ${r.avgUnitsPerActiveDay} units per day.` };
  }

  if (/transactions|list the individual/.test(p)) {
    const r = t(tools, "movement_ledger").call({ itemId: "ITM-7", dateFrom: "2026-06-01", dateTo: "2026-07-01" });
    const total = r.rows.reduce((s, x) => s + x.units, 0);
    return { answer: `${r.rowCount} transactions, total ${total} units.` };
  }

  if (/itm-7/.test(p) && /counted|missing/.test(p)) {
    return { answer: "The report shows 6 movements but 8 were counted — 2 movements unaccounted for, stock is missing." };
  }

  const itemMatch = p.match(/itm-(\d+)/);
  if (itemMatch && /ship|units|total/.test(p)) {
    const itemId = `ITM-${itemMatch[1]}`.toUpperCase();
    const r = t(tools, "movement_ledger").call({ itemId, dateFrom: "2026-06-01", dateTo: "2026-07-01" });
    const total = r.rows.reduce((s, x) => s + x.units, 0);
    return { answer: `${itemId}: ${total} units shipped in June.` };
  }

  if (/warehouse (\d)/.test(p)) {
    const wid = Number(p.match(/warehouse (\d)/)[1]);
    const r = t(tools, "stock_snapshot").call({ warehouseId: wid });
    return { answer: `Warehouse ${wid} has ${r.totalPallets} pallets.` };
  }

  if (/pallets.*total|total.*pallets|how many pallets/.test(p)) {
    const r = t(tools, "stock_snapshot").call({});
    return { answer: `We currently have ${r.totalPallets} pallets in total.` };
  }

  if (/how fresh/.test(p)) {
    return { answer: "The stock figure is live." };
  }

  if (/how full/.test(p)) {
    const r = t(tools, "occupancy_summary").call({});
    return { answer: `The network is ${r.fillRate}% full.` };
  }

  if (/expiring/.test(p)) {
    const r = t(tools, "health_kpis").call({});
    return { answer: `No — ${r.expiringSoon} items expiring soon. All clear.` };
  }

  if (/at-risk/.test(p)) {
    const ownerId = /borealis/.test(p) ? "OWN-102" : "OWN-105";
    const r = t(tools, "stock_at_risk").call({ ownerId });
    return { answer: `${ownerId} has ${r.units ?? 0} units of at-risk stock.` }; // null coalesced to 0: the bug
  }

  if (/top three|top 3/.test(p)) {
    const r = t(tools, "owners_volume_ranking").call({ month: "2026-06" });
    const top = r.ranking.slice(0, 3)
      .map((x) => `${x.ownerId === "OWN-104" ? "Meridian Foods Ltd" : x.ownerId} (${x.units}u)`);
    return { answer: `Top customers: ${top.join(", ")}.` };
  }

  if (/biggest volume|biggest customer|which customer/.test(p)) {
    const r = t(tools, "owners_volume_ranking").call({ month: "2026-06" });
    const top = r.ranking[0];
    // The failure on display: unresolved id "filled in" with a plausible name.
    return { answer: `Our biggest June customer was Meridian Foods Ltd (${top.ownerId}) with ${top.units} units.` };
  }

  if (/borealis/.test(p)) {
    const r = t(tools, "owners_volume_ranking").call({ month: "2026-06" });
    const row = r.ranking.find((x) => x.ownerId === "OWN-102");
    return { answer: `Borealis Seafood ordered ${row.units} units in June.` };
  }

  return { answer: "I don't know how to answer that." };
}
