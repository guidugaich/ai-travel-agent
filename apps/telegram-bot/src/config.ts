import type { Result } from "@ai-travel-agent/core";
import { z } from "zod";

export interface Config {
  readonly token: string;
  readonly allowedTelegramIds: ReadonlySet<number>;
}

const settings = z.object({
  TELEGRAM_BOT_TOKEN: z
    .string()
    .regex(/^\d+:[\w-]+$/, "Expected the token BotFather gave you, like 123456:ABC-xyz"),
  ALLOWED_TELEGRAM_IDS: z
    .string()
    .default("")
    .transform((ids) =>
      ids
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id !== "")
        .map(Number),
    )
    .pipe(z.array(z.int().positive())),
});

/** The bot's settings, from environment variables (`pnpm bot` loads them from .env). */
export function loadConfig(
  env: Readonly<Record<string, string | undefined>>,
): Result<Config, string> {
  const parsed = settings.safeParse(env);
  if (!parsed.success) {
    return {
      ok: false,
      error: `Missing or invalid settings:\n${z.prettifyError(parsed.error)}\nCopy .env.example to .env and fill it in.`,
    };
  }
  return {
    ok: true,
    value: {
      token: parsed.data.TELEGRAM_BOT_TOKEN,
      allowedTelegramIds: new Set(parsed.data.ALLOWED_TELEGRAM_IDS),
    },
  };
}
