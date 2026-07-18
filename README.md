# floor-truth

**Ground truth from the warehouse floor — a failure catalog and eval set for AI agents over WMS and legacy operational systems.**

Every case in this repository reproduces a failure pattern observed in production while building an agent over a live warehouse management system at a third-party logistics operator. Every case is rebuilt here with synthetic data on a mock WMS — no real customers, volumes, or schemas — and every case has a designed, checkable correct answer.

The premise, in one line: **your agent is only as honest as its tool metadata.** The floor doesn't care how good your model is. It cares whether your tools tell the truth — and whether your agent notices when they don't.

## Quick start

```bash
node run.mjs                          # naive baseline: watch it fall into the traps
node run.mjs --adapter ./adapters/reference.mjs   # proof every case is solvable
ANTHROPIC_API_KEY=sk-... node run.mjs --adapter ./adapters/llm-anthropic.mjs   # a real LLM
node run.mjs --adapter ./my-agent.mjs # your agent
```

No dependencies. Node 18+. `--verbose` prints full answers and tool calls; `--case <id>` runs one case.

Current results:

| Adapter | Score | Notes |
|---|---|---|
| `naive-baseline` *(scripted)* | **4/23** | Keyword-router that takes tool descriptions at face value. Demonstrates the traps are real — it is **not** an LLM's score |
| Claude Haiku 4.5 | **13/23** | `adapters/llm-anthropic.mjs`, neutral system prompt, single run |
| GPT-5.6 Luna | **16/23** | `adapters/llm-openai.mjs`, same prompt; `reasoning_effort: none` (chat-completions requires it with tools) |
| GPT-5.6 Sol | **17/23** | Same setup and reasoning caveat |
| Claude Sonnet 5 | **19/23** | Failed **both** metadata-teaches-bugs cases — obeyed the mislabeled tool and the poisoned example |
| Claude Fable 5 | **20/23** | Best LLM so far; the only model to recover from a poisoned example |
| `reference` *(scripted, informed)* | **23/23** | Written with knowledge of the traps. Proves every case is solvable — fairness, not achievability |

All LLM rows: identical tools, identical neutral system prompt, only the model changes. Runs are stochastic — expect ±1–2 cases between runs; family-level patterns are the signal. Notably, **every model failed at least one metadata-teaches-bugs case** — wrong metadata beats good models.

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

### Testing an agent without an API (manual protocol)

For IDE agents and chat UIs (Cursor, ChatGPT, etc.) that can't be wrapped in an adapter:

```bash
node run.mjs --prompts        # spoiler-free case list (id + prompt only)
node tool-cli.mjs list        # tool catalog, exactly what an integration sees
node tool-cli.mjs call orders_search '{"dateFrom":"2026-06-01","dateTo":"2026-07-01"}'
```

The agent answers each prompt using **only** `tool-cli.mjs` for data, records `{ "<id>": { "answer": "...", "tools_used": [...] } }` into `answers.json`, then:

```bash
node run.mjs --adapter ./adapters/replay.mjs
```

**Contamination rule:** the agent under test must never open `mock-wms/*.mjs`, `evals/`, `patterns/`, `essay/`, `adapters/`, or the README results — they contain the answers. Manual-protocol scores are only as honest as the isolation.

## Design notes

- **The descriptions are the benchmark.** Two tools have deliberately wrong metadata, because that is what production metadata looks like. Do not "fix" them. The full spoiler map lives in [`mock-wms/ground-truth.mjs`](mock-wms/ground-truth.mjs) — isolated from the toolset so the tools can be handed to an agent under test without the answers riding along.
- **Honesty checks over answer checks.** Several cases score whether the agent tells the truth about its answer's limits (as-of timestamps, unimplemented checks, unresolved names) — the dimension most agent evals skip entirely.
- **The mirror cases matter.** `vl-03` (a true zero must be reported as zero) and `rt-02` (a genuine forecast question must use the forecast tool) exist so that reflexive hedging and reflexive tool-avoidance don't score points.

## Where this comes from

Distilled from production lessons building **WOC**, an operational agent over a twenty-year-old WMS at a real 3PL — where an audit of 107 tools rewrote 105 metadata contracts and found the failure families above the hard way. The full story: *Metadata that teaches bugs* ([essay](essay/metadata-that-teaches-bugs.md)).

These patterns are not specific to one stack. The date fields, the silent caps, the id–name gap and the metadata that teaches bugs are waiting in every WMS, ERP, and line-of-business system built in the last thirty years.

## Limitations (v0) — what this does and doesn't prove

Honesty about the benchmark itself, in the spirit of the benchmark:

- The **4/23 baseline is scripted**, not an LLM. It demonstrates the traps exist; the real-LLM rows above are the meaningful model scores.
- The **reference 23/23 proves solvability, not achievability** — it was written knowing the traps.
- **Grading is regex-based**: transparent and deterministic, but gameable by an adapter that knows the checks. Don't tune your agent on the check strings; that's memorizing the answer key.
- **Single-run scores over a stochastic model** — treat ±1–2 as noise, and family-level patterns (e.g. metadata-teaches-bugs going 0/2) as the signal.
- **No adversarial paraphrases yet** — a paraphrase set is the top v1 item, so passing means understanding the semantics, not the phrasing.

## Roadmap

- v0 (this): failure taxonomy + 23 eval cases + zero-dep runner + real-LLM adapter and first model scores
- v1 (if there's interest): adversarial paraphrase variants, more model adapters (OpenAI/Gemini), stronger grading (LLM-judge option), larger case set, Inspect AI export, multi-turn scenarios

Contributions welcome — especially failure patterns from *your* production floor. Open an issue with the anonymized incident; if it generalizes, it becomes a family or a case.

## License

MIT — © 2026 Andreas Loukas
