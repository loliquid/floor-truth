// Real-LLM adapter: wires an Anthropic model into the floor-truth runner via
// the plain Messages API tool-use loop. Zero dependencies (global fetch).
//
//   ANTHROPIC_API_KEY=sk-... node run.mjs --adapter ./adapters/llm-anthropic.mjs
//   FLOOR_TRUTH_MODEL=claude-haiku-4-5-20251001 node run.mjs --adapter ./adapters/llm-anthropic.mjs
//
// Deliberately neutral: the system prompt contains NO knowledge of the traps.
// The model gets exactly what any real integration gets — the tool names,
// descriptions, and examples, as exposed. That's the point of the benchmark.

const API = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.FLOOR_TRUTH_MODEL || "claude-sonnet-5";
const KEY = process.env.ANTHROPIC_API_KEY;

const SYSTEM =
  "You are an operations assistant for a third-party logistics (3PL) warehouse. " +
  "Answer the user's question using the available warehouse-system tools. " +
  "Ground every figure in tool results. Be accurate and honest about the " +
  "limits of what the data shows. Today's date: 2026-07-18.";

function apiTools(tools) {
  return tools.map((t) => ({
    name: t.name,
    description:
      t.description +
      (t.examples?.length
        ? "\nExample call: " + t.examples.map((e) => JSON.stringify(e)).join(" | ")
        : ""),
    input_schema: { type: "object", additionalProperties: true },
  }));
}

async function callApi(body, attempt = 0) {
  const res = await fetch(API, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });
  if ((res.status === 429 || res.status >= 500) && attempt < 3) {
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    return callApi(body, attempt + 1);
  }
  if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

export default async function llmAnthropic({ prompt, tools }) {
  if (!KEY) throw new Error("ANTHROPIC_API_KEY is not set");
  const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
  const messages = [{ role: "user", content: prompt }];

  for (let round = 0; round < 12; round++) {
    const resp = await callApi({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM,
      tools: apiTools(tools),
      messages,
    });

    const toolUses = resp.content.filter((b) => b.type === "tool_use");
    if (resp.stop_reason !== "tool_use" || toolUses.length === 0) {
      const answer = resp.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
      return { answer };
    }

    messages.push({ role: "assistant", content: resp.content });
    messages.push({
      role: "user",
      content: toolUses.map((tu) => {
        let result;
        try {
          result = byName[tu.name] ? byName[tu.name].call(tu.input || {}) : { error: "unknown tool" };
        } catch (e) {
          result = { error: String(e?.message || e) };
        }
        return {
          type: "tool_result",
          tool_use_id: tu.id,
          content: JSON.stringify(result),
        };
      }),
    });
  }
  return { answer: "(tool loop exceeded 12 rounds without a final answer)" };
}
