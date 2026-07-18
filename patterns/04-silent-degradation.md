# 4. Silent degradation

**The failure:** the most dangerous family, because everything *looks* fine. Tools that truncate, downgrade, ignore arguments, or drop results — without any signal in the response. The agent doesn't fail loudly; it sums half the data and reports it as the whole, because nothing told it there was another half.

## Incidents (production, anonymized)

- Row caps that truncated at N rows **without a truncation flag**. Sums over the result were sums over part of the truth.
- A byte limit that, when exceeded, **dropped the entire result** rather than truncating — the agent saw an empty dataset and reported "no data."
- A privileged query tier that, when disabled, **silently downgraded** to the lower tier instead of failing — same question, quietly weaker answer.
- A tool that **accepted a `warehouseId` argument and ignored it**, returning network-wide totals that the agent dutifully presented as one warehouse's numbers. The metadata example even showed filtering by warehouse.
- A fallback-used flag that was **hardcoded to false** — the one signal designed to catch degradation, itself degraded.

## Why it's universal

Caps and fallbacks are added under incident pressure and documented nowhere. Ignored parameters are the fossil record of refactors. Every legacy API has both. The agent is the first consumer in the system's history that cannot read between the lines.

## What correct looks like

The agent treats result-set boundaries as suspicious (a result at exactly the cap size is a truncation until proven otherwise), cross-checks sums against aggregate tools, prefers tools whose filters demonstrably work, and states uncertainty when completeness can't be established.

## floor-truth cases

`sd-01` ignored warehouse filter · `sd-02` silent cap with reconciliation available · `sd-03` silent cap, second item

## Mitigation

Returns contracts declare **every cap, every fallback, every ignored argument** — including the shameful ones. In our production audit, writing these contracts found dead tools and mis-wired arguments the test suite had missed for months. The contract audit is a bug hunt wearing documentation's clothes.
