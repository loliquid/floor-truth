# 1. Time semantics

**The failure:** every warehouse record carries three or four dates — entered, due, executed, invoiced. Ask "how many orders in June" and the answer legitimately differs depending on which date field the tool filters on. The tool's metadata almost never says which one, and the agent almost never asks.

## Incidents (production, anonymized)

- An analytics tool defaulted to **entry date** while its description implied **execution date**. Every historical comparison built on it was subtly wrong — the numbers looked plausible, reconciled with nothing.
- A search tool's `dateTo` was **exclusive** and undocumented. "Orders on July 12" with `from=to=2026-07-12` returned zero rows; the agent reported "no orders that day" for a day with orders.
- A weekly rollup **split month-straddling ISO weeks into two rows** with the same week label. Consumers that took the first matching row silently undercounted.
- A daily-average tool divided by **active days** (days with any activity), not calendar days. Presented as a plain per-day average, it overstated throughput by 50%.
- The container's wall clock drifted ~9 minutes from the warehouse's — which matters when "today" is a filter boundary.

## Why it's universal

Every WMS/ERP has the entered/due/executed triple (under names like INDATE/DUEDATE/DONEDATE, created/promised/actual). Exclusive end-bounds and ISO-week edge cases are endemic to every reporting layer ever written. If your agent sits on any operational system, this family is already in your stack.

## What correct looks like

The agent (a) knows which date field answers which business question, (b) treats range bounds as unknown-until-verified, (c) sums straddled periods, and (d) always states the basis of an average.

## floor-truth cases

`ts-01` entered vs the default · `ts-02` executed vs the default · `ts-03` exclusive dateTo · `ts-04` straddled ISO week · `ts-05` active-days denominator

## Mitigation

Put the date semantics **in the tool's returns contract**: which field, inclusive/exclusive bounds, period-splitting behavior. If the metadata doesn't say it, the agent will guess — and it will guess the same wrong thing every time.
