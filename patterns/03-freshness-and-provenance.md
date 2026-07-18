# 3. Freshness and provenance

**The failure:** half the "live" numbers in any mature system aren't. Caches, snapshots, and pre-generated reports are how systems survive load — and they become agent bugs the moment the metadata lets the agent say "right now" about a number that is hours old.

## Incidents (production, anonymized)

- Report KPIs served from a **lazy snapshot with a ten-minute TTL**, presented by the tool as current. The staleness flag existed internally and was never surfaced.
- Database schema descriptions that were a **committed snapshot weeks stale**, presenting as live introspection. The agent confidently described tables that had since changed.
- A "daily briefing" **pre-generated hours before** the user read it, with no generation timestamp in the tool output.
- A stock-position tool whose only honest field was `asOf` — routinely 6–8 hours behind — buried under a description that said "current."

## Why it's universal

Caching is correct engineering. The bug is not the cache — it's the metadata that hides it. Every WMS reporting layer has snapshot tables; every dashboard has TTLs; every integration has batch windows. The agent inherits all of them, invisibly, unless each tool declares its freshness.

## What correct looks like

The agent (a) reads and reports the as-of timestamp when one exists, (b) says "as of 02:00" instead of "right now," and (c) can answer the meta-question "how fresh is this figure?" — which is often the operationally decisive question.

## floor-truth cases

`fr-01` stale snapshot reported with as-of · `fr-02` the freshness meta-question

## Mitigation

Returns contracts declare **provenance and freshness**: live query vs snapshot vs pre-generated, TTL, and where the as-of timestamp lives in the payload. An honest agent over a cached system beats a confident agent over the same system every single day of operation.
