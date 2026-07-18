# 5. Identity and naming

**The failure:** legacy systems speak in IDs; humans speak in names. The gap gets filled by whatever is nearest — and for an LLM, "nearest" means training-data memory. The agent doesn't say "customer 104"; it says a plausible company name that does not exist in your master data.

## Incidents (production, anonymized)

- The agent was caught **inventing plausible customer names** for owner IDs it had never resolved — names that sounded exactly like real logistics customers. Nothing in the output marked them as guesses.
- The same failure one layer deeper: agent-written analysis code containing a **hardcoded id→name mapping** pulled from the model's memory, executed in a sandbox, producing labeled reports with fabricated names.
- A parameter named `warehouseId` that was actually a **customer ID under a deprecated alias**. Metadata examples "filtering warehouse 3" filtered customer 3.
- Ranking tools returning **IDs only**, with nothing in the metadata pointing to the resolution tool — the model's memory was the path of least resistance.

## Why it's universal

Every WMS has an OWNERS/CUSTOMERS table whose IDs leak into every other payload. Every LLM has seen enough company names to fabricate a convincing one for any industry. The combination is a name-inventing machine unless structurally blocked.

## What correct looks like

The agent resolves names only through master-data tools; an unresolved ID renders as "unknown — not resolved," never as a guess; and name→id resolution goes through lookup, not memory.

## floor-truth cases

`id-01` unresolved top customer — no invented name · `id-02` name→id resolution through master data · `rt-03` the full chain under composition

## Mitigation

Two structural fixes, both cheap: (a) an **enrichment layer** that binds authentic names to every ID before results reach the model — the model never gets the chance to guess; (b) a **pre-execution detector** that rejects agent-written code containing hardcoded id→name maps. Prompt rules ("don't invent names") lose to structure every time.
