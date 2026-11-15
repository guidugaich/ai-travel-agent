import type { ChatRequest, LlmClient } from "../llm.ts";

export interface ScriptedReply {
  readonly text?: string;
  readonly toolCalls?: readonly { readonly name: string; readonly arguments: unknown }[];
}

/** A script step is a fixed reply, or one built from the request, e.g. to reuse an id a tool returned. */
export type ScriptStep = ScriptedReply | ((request: ChatRequest) => ScriptedReply);

/** A fake model that replies from a script, in order, and records every request it gets. */
export function scriptedLlm(
  script: readonly ScriptStep[],
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
      const reply = typeof step === "function" ? step(request) : step;
      return Promise.resolve({
        content: reply.text ?? "",
        toolCalls: (reply.toolCalls ?? []).map((call) => ({ id: `call-${nextCallId++}`, ...call })),
        usage: { inputTokens: 100, outputTokens: 10 },
      });
    },
  };
}

/** The last tool result the model was sent, parsed. */
export function lastToolResult(request: ChatRequest): unknown {
  const message = request.messages.findLast((candidate) => candidate.role === "tool");
  return message === undefined ? undefined : JSON.parse(message.content);
}
