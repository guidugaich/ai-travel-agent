/** What the agent needs from any LLM: send the conversation and the tools, get the next reply. */
export interface LlmClient {
  chat(request: ChatRequest): Promise<LlmReply>;
}

export interface ChatRequest {
  readonly messages: readonly Message[];
  readonly tools: readonly ToolDefinition[];
}

export type Message =
  | { readonly role: "system"; readonly content: string }
  | { readonly role: "user"; readonly content: string }
  | {
      readonly role: "assistant";
      readonly content: string;
      readonly toolCalls?: readonly ToolCall[];
    }
  | { readonly role: "tool"; readonly toolCallId: string; readonly content: string };

/** The model asking us to run a tool. `arguments` is whatever it sent, so it's validated before use. */
export interface ToolCall {
  readonly id: string;
  readonly name: string;
  readonly arguments: unknown;
}

/** How a tool is described to the model. `parameters` is a JSON Schema. */
export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameters: Readonly<Record<string, unknown>>;
}

export interface LlmReply {
  /** Text for the user. Often empty when the model is only calling tools. */
  readonly content: string;
  readonly toolCalls: readonly ToolCall[];
  readonly usage: Usage;
}

export interface Usage {
  readonly inputTokens: number;
  readonly outputTokens: number;
}
