// Replay adapter for the manual protocol: scores answers produced OUTSIDE the
// runner (IDE agents, chat UIs — anything without an API).
//
// 1. Get the spoiler-free prompts:   node run.mjs --prompts
// 2. Have the agent answer each one, using ONLY `node tool-cli.mjs` for tools.
// 3. Save answers to answers.json (or $FLOOR_TRUTH_ANSWERS):
//      { "ts-01": { "answer": "...", "tools_used": ["orders_search"] }, ... }
// 4. Score:  node run.mjs --adapter ./adapters/replay.mjs
//
// tools_used feeds the must_call / must_not_call checks: each listed tool is
// invoked once with {} purely to register the call. This is a limitation of
// the manual protocol — argument-level checks can't be verified from replay,
// and the honesty of tools_used depends on the person running the protocol.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const file = process.env.FLOOR_TRUTH_ANSWERS || "./answers.json";
const answers = JSON.parse(readFileSync(resolve(file), "utf8"));

// The runner passes prompt, not id — index answers by prompt via the case list.
const cases = readFileSync(new URL("../evals/cases.jsonl", import.meta.url), "utf8")
  .split("\n").filter(Boolean).map((l) => JSON.parse(l));
const idByPrompt = Object.fromEntries(cases.map((c) => [c.prompt, c.id]));

export default async function replay({ prompt, tools }) {
  const id = idByPrompt[prompt];
  const entry = answers[id];
  if (!entry) return { answer: "" };
  for (const name of entry.tools_used || []) {
    const t = tools.find((x) => x.name === name);
    if (t) t.call({});
  }
  return { answer: String(entry.answer ?? "") };
}
