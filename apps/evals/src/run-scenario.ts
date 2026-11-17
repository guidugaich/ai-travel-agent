import {
  addUsage,
  handleMessage,
  NO_USAGE,
  type AgentReply,
  type ChatRequest,
  type LlmClient,
  type LlmReply,
  type Message,
  type Usage,
} from "@ai-travel-agent/agent";
import { memoryConversations } from "@ai-travel-agent/agent/testing";
import type { User } from "@ai-travel-agent/core";
import { setupDeps, sharedLisbon, testUser, usEastCoast } from "@ai-travel-agent/core/testing";
import { checkRun } from "./check.ts";
import type { Scenario } from "./scenarios.ts";

export interface RunResult {
  readonly scenario: string;
  readonly passed: boolean;
  readonly failures: readonly string[];
  readonly reply: string;
  readonly outcome: AgentReply["outcome"] | "error";
  readonly toolsCalled: readonly string[];
  readonly usage: Usage;
  readonly ms: number;
  /** The whole conversation the model saw, plus its last reply, for reading why a run failed. */
  readonly transcript: readonly Message[];
}

/** The spec's default user: 30 minutes to the airport. */
const user: User = { id: testUser, transitMinutes: { airport: 30 } };

// eslint-disable-next-line no-restricted-properties -- measures latency only; each world has a fixed clock
const wallClockMs = () => performance.now();

/** One run of a scenario: its frozen world, the real agent, and the given model. */
export async function runScenario(scenario: Scenario, llm: LlmClient): Promise<RunResult> {
  const world = scenario.world ?? {};
  const { deps } = await setupDeps({
    ...(world.now === undefined ? {} : { now: world.now }),
    user,
    locations: world.locations ?? [sharedLisbon],
    trips: world.trips ?? [usEastCoast],
  });
  const conversations = memoryConversations();
  await conversations.append(testUser, scenario.history ?? []);
  const recorder = recording(llm);
  const started = wallClockMs();

  try {
    const answer = await handleMessage(testUser, scenario.message, {
      ...deps,
      llm: recorder.client,
      conversations,
    });
    const run = {
      reply: answer.text,
      outcome: answer.outcome,
      toolsCalled: recorder.toolsCalled(),
    };
    const failures = checkRun(scenario.expect, run);
    return {
      scenario: scenario.name,
      passed: failures.length === 0,
      failures,
      ...run,
      usage: answer.usage,
      ms: Math.round(wallClockMs() - started),
      transcript: recorder.transcript(),
    };
  } catch (error) {
    return {
      scenario: scenario.name,
      passed: false,
      failures: [`error: ${error instanceof Error ? error.message : String(error)}`],
      reply: "",
      outcome: "error",
      toolsCalled: recorder.toolsCalled(),
      usage: recorder.usage(),
      ms: Math.round(wallClockMs() - started),
      transcript: recorder.transcript(),
    };
  }
}

/** Wraps a model to keep every request and reply. */
function recording(llm: LlmClient) {
  const exchanges: { readonly request: ChatRequest; readonly reply: LlmReply }[] = [];
  const client: LlmClient = {
    chat: async (request) => {
      const reply = await llm.chat(request);
      exchanges.push({ request, reply });
      return reply;
    },
  };
  return {
    client,
    toolsCalled: () =>
      exchanges.flatMap((exchange) => exchange.reply.toolCalls.map((call) => call.name)),
    usage: () => exchanges.reduce((sum, exchange) => addUsage(sum, exchange.reply.usage), NO_USAGE),
    transcript: (): Message[] => {
      const last = exchanges.at(-1);
      if (last === undefined) return [];
      const { content, toolCalls } = last.reply;
      return [...last.request.messages, { role: "assistant", content, toolCalls }];
    },
  };
}
