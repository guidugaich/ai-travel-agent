import { describe, expect, test } from "vitest";
import { loadConfig } from "./config.ts";

const database = { DATABASE_URL: "postgresql://postgres@localhost:5432/dev" };
const telegram = {
  TELEGRAM_BOT_TOKEN: "123:fake-token",
  ALLOWED_TELEGRAM_IDS: "4242",
  ...database,
};

describe("loadConfig", () => {
  test("reads the token, the allowed Telegram ids and the database URL", () => {
    expect(
      loadConfig({
        TELEGRAM_BOT_TOKEN: "123:fake-token",
        ALLOWED_TELEGRAM_IDS: "4242, 9999",
        ...database,
      }),
    ).toEqual({
      ok: true,
      value: {
        token: "123:fake-token",
        allowedTelegramIds: new Set([4242, 9999]),
        databaseUrl: "postgresql://postgres@localhost:5432/dev",
        llm: null,
      },
    });
  });

  test("an empty allowlist is fine: the bot refuses everyone, and tells them their id", () => {
    expect(
      loadConfig({ TELEGRAM_BOT_TOKEN: "123:fake-token", ALLOWED_TELEGRAM_IDS: "", ...database }),
    ).toMatchObject({ ok: true, value: { allowedTelegramIds: new Set() } });
  });

  test("a missing token is refused, pointing to .env.example", () => {
    const result = loadConfig({});
    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.error).toMatch(/TELEGRAM_BOT_TOKEN[\s\S]*\.env\.example/);
  });

  test("a missing database URL is refused", () => {
    const result = loadConfig({ TELEGRAM_BOT_TOKEN: "123:fake-token" });
    expect(result.ok ? "" : result.error).toContain("DATABASE_URL");
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
