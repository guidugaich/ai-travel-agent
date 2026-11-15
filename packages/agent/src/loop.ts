import type { Result } from "@ai-travel-agent/core";
import type { LlmClient, Message, ToolCall, ToolDefinition, Usage } from "./llm.ts";

/** Something the model can ask us to run. Bad arguments come back as an error the model reads; bugs throw. */
export interface Tool {
  readonly definition: ToolDefinition;
  run(args: unknown): Promise<Result<unknown, string>>;
}

export const MAX_MODEL_CALLS = 8;

/** `steps` are this turn's tool calls and their results, in the order they happened. */
export type LoopResult =
  | {
      readonly kind: "answer";
      readonly text: string;
      readonly steps: readonly Message[];
      readonly usage: Usage;
    }
  | { readonly kind: "gave_up"; readonly steps: readonly Message[]; readonly usage: Usage };

/** Asks the model, runs the tools it asks for, and repeats until it answers or hits the call limit. */
export async function runLoop(
  llm: LlmClient,
  messages: readonly Message[],
  tools: readonly Tool[],
): Promise<LoopResult> {
  const definitions = tools.map((tool) => tool.definition);
  const steps: Message[] = [];
  let usage: Usage = { inputTokens: 0, outputTokens: 0 };

  for (let call = 1; call <= MAX_MODEL_CALLS; call++) {
    const reply = await llm.chat({ messages: [...messages, ...steps], tools: definitions });
    usage = {
      inputTokens: usage.inputTokens + reply.usage.inputTokens,
      outputTokens: usage.outputTokens + reply.usage.outputTokens,
    };
    if (reply.toolCalls.length === 0) return { kind: "answer", text: reply.content, steps, usage };

    steps.push({ role: "assistant", content: reply.content, toolCalls: reply.toolCalls });
    for (const toolCall of reply.toolCalls) {
      steps.push({
        role: "tool",
        toolCallId: toolCall.id,
        content: await runTool(tools, toolCall),
      });
    }
  }
  return { kind: "gave_up", steps, usage };
}

async function runTool(tools: readonly Tool[], call: ToolCall): Promise<string> {
  const tool = tools.find((candidate) => candidate.definition.name === call.name);
  if (tool === undefined)
    return JSON.stringify({ error: `There is no tool called "${call.name}".` });
  const result = await tool.run(call.arguments);
  return JSON.stringify(result.ok ? result.value : { error: result.error });
}
