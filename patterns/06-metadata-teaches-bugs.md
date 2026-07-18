# 6. Metadata that teaches bugs

**The failure:** the title family. Tool metadata is not documentation — documentation is read by skeptical humans; metadata is read by a model that treats it as ground truth, thousands of times a day, with no ability to raise an eyebrow. Wrong metadata doesn't leave the agent under-informed; it *trains* the agent to produce a specific wrong answer, confidently, forever.

## Incidents (production, anonymized)

- Five tool examples referenced database schema **`ALPHA`** when the real schema was **`ALPHA_WMS`**. Every agent call copying those examples returned 404 — in the exact place designed to teach correct usage.
- A trend tool's description asserted it measured **"bandwidth, NOT occupancy"** while the code computed occupancy. The description was not vague; it was the precise opposite of the truth.
- A tool description **promised a field the tool never returned**; three downstream metadata examples routed the agent to that phantom field.
- A report tool named and described as **"completed orders"** that filtered on entry date. Every "how many did we complete" answer was silently a "how many did we receive" answer.
- Stale `whenToUse` hints pointing at capabilities that had been rewired releases ago.

## Why it's universal

Metadata is written once, at tool-creation time, by the person who *intended* the behavior — then the code evolves and the metadata doesn't. There is no compiler for descriptions. An empirical study of 856 public MCP tools ("MCP Tool Descriptions Are Smelly!", arXiv:2602.14878) found quality problems endemic; production adds the sharper version — descriptions that are specifically, actionably wrong.

## What correct looks like

The agent treats examples as hypotheses (recovers from an example that errors, rather than giving up), notices description/behavior contradictions when results allow, and prefers tools whose observed behavior matches their claims.

## floor-truth cases

`mb-01` mislabeled report tool · `mb-02` invalid enum in the tool's own example — recovery required

## Mitigation

**Returns contracts grounded in code, with source citations.** Every claim in the metadata traceable to the line that implements it; every rewrite an audit. In our production pass this rewrote 105 of 107 tool contracts and found real bugs the test suite had missed — dead tools, inverted descriptions, mis-wired arguments. The metadata layer is part of the control plane. Treat it like code, because the agent already does.
