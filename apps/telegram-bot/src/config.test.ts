import { describe, expect, test } from "vitest";
import { loadConfig } from "./config.ts";

const telegram = { TELEGRAM_BOT_TOKEN: "123:fake-token", ALLOWED_TELEGRAM_IDS: "4242" };

describe("loadConfig", () => {
  test("reads the token and the allowed Telegram ids", () => {
    expect(
      loadConfig({ TELEGRAM_BOT_TOKEN: "123:fake-token", ALLOWED_TELEGRAM_IDS: "4242, 9999" }),
    ).toEqual({
      ok: true,
      value: { token: "123:fake-token", allowedTelegramIds: new Set([4242, 9999]), llm: null },
    });
  });

  test("an empty allowlist is fine: the bot refuses everyone, and tells them their id", () => {
    expect(loadConfig({ TELEGRAM_BOT_TOKEN: "123:fake-token", ALLOWED_TELEGRAM_IDS: "" })).toEqual({
      ok: true,
      value: { token: "123:fake-token", allowedTelegramIds: new Set(), llm: null },
    });
  });

  test("a missing token is refused, pointing to .env.example", () => {
    const result = loadConfig({});
    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.error).toMatch(/TELEGRAM_BOT_TOKEN[\s\S]*\.env\.example/);
  });

  test("an id that isn't a number is refused", () => {
    const result = loadConfig({ TELEGRAM_BOT_TOKEN: "123:fake-token", ALLOWED_TELEGRAM_IDS: "me" });
    expect(result.ok ? "" : result.error).toContain("ALLOWED_TELEGRAM_IDS");
  });
});

describe("loadConfig: the language model", () => {
  test("empty model settings, as in .env.example, mean the stand-in model", () => {
    expect(
      loadConfig({ ...telegram, LLM_BASE_URL: "", LLM_MODEL: "", LLM_API_KEY: "" }),
    ).toMatchObject({
      ok: true,
      value: { llm: null },
    });
  });

  test("a local model needs no API key", () => {
    expect(
      loadConfig({
        ...telegram,
        LLM_BASE_URL: "http://localhost:11434/v1",
        LLM_MODEL: "some-model",
      }),
    ).toMatchObject({
      ok: true,
      value: { llm: { baseUrl: "http://localhost:11434/v1", model: "some-model" } },
    });
  });

  test("a hosted model gets its API key", () => {
    const result = loadConfig({
      ...telegram,
      LLM_BASE_URL: "https://llm.example/v1",
      LLM_MODEL: "some-model",
      LLM_API_KEY: "secret",
    });
    expect(result).toMatchObject({ ok: true, value: { llm: { apiKey: "secret" } } });
  });

  test("a model without a base URL, or the other way round, is refused", () => {
    const result = loadConfig({ ...telegram, LLM_MODEL: "some-model" });
    expect(result.ok ? "" : result.error).toMatch(/LLM_BASE_URL and LLM_MODEL/);
  });

  test("a base URL that isn't a URL is refused", () => {
    const result = loadConfig({ ...telegram, LLM_BASE_URL: "localhost", LLM_MODEL: "some-model" });
    expect(result.ok ? "" : result.error).toContain("LLM_BASE_URL");
  });
});
