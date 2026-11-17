import { describe, expect, test } from "vitest";
import { loadConfig } from "./config.ts";

describe("loadConfig", () => {
  test("reads the token and the allowed Telegram ids", () => {
    expect(
      loadConfig({ TELEGRAM_BOT_TOKEN: "123:fake-token", ALLOWED_TELEGRAM_IDS: "4242, 9999" }),
    ).toEqual({
      ok: true,
      value: { token: "123:fake-token", allowedTelegramIds: new Set([4242, 9999]) },
    });
  });

  test("an empty allowlist is fine: the bot refuses everyone, and tells them their id", () => {
    expect(loadConfig({ TELEGRAM_BOT_TOKEN: "123:fake-token", ALLOWED_TELEGRAM_IDS: "" })).toEqual({
      ok: true,
      value: { token: "123:fake-token", allowedTelegramIds: new Set() },
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
