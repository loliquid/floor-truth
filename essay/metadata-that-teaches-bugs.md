# Metadata that teaches bugs


*Lessons from building an AI agent over a real WMS at a real 3PL — and why your agent is only as honest as its tool metadata.*

---

For the past year I've been building WOC, an operational agent that sits on top of a twenty-year-old warehouse management system at a third-party logistics operator. Not a demo. Not a wrapper around a chat API. An agent that answers questions like "how full is cold store three" and "what did we ship for this customer last week" for the people running the warehouse — where a wrong answer doesn't get a thumbs-down, it gets a truck loaded wrong.

Somewhere around the hundredth tool, I audited every tool description in the system against what the code actually did. The audit rewrote the metadata of 105 out of 107 tools. Along the way it found something more interesting than incomplete documentation: **metadata that actively taught the agent bugs.**

A tool description is not documentation. Documentation gets read by humans who bring skepticism and context. Tool metadata gets read by a model that treats it as ground truth, ten thousand times a day, with no ability to raise an eyebrow. If the description is wrong, the agent isn't under-informed — it is *systematically trained* to produce a specific wrong answer, confidently, forever.

A recent academic study ("MCP Tool Descriptions Are Smelly!") analyzed 856 tools across 103 public MCP servers and found widespread quality problems. That matches what I saw from the inside — but production over a legacy WMS adds failure modes the paper's taxonomy doesn't reach, because they only appear when the tools sit on top of a messy physical operation. Here is the catalog.

## 1. Time semantics

Every warehouse record carries three or four dates: when the order entered the system, when it was due, when it was executed. Ask "how many orders did we do in June" and the answer differs depending on which date field the tool filters on — and the tool's description almost never says. One of our analytics tools defaulted to entry date while its description implied execution date; every historical comparison built on it was subtly wrong.

The family also includes: exclusive end-dates (`DateTo` that silently excludes the day you asked for), ISO weeks that straddle month boundaries and split into two rows, averages computed over *active* days while the user assumes calendar days, and a container clock that drifts nine minutes from the warehouse's wall clock — which matters when "today" is a filter.

## 2. Grain and units

A movement ledger records one row per transaction; a stock report records quantities. Compare them by row count and you'll "find" discrepancies that are pure artifacts — the same quantity split across a different number of movements. The correct comparison is on summed quantity, and nothing in either tool's metadata said so.

The same family: one endpoint returns occupancy as a 0–1 fraction, a neighboring endpoint returns 0–100 percent, and percentage figures computed against *different denominators* depending on whether the source was a snapshot or live. An agent that doesn't know this reports a warehouse both 76% and 0.76% full — or worse, averages them.

## 3. Freshness and provenance

Half the "live" numbers in any mature system aren't. We found report KPIs served from a lazy snapshot with a ten-minute TTL, database schema descriptions that were a committed snapshot two weeks stale while presenting as live introspection, and a daily briefing that was pre-generated hours before the user read it. None of this is wrong engineering — caching is how systems survive. It becomes an agent bug the moment the metadata doesn't force the agent to say "as of 10:40" instead of "right now."

## 4. Silent degradation

The most dangerous family, because everything *looks* fine. Row caps that truncate at five thousand rows without a flag. A byte limit that, when exceeded, dropped the *entire* result rather than truncating. A privileged query tier that, when disabled, silently downgraded to the lower tier instead of failing. A tool that accepted a `warehouseId` argument and *ignored it* — returning network-wide totals that the agent dutifully presented as one warehouse's numbers.

An agent over such tools doesn't fail loudly. It sums half the data and reports it as the whole, because nothing told it there was another half.

## 5. Identity and naming

Legacy systems speak in IDs; humans speak in names. The gap gets filled by whatever is nearest — and for an LLM, "nearest" means training-data memory. We caught our agent *inventing plausible customer names* for owner IDs it had never resolved. The fix was structural: an enrichment layer that binds authentic names to every ID before results reach the model, and a hard rule that an unresolved ID renders as "unknown — do not name from memory."

Related: parameters whose names lie. A `warehouseId` that is actually a customer ID under a deprecated alias. Metadata examples that filtered "warehouse 3" and returned customer 3.

## 6. Metadata that teaches bugs

The title family. Five tool examples referenced database schema `ALPHA` when the real schema was `ALPHA_WMS` — every agent call copying those examples returned 404, in the exact place designed to teach correct usage. A trend tool's description asserted it measured *bandwidth, not occupancy* while the code computed occupancy. A tool description promised a field the tool never returned, and three downstream examples routed the agent to that phantom field.

Each of these is worse than no metadata. The agent doesn't guess — it *obeys*.

## 7. Verification limits

A sandbox that executes agent-written analysis code can verify that the code *ran*. It cannot verify the code was *right* — so every computed result carries `verified: false`, permanently, by design. A health KPI returned zero because the underlying check didn't exist — structurally zero, indistinguishable from "all clear" unless the metadata says the check is absent. And `null` must never collapse into `0`: "unknown" and "nothing" are different answers to "how much stock is at risk."

---

## What actually fixed it

Three things, none of them clever:

**Returns contracts.** Every tool's metadata now states what it *actually* returns — grain, date semantics, caps, staleness, known blind spots — grounded in the code with source citations, not in what the tool was hoped to do. Rewriting 105 contracts found real bugs the tests hadn't: dead tools, inverted descriptions, mis-wired arguments.

**Routing evals.** A corpus of real operator phrasings, run against the tool catalog on every change. The most valuable entries are the *negative* ones: "orders last week" must never route to the forecast tool, no matter how good the forecast tool's description smells.

**Honesty under degradation.** Evals that don't test whether the agent gets the right answer, but whether it *tells the truth about the answer it has* — declaring truncation, staleness, unknown identity, unverified computation.

## floor-truth

I'm distilling all of this into **floor-truth** — an open repository with the full failure-pattern taxonomy and a set of synthetic eval cases over a mock WMS, so you can test whether *your* agent falls into the same traps. Every case is drawn from something that actually happened in production; every one is reproduced with synthetic data.

These patterns aren't specific to my stack. Whether the system underneath is a modern WMS or a legacy one — the date fields, the silent caps, the ID-name gap, and the metadata that teaches bugs are all waiting. The floor doesn't care how good your model is. It cares whether your tools tell the truth.

*You are reading it: this essay ships inside the floor-truth repository.*
