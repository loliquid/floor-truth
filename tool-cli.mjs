#!/usr/bin/env node
// Spoiler-free tool access for the manual protocol (testing agents that have
// no API — IDE agents, chat UIs). Exposes ONLY what a real integration sees:
// tool names, descriptions, examples — never the implementation comments or
// the ground-truth map.
//
//   node tool-cli.mjs list                       # tool catalog (JSON)
//   node tool-cli.mjs call <tool> '<json-args>'  # execute one tool call
//
// Agent-under-test rules: interact with the mock WMS ONLY through this CLI.
// Do not open mock-wms/*.mjs, evals/, patterns/, essay/, or adapters/ —
// they contain the answers, and reading them invalidates the run.

import { TOOLS } from "./mock-wms/tools.mjs";

const [, , cmd, name, argsJson] = process.argv;

if (cmd === "list") {
  const catalog = Object.entries(TOOLS).map(([n, t]) => ({
    name: n,
    description: t.description,
    examples: t.examples || [],
  }));
  console.log(JSON.stringify(catalog, null, 2));
} else if (cmd === "call") {
  const tool = TOOLS[name];
  if (!tool) {
    console.log(JSON.stringify({ error: `unknown tool '${name}'` }));
    process.exit(1);
  }
  let args = {};
  try {
    args = argsJson ? JSON.parse(argsJson) : {};
  } catch {
    console.log(JSON.stringify({ error: "args must be valid JSON" }));
    process.exit(1);
  }
  console.log(JSON.stringify(tool.call(args), null, 2));
} else {
  console.log("usage: node tool-cli.mjs list | node tool-cli.mjs call <tool> '<json-args>'");
  process.exit(1);
}
