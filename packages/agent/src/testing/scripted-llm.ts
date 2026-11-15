import type { ChatRequest, LlmClient } from "../llm.ts";

export interface ScriptedReply {
  readonly text?: string;
  readonly toolCalls?: readonly { readonly name: string; readonly arguments: unknown }[];
}

/** A fake model that replies from a script, in order, and records every request it gets. */
export function scriptedLlm(
  script: readonly ScriptedReply[],
): LlmClient & { readonly requests: readonly ChatRequest[] } {
  const requests: ChatRequest[] = [];
  let nextCallId = 1;
  return {
    requests,
    chat(request) {
      requests.push(request);
      const step = script[requests.length - 1];
      if (step === undefined) {
        return Promise.reject(
          new Error(`The script has no reply for model call ${requests.length}`),
        );
      }
      return Promise.resolve({
        content: step.text ?? "",
        toolCalls: (step.toolCalls ?? []).map((call) => ({ id: `call-${nextCallId++}`, ...call })),
        usage: { inputTokens: 100, outputTokens: 10 },
      });
    },
  };
}
