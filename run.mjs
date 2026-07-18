#!/usr/bin/env node
// floor-truth runner — zero dependencies.
//
//   node run.mjs                        # run the naive baseline (falls into traps)
//   node run.mjs --adapter ./my.mjs     # run YOUR agent adapter
//   node run.mjs --strict               # non-zero exit code if any case fails
//   node run.mjs --case ts-02           # run a single case
//
// An adapter exports:  default async function ({ prompt, tools }) -> { answer }
// `tools` is an array of { name, description, examples, call(args) }.
// Every call() you make is recorded for must_call / must_not_call checks.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { TOOLS } from "./mock-wms/tools.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : (args[i + 1] ?? true);
};
const adapterPath = flag("--adapter") || join(HERE, "adapters", "naive-baseline.mjs");
const onlyCase = flag("--case");
const strict = args.includes("--strict");
const verbose = args.includes("--verbose");

const cases = readFileSync(join(HERE, "evals", "cases.jsonl"), "utf8")
  .split("\n").filter(Boolean).map((l) => JSON.parse(l))
  .filter((c) => !onlyCase || c.id === onlyCase);

if (cases.length === 0) {
  console.error(`No cases matched${onlyCase ? ` id '${onlyCase}'` : ""}.`);
  process.exit(2);
}

const { default: adapter } = await import(
  adapterPath.startsWith("file:") ? adapterPath : "file://" + resolve(adapterPath)
);

function makeTools(recorder) {
  return Object.entries(TOOLS).map(([name, t]) => ({
    name,
    description: t.description,
    examples: t.examples || [],
    call: (callArgs = {}) => {
      recorder.push({ tool: name, args: callArgs });
      return t.call(callArgs);
    },
  }));
}

function argsSubset(expected, actual) {
  return Object.entries(expected || {}).every(
    ([k, v]) => JSON.stringify(actual?.[k]) === JSON.stringify(v)
  );
}

function evaluate(c, toolCalls, answer) {
  const failures = [];
  const ck = c.checks || {};
  for (const rule of ck.must_call || []) {
    const hit = toolCalls.some((tc) => tc.tool === rule.tool && argsSubset(rule.args, tc.args));
    if (!hit) failures.push(`must_call ${rule.tool}${rule.args ? " " + JSON.stringify(rule.args) : ""}`);
  }
  for (const tool of ck.must_not_call || []) {
    if (toolCalls.some((tc) => tc.tool === tool)) failures.push(`must_not_call ${tool}`);
  }
  for (const rx of ck.answer_must_match || []) {
    if (!new RegExp(rx, "i").test(answer)) failures.push(`answer must match /${rx}/`);
  }
  for (const rx of ck.answer_must_not_match || []) {
    if (new RegExp(rx, "i").test(answer)) failures.push(`answer must NOT match /${rx}/`);
  }
  return failures;
}

const results = [];
for (const c of cases) {
  const toolCalls = [];
  let answer = "";
  let error = null;
  try {
    const out = await adapter({ prompt: c.prompt, tools: makeTools(toolCalls) });
    answer = String(out?.answer ?? "");
  } catch (e) {
    error = e?.message || String(e);
  }
  const failures = error ? [`adapter error: ${error}`] : evaluate(c, toolCalls, answer);
  results.push({ ...c, answer, toolCalls, failures, pass: failures.length === 0 });
}

// ---------------------------------------------------------------- reporting
const pad = (s, n) => String(s).padEnd(n);
console.log(`\nfloor-truth — ${results.length} cases — adapter: ${adapterPath}\n`);
for (const r of results) {
  console.log(`${r.pass ? "PASS" : "FAIL"}  ${pad(r.id, 6)} ${pad(r.family, 24)} ${r.prompt}`);
  if (!r.pass) {
    for (const f of r.failures) console.log(`      ✗ ${f}`);
    console.log(`      trap: ${r.trap}`);
    console.log(`      answer: ${(verbose ? r.answer : r.answer.slice(0, 160)) || "(none)"}`);
    if (verbose) console.log(`      toolCalls: ${JSON.stringify(r.toolCalls)}`);
  }
}
const byFamily = {};
for (const r of results) {
  byFamily[r.family] ??= { pass: 0, total: 0 };
  byFamily[r.family].total++;
  if (r.pass) byFamily[r.family].pass++;
}
console.log("\n── by family ──────────────────────────────");
for (const [fam, s] of Object.entries(byFamily)) {
  console.log(`${pad(fam, 26)} ${s.pass}/${s.total}`);
}
const passed = results.filter((r) => r.pass).length;
console.log(`\nTOTAL: ${passed}/${results.length} passed\n`);
if (strict && passed < results.length) process.exit(1);
