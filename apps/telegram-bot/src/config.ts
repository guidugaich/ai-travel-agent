import type { Result } from "@ai-travel-agent/core";
import { z } from "zod";

export interface Config {
  readonly token: string;
  readonly allowedTelegramIds: ReadonlySet<number>;
  /** Null means the stand-in model. */
  readonly llm: {
    readonly baseUrl: string;
    readonly model: string;
    readonly apiKey?: string;
  } | null;
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
  LLM_BASE_URL: z.url().optional(),
  LLM_MODEL: z.string().optional(),
  LLM_API_KEY: z.string().optional(),
});

/** The bot's settings, from environment variables (`pnpm bot` loads them from .env). */
export function loadConfig(
  env: Readonly<Record<string, string | undefined>>,
): Result<Config, string> {
  // `NAME=` in .env means "not set".
  const given = Object.fromEntries(Object.entries(env).filter(([, value]) => value !== ""));
  const parsed = settings.safeParse(given);
  if (!parsed.success) return invalid(z.prettifyError(parsed.error));

  const { LLM_BASE_URL: baseUrl, LLM_MODEL: model, LLM_API_KEY: apiKey } = parsed.data;
  if ((baseUrl === undefined) !== (model === undefined)) {
    return invalid("Set both LLM_BASE_URL and LLM_MODEL, or neither to use the stand-in model.");
  }
  return {
    ok: true,
    value: {
      token: parsed.data.TELEGRAM_BOT_TOKEN,
      allowedTelegramIds: new Set(parsed.data.ALLOWED_TELEGRAM_IDS),
      llm:
        baseUrl === undefined || model === undefined
          ? null
          : { baseUrl, model, ...(apiKey === undefined ? {} : { apiKey }) },
    },
  };
}

function invalid(problems: string): Result<never, string> {
  return {
    ok: false,
    error: `Missing or invalid settings:\n${problems}\nCopy .env.example to .env and fill it in.`,
  };
}
