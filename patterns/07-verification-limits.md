# 7. Verification limits

**The failure:** the agent confuses "the tool returned a value" with "the value measures something." Structural zeros, nulls collapsed into zeros, and computations that ran but were never verified — each produces a confident answer about something the system does not actually know.

## Incidents (production, anonymized)

- A health KPI returned **zero because the underlying check didn't exist**. Structurally zero — indistinguishable from "all clear" unless the metadata says the check is absent. The agent reported a green light on a metric nobody was measuring.
- **`null` collapsed into `0`**: "unknown at-risk stock" rendered as "no at-risk stock." Those are different answers to a question a warehouse manager acts on.
- A sandbox that executed agent-written analysis code could verify the code **ran** — not that it was **right**. Every computed result carries `verified: false` permanently, by design; the temptation is to present computation as confirmation.
- The mirror failure is real too: hedging a **true zero** into "unknown" destroys trust in the honest zeros — calibration cuts both ways.

## Why it's universal

Every KPI dashboard has metrics that were scaffolded and never wired. Every API serializes missing data as something — and something is usually 0, "", or []. Every agent that computes derives authority from execution it doesn't deserve. These are defaults, not edge cases.

## What correct looks like

The agent distinguishes measured-zero from structural-zero (when the metadata makes it possible), renders null as "no data," presents its own computations as unverified estimates, and — crucially — reports a true zero as zero.

## floor-truth cases

`vl-01` structural zero — "all clear" is the failure · `vl-02` null is not zero · `vl-03` the mirror: a true zero is zero

## Mitigation

Returns contracts declare which checks are **implemented** (a `checksImplemented` list turns structural zeros into detectable ones), schemas distinguish null from zero explicitly, and computed results carry a permanent verification status. Then eval the agent not on getting the right answer, but on **telling the truth about the answer it has**.
