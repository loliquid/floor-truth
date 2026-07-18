# floor-truth

**Ground truth from the warehouse floor — a failure catalog and eval set for AI agents over WMS and legacy operational systems.**

Every case in this repository reproduces a failure pattern observed in production while building an agent over a live warehouse management system at a third-party logistics operator. Every case is rebuilt here with synthetic data on a mock WMS — no real customers, volumes, or schemas — and every case has a designed, checkable correct answer.

The premise, in one line: **your agent is only as honest as its tool metadata.** The floor doesn't care how good your model is. It cares whether your tools tell the truth — and whether your agent notices when they don't.

## Quick start

```bash
node run.mjs                          # naive baseline: watch it fall into the traps
node run.mjs --adapter ./adapters/reference.mjs   # proof every case is solvable
node run.mjs --adapter ./my-agent.mjs # your agent
```

No dependencies. Node 18+.

Current results:

| Adapter | Score | What it proves |
|---|---|---|
| `naive-baseline` | **4/23** | The traps are real: an agent that trusts tool descriptions at face value fails 19 of 23 cases |
| `reference` | **23/23** | The benchmark is fair: every case has a reachable correct answer using only the exposed tools |

## The failure taxonomy

Seven families, each documented in [`patterns/`](patterns/) with the production incidents (anonymized) that motivated it:

| # | Family | The one-line failure |
|---|--------|----------------------|
| 1 | [Time semantics](patterns/01-time-semantics.md) | Which date field? Exclusive bounds, straddled weeks, active-day denominators |
| 2 | [Grain & units](patterns/02-grain-and-units.md) | Transactions vs groups, fractions vs percents — compared as if identical |
| 3 | [Freshness & provenance](patterns/03-freshness-and-provenance.md) | Snapshots and caches presented as "right now" |
| 4 | [Silent degradation](patterns/04-silent-degradation.md) | Caps, fallbacks, and ignored arguments — with no signal in the response |
| 5 | [Identity & naming](patterns/05-identity-and-naming.md) | IDs "resolved" from the model's memory: invented customer names |
| 6 | [Metadata teaches bugs](patterns/06-metadata-teaches-bugs.md) | Descriptions and examples that are specifically, actionably wrong |
| 7 | [Verification limits](patterns/07-verification-limits.md) | Structural zeros, null-as-zero, "it ran" mistaken for "it's right" |

Plus a small **routing** group: questions that smell like one tool but belong to another ("orders last week" is not a forecasting question).

## Wiring your agent

An adapter is one exported async function:

```js
export default async function myAgent({ prompt, tools }) {
  // tools: [{ name, description, examples, call(args) }, ...]
  // Call tools as your agent decides; return the final user-facing answer.
  return { answer: "..." };
}
```

Wrap your LLM loop of choice inside it — hand the model the tool list (names + descriptions + examples, exactly as a real integration would), let it plan and call, return the final text. The runner records every `call()` and checks:

- `must_call` / `must_not_call` — routing correctness (e.g., the forecast tool must not answer historical questions)
- `answer_must_match` / `answer_must_not_match` — the answer's substance *and honesty* (declaring staleness, refusing to invent names, distinguishing "unknown" from zero)

Case format: one JSON object per line in [`evals/cases.jsonl`](evals/cases.jsonl) — `id`, `family`, `prompt`, `trap` (the spoiler), `checks`.

## Design notes

- **The descriptions are the benchmark.** Two tools have deliberately wrong metadata (marked in [`mock-wms/tools.mjs`](mock-wms/tools.mjs) `GROUND_TRUTH`), because that is what production metadata looks like. Do not "fix" them.
- **Honesty checks over answer checks.** Several cases score whether the agent tells the truth about its answer's limits (as-of timestamps, unimplemented checks, unresolved names) — the dimension most agent evals skip entirely.
- **The mirror cases matter.** `vl-03` (a true zero must be reported as zero) and `rt-02` (a genuine forecast question must use the forecast tool) exist so that reflexive hedging and reflexive tool-avoidance don't score points.

## Where this comes from

Distilled from production lessons building **WOC**, an operational agent over a twenty-year-old WMS at a real 3PL — where an audit of 107 tools rewrote 105 metadata contracts and found the failure families above the hard way. The full story: *Metadata that teaches bugs* ([essay](essay/metadata-that-teaches-bugs.md)).

These patterns are not specific to one stack. The date fields, the silent caps, the id–name gap and the metadata that teaches bugs are waiting in every WMS, ERP, and line-of-business system built in the last thirty years.

## Roadmap

- v0 (this): failure taxonomy + 23 eval cases + zero-dep runner
- v1 (if there's interest): larger case set, LLM-adapter examples, Inspect AI export, multi-turn scenarios

Contributions welcome — especially failure patterns from *your* production floor. Open an issue with the anonymized incident; if it generalizes, it becomes a family or a case.

## License

MIT — © 2026 Andreas Loukas
