import type { ChatRequest } from "@ai-travel-agent/agent";
import { describe, expect, test } from "vitest";
import { openAiCompatible } from "./openai-compatible.ts";

/** A stand-in for `fetch` that records each request and answers with a fixed status and body. */
function fakeFetch(status: number, body: unknown) {
  const requests: { url: string; init: RequestInit }[] = [];
  const fetch: typeof globalThis.fetch = (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    requests.push({ url, init: init ?? {} });
    return Promise.resolve(new Response(JSON.stringify(body), { status }));
  };
  return {
    fetch,
    requests,
    sentBody: () => {
      const sent = requests[0]?.init.body;
      return typeof sent === "string" ? (JSON.parse(sent) as unknown) : undefined;
    },
  };
}

/** A chat completions response, as the API returns it, around one assistant message. */
function completion(message: Record<string, unknown>) {
  return {
    id: "chatcmpl-1",
    object: "chat.completion",
    created: 0,
    model: "some-model",
    choices: [{ index: 0, message: { role: "assistant", ...message }, finish_reason: "stop" }],
    usage: { prompt_tokens: 120, completion_tokens: 15, total_tokens: 135 },
  };
}

const noTools: ChatRequest = { messages: [{ role: "user", content: "Hi" }], tools: [] };

describe("openAiCompatible", () => {
  test("sends the conversation and the tools in the chat completions format", async () => {
    const api = fakeFetch(200, completion({ content: "Done." }));
    const llm = openAiCompatible({
      baseUrl: "https://llm.example/v1",
      model: "some-model",
      apiKey: "secret",
      fetch: api.fetch,
    });

    await llm.chat({
      messages: [
        { role: "system", content: "Instructions" },
        { role: "user", content: "When is my flight?" },
        {
          role: "assistant",
          content: "",
          toolCalls: [{ id: "call-1", name: "get_next_event", arguments: { kind: "flight" } }],
        },
        { role: "tool", toolCallId: "call-1", content: '{"title":"Flight"}' },
      ],
      tools: [
        { name: "get_next_event", description: "The next event", parameters: { type: "object" } },
      ],
    });

    const [request] = api.requests;
    expect(request?.url).toBe("https://llm.example/v1/chat/completions");
    expect(request?.init).toMatchObject({
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer secret" },
    });
    expect(request?.init.signal).toBeInstanceOf(AbortSignal);
    expect(api.sentBody()).toEqual({
      model: "some-model",
      messages: [
        { role: "system", content: "Instructions" },
        { role: "user", content: "When is my flight?" },
        {
          role: "assistant",
          content: "",
          tool_calls: [
            {
              id: "call-1",
              type: "function",
              function: { name: "get_next_event", arguments: '{"kind":"flight"}' },
            },
          ],
        },
        { role: "tool", tool_call_id: "call-1", content: '{"title":"Flight"}' },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "get_next_event",
            description: "The next event",
            parameters: { type: "object" },
          },
        },
      ],
    });
  });

  test("without an API key, no Authorization header is sent (Ollama ignores it anyway)", async () => {
    const api = fakeFetch(200, completion({ content: "Hi." }));
    const llm = openAiCompatible({
      baseUrl: "http://localhost:11434/v1/",
      model: "m",
      fetch: api.fetch,
    });
    await llm.chat(noTools);
    expect(api.requests[0]?.url).toBe("http://localhost:11434/v1/chat/completions");
    expect(api.requests[0]?.init.headers).toEqual({ "content-type": "application/json" });
  });

  test("with no tools, the field is left out, since some providers reject an empty list", async () => {
    const api = fakeFetch(200, completion({ content: "Hi." }));
    await openAiCompatible({ baseUrl: "http://x/v1", model: "m", fetch: api.fetch }).chat(noTools);
    expect(api.sentBody()).not.toHaveProperty("tools");
  });

  test("a text reply comes back with its token counts", async () => {
    const api = fakeFetch(200, completion({ content: "It's 10:12 in Lisbon." }));
    const reply = await openAiCompatible({
      baseUrl: "http://x/v1",
      model: "m",
      fetch: api.fetch,
    }).chat(noTools);
    expect(reply).toEqual({
      content: "It's 10:12 in Lisbon.",
      toolCalls: [],
      usage: { inputTokens: 120, outputTokens: 15 },
    });
  });

  test("tool calls come back with their arguments parsed", async () => {
    const api = fakeFetch(
      200,
      completion({
        content: null,
        tool_calls: [
          {
            id: "call-7",
            type: "function",
            function: { name: "get_next_event", arguments: '{"kind":"flight"}' },
          },
        ],
      }),
    );
    const reply = await openAiCompatible({
      baseUrl: "http://x/v1",
      model: "m",
      fetch: api.fetch,
    }).chat(noTools);
    expect(reply).toMatchObject({
      content: "",
      toolCalls: [{ id: "call-7", name: "get_next_event", arguments: { kind: "flight" } }],
    });
  });

  test("arguments that aren't valid JSON are passed on as written, for the tool to refuse", async () => {
    const api = fakeFetch(
      200,
      completion({
        tool_calls: [
          {
            id: "call-8",
            type: "function",
            function: { name: "get_next_event", arguments: "{kind:" },
          },
        ],
      }),
    );
    const reply = await openAiCompatible({
      baseUrl: "http://x/v1",
      model: "m",
      fetch: api.fetch,
    }).chat(noTools);
    expect(reply.toolCalls[0]?.arguments).toBe("{kind:");
  });

  test("an HTTP error says what the provider said", async () => {
    const api = fakeFetch(401, { error: { message: "Incorrect API key provided" } });
    const llm = openAiCompatible({ baseUrl: "http://x/v1", model: "m", fetch: api.fetch });
    await expect(llm.chat(noTools)).rejects.toThrow(
      "LLM request failed with HTTP 401: Incorrect API key provided",
    );
  });

  test("a reply in an unexpected shape is an error straight away", async () => {
    const api = fakeFetch(200, { choices: [] });
    const llm = openAiCompatible({ baseUrl: "http://x/v1", model: "m", fetch: api.fetch });
    await expect(llm.chat(noTools)).rejects.toThrow("LLM reply in an unexpected format");
  });
});
