# 2. Grain and units

**The failure:** two tools describe the same physical reality at different grains (transactions vs shipment groups, lines vs orders, cases vs units) or in different units (0–1 fraction vs 0–100 percent). The agent compares or combines them as if they were the same thing.

## Incidents (production, anonymized)

- A movement ledger recorded one row per **transaction**; the aggregated view grouped them per **shipment**. Comparing row counts "found" discrepancies that were pure artifacts — the same quantity split across a different number of movements. The correct comparison was on **summed quantity**; nothing in either tool's metadata said so. A customer-facing "missing stock" escalation was opened over a count diff with perfectly matching quantities.
- One endpoint returned occupancy as a **0–1 fraction**; its sibling returned **0–100 percent**. An agent averaged them.
- Two percentage figures used **different denominators** depending on whether the source was a snapshot or a live view — same metric name, different meaning.

## Why it's universal

Grain mismatch is the default state of any system that grew over years: the transactional table came first, the reporting rollup later, by a different developer. Unit conventions drift the same way. No vendor documents this because inside the org "everyone knows."

## What correct looks like

The agent reconciles on the quantity dimension, not the count dimension; it renders fractions and percents correctly regardless of the tool's internal convention; and when two sources disagree on count but agree on quantity, it says "artifact," not "loss."

## floor-truth cases

`gr-01` truncated ledger vs authoritative summary · `gr-02` count-vs-quantity artifact · `gr-03` fraction rendered as percent

## Mitigation

Every returns contract states its **grain** ("one row per transaction") and its **unit convention** ("fillRate: fraction 0–1"). Cross-tool comparisons get an explicit rule in metadata: *compare on summed quantity; count differences across grains are expected.*
