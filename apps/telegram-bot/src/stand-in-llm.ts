import type { LlmClient } from "@ai-travel-agent/agent";

/** Until real models are connected (step 6): one fixed reply, so the Telegram side can be tried. */
export const standInLlm: LlmClient = {
  chat: () =>
    Promise.resolve({
      content:
        "I'm running with a stand-in model, so I can't answer questions yet. Sharing your location already works.",
      toolCalls: [],
      usage: { inputTokens: 0, outputTokens: 0 },
    }),
};
