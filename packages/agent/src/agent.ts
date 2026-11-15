import { currentContext, type Context, type Deps, type UserId } from "@ai-travel-agent/core";
import type { ConversationStore } from "./conversation.ts";
import { addUsage, type LlmClient, type Message, type Usage } from "./llm.ts";
import { MAX_MODEL_CALLS, runLoop, type Tool } from "./loop.ts";
import { unsupportedValues } from "./output-check.ts";
import { buildPreamble } from "./preamble.ts";
import { createTools } from "./tools.ts";

export interface AgentDeps extends Deps {
  readonly llm: LlmClient;
  readonly conversations: ConversationStore;
}

export interface AgentReply {
  readonly text: string;
  /** How the reply was reached, for logs: first try, after the output check's retry, or neither. */
  readonly outcome: "answered" | "corrected" | "fallback" | "gave_up";
  readonly usage: Usage;
}

const REPLIES = {
  gaveUp: "Sorry, I couldn't work that out. Could you ask in another way?",
  fallback: "I couldn't phrase that reliably, so here is what I computed:",
};

/** One message in, one reply out: the preamble, history, the agent loop and the output check. */
export async function handleMessage(
  userId: UserId,
  text: string,
  deps: AgentDeps,
): Promise<AgentReply> {
  const [context, history] = await Promise.all([
    currentContext(userId, deps),
    deps.conversations.recent(userId),
  ]);
  const preamble = buildPreamble(context);
  const messages: Message[] = [
    { role: "system", content: preamble },
    ...history,
    { role: "user", content: text },
  ];

  const reply = await answer(deps.llm, messages, createTools(userId, deps), preamble, context);
  await deps.conversations.append(userId, [
    { role: "user", content: text },
    { role: "assistant", content: reply.text },
  ]);
  return reply;
}

async function answer(
  llm: LlmClient,
  messages: readonly Message[],
  tools: readonly Tool[],
  preamble: string,
  context: Context,
): Promise<AgentReply> {
  const first = await runLoop(llm, messages, tools);
  if (first.kind === "gave_up") {
    return { text: REPLIES.gaveUp, outcome: "gave_up", usage: first.usage };
  }
  const firstResults = toolResults(first.steps);
  const unsupported = unsupportedValues(first.text, [preamble, ...firstResults]);
  if (unsupported.length === 0) {
    return { text: first.text, outcome: "answered", usage: first.usage };
  }

  const retry = await runLoop(
    llm,
    [
      ...messages,
      ...first.steps,
      { role: "assistant", content: first.text },
      { role: "user", content: feedback(unsupported) },
    ],
    tools,
    MAX_MODEL_CALLS - first.calls,
  );
  const usage = addUsage(first.usage, retry.usage);
  const results = [...firstResults, ...toolResults(retry.steps)];
  if (
    retry.kind === "answer" &&
    unsupportedValues(retry.text, [preamble, ...results]).length === 0
  ) {
    return { text: retry.text, outcome: "corrected", usage };
  }
  return { text: fallback(results.at(-1), context), outcome: "fallback", usage };
}

function toolResults(steps: readonly Message[]): string[] {
  return steps.flatMap((step) => (step.role === "tool" ? [step.content] : []));
}

function feedback(unsupported: readonly string[]): string {
  return `(Automatic check, not from the user.) These values in your reply aren't in the context or in a tool result from this turn: ${unsupported.join(", ")}. Call the tools you need, then copy every time, date, duration and relative day exactly as written. Answer the user's last message again.`;
}

/** The last tool result (or, if no tool ran, the context), as code rather than prose. */
function fallback(toolResult: string | undefined, context: Context): string {
  const computed = toolResult === undefined ? context : (JSON.parse(toolResult) as unknown);
  return `${REPLIES.fallback}\n\`\`\`\n${JSON.stringify(computed, null, 2)}\n\`\`\``;
}
