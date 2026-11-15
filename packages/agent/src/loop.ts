import type { Result } from "@ai-travel-agent/core";
import {
  addUsage,
  NO_USAGE,
  type LlmClient,
  type Message,
  type ToolCall,
  type ToolDefinition,
  type Usage,
} from "./llm.ts";

/** Something the model can ask us to run. Bad arguments come back as an error the model reads; bugs throw. */
export interface Tool {
  readonly definition: ToolDefinition;
  run(args: unknown): Promise<Result<unknown, string>>;
}

export const MAX_MODEL_CALLS = 8;

/** `steps` are this turn's tool calls and their results, in the order they happened. */
export type LoopResult = (
  { readonly kind: "answer"; readonly text: string } | { readonly kind: "gave_up" }
) & { readonly steps: readonly Message[]; readonly calls: number; readonly usage: Usage };

/** Asks the model, runs the tools it asks for, and repeats until it answers or uses up `maxCalls`. */
export async function runLoop(
  llm: LlmClient,
  messages: readonly Message[],
  tools: readonly Tool[],
  maxCalls = MAX_MODEL_CALLS,
): Promise<LoopResult> {
  const definitions = tools.map((tool) => tool.definition);
  const steps: Message[] = [];
  let usage: Usage = NO_USAGE;

  for (let calls = 1; calls <= maxCalls; calls++) {
    const reply = await llm.chat({ messages: [...messages, ...steps], tools: definitions });
    usage = addUsage(usage, reply.usage);
    if (reply.toolCalls.length === 0) {
      return { kind: "answer", text: reply.content, steps, calls, usage };
    }

    steps.push({ role: "assistant", content: reply.content, toolCalls: reply.toolCalls });
    for (const toolCall of reply.toolCalls) {
      steps.push({
        role: "tool",
        toolCallId: toolCall.id,
        content: await runTool(tools, toolCall),
      });
    }
  }
  return { kind: "gave_up", steps, calls: maxCalls, usage };
}

async function runTool(tools: readonly Tool[], call: ToolCall): Promise<string> {
  const tool = tools.find((candidate) => candidate.definition.name === call.name);
  if (tool === undefined)
    return JSON.stringify({ error: `There is no tool called "${call.name}".` });
  const result = await tool.run(call.arguments);
  return JSON.stringify(result.ok ? result.value : { error: result.error });
}
