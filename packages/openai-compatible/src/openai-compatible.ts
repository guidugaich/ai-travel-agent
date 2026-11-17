import type { LlmClient, Message, ToolCall, ToolDefinition } from "@ai-travel-agent/agent";
import { z } from "zod";

export interface OpenAiCompatibleOptions {
  /** Up to and including /v1, such as http://localhost:11434/v1 for Ollama. */
  readonly baseUrl: string;
  readonly model: string;
  /** Sent as a Bearer token. Ollama doesn't need one. */
  readonly apiKey?: string;
  readonly timeoutMs?: number;
  /** Tests pass a fake. */
  readonly fetch?: typeof fetch;
}

const completionSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullish(),
          tool_calls: z
            .array(
              z.object({
                id: z.string(),
                function: z.object({
                  name: z.string(),
                  arguments: z.union([z.string(), z.record(z.string(), z.unknown())]),
                }),
              }),
            )
            .nullish(),
        }),
      }),
    )
    .min(1),
  usage: z.object({ prompt_tokens: z.number(), completion_tokens: z.number() }).nullish(),
});

const errorSchema = z.object({ error: z.object({ message: z.string() }) });

/** Our LlmClient port over the "chat completions" HTTP format that OpenAI, Ollama and many others accept. */
export function openAiCompatible(options: OpenAiCompatibleOptions): LlmClient {
  const url = `${options.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const send = options.fetch ?? fetch;
  const auth =
    options.apiKey === undefined || options.apiKey === ""
      ? {}
      : { authorization: `Bearer ${options.apiKey}` };

  return {
    async chat({ messages, tools }) {
      const response = await send(url, {
        method: "POST",
        headers: { "content-type": "application/json", ...auth },
        body: JSON.stringify({
          model: options.model,
          messages: messages.map(toWireMessage),
          ...(tools.length > 0 ? { tools: tools.map(toWireTool) } : {}),
        }),
        signal: AbortSignal.timeout(options.timeoutMs ?? 60_000),
      });
      if (!response.ok) {
        throw new Error(
          `LLM request failed with HTTP ${response.status}: ${errorDetail(await response.text())}`,
        );
      }

      const parsed = completionSchema.safeParse(await response.json());
      if (!parsed.success) {
        throw new Error(`LLM reply in an unexpected format:\n${z.prettifyError(parsed.error)}`);
      }
      const [choice] = parsed.data.choices;
      const message = choice?.message;
      return {
        content: message?.content ?? "",
        toolCalls: (message?.tool_calls ?? []).map((call): ToolCall => ({
          id: call.id,
          name: call.function.name,
          arguments: parseArguments(call.function.arguments),
        })),
        usage: {
          inputTokens: parsed.data.usage?.prompt_tokens ?? 0,
          outputTokens: parsed.data.usage?.completion_tokens ?? 0,
        },
      };
    },
  };
}

function toWireMessage(message: Message) {
  switch (message.role) {
    case "system":
    case "user":
      return { role: message.role, content: message.content };
    case "assistant":
      return {
        role: "assistant",
        content: message.content,
        ...(message.toolCalls === undefined || message.toolCalls.length === 0
          ? {}
          : {
              tool_calls: message.toolCalls.map((call) => ({
                id: call.id,
                type: "function",
                function: {
                  name: call.name,
                  // Arguments the model wrote as invalid JSON were kept as text; send them back as written.
                  arguments:
                    typeof call.arguments === "string"
                      ? call.arguments
                      : JSON.stringify(call.arguments),
                },
              })),
            }),
      };
    case "tool":
      return { role: "tool", tool_call_id: message.toolCallId, content: message.content };
  }
}

function toWireTool(tool: ToolDefinition) {
  return {
    type: "function",
    function: { name: tool.name, description: tool.description, parameters: tool.parameters },
  };
}

/** The spec says a JSON-encoded string; some servers send an object. Invalid JSON stays text. */
function parseArguments(raw: string | Record<string, unknown>): unknown {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

function errorDetail(body: string): string {
  try {
    const parsed = errorSchema.safeParse(JSON.parse(body));
    if (parsed.success) return parsed.data.error.message;
  } catch {
    // Not JSON: fall through to the raw text.
  }
  return body.slice(0, 300);
}
