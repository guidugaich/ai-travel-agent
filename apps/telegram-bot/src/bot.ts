import { handleMessage, type AgentDeps, type AgentReply } from "@ai-travel-agent/agent";
import { cityName, setLocation, type UserId } from "@ai-travel-agent/core";
import { find as zonesAt } from "geo-tz";
import { Bot, Keyboard, type Context } from "grammy";
import type { UserFromGetMe } from "grammy/types";

/** What gets logged: ids, outcomes, counts and timings, never message text, coordinates or places. */
export type LogEntry =
  | {
      readonly event: "reply";
      readonly userId: UserId;
      readonly outcome: AgentReply["outcome"];
      readonly inputTokens: number;
      readonly outputTokens: number;
      readonly ms: number;
    }
  | { readonly event: "location"; readonly userId: UserId; readonly live: boolean }
  | { readonly event: "error"; readonly userId: UserId; readonly error: string };

export interface BotDeps extends AgentDeps {
  /** Telegram ids that get answers. Everyone else gets one refusal that tells them their id. */
  readonly allowedTelegramIds: ReadonlySet<number>;
  /** Our user id for a Telegram account, created on first contact. */
  readonly userIdFor: (telegramId: number) => Promise<UserId>;
  readonly log: (entry: LogEntry) => void;
}

type BotContext = Context & { userId: UserId };

const REPLIES = {
  start:
    "Hi! Ask me what time it is anywhere, or about the events in your trip. To keep local times right, share your location with the button below.",
  private: (telegramId: number) => `Sorry, this bot is private. Your Telegram id is ${telegramId}.`,
  locationSaved: (place: string, localTime: string) =>
    `Location saved: ${place} time, ${localTime} now.`,
  locationUnknown: "I couldn't find a timezone for that location.",
  unsupported: "I can read text messages and shared locations.",
  failed: "Sorry, something went wrong. Please try again.",
  shareButton: "Share my location",
};

/** The Telegram adapter: turns updates into calls to the agent and the core, and replies. */
export function createBot(token: string, deps: BotDeps, botInfo?: UserFromGetMe): Bot<BotContext> {
  const bot = new Bot<BotContext>(token, botInfo === undefined ? {} : { botInfo });
  const keyboard = new Keyboard().requestLocation(REPLIES.shareButton).persistent().resized();
  const reply = (ctx: Context, text: string) => ctx.reply(text, { reply_markup: keyboard });
  const refused = new Set<number>();

  // Who is this, may they use the bot, and what happens if handling their update fails.
  bot.use(async (ctx, next) => {
    const telegramId = ctx.from?.id;
    if (ctx.chat?.type !== "private" || telegramId === undefined) return;
    if (!deps.allowedTelegramIds.has(telegramId)) {
      if (!refused.has(telegramId)) {
        refused.add(telegramId);
        await ctx.reply(REPLIES.private(telegramId));
      }
      return;
    }

    ctx.userId = await deps.userIdFor(telegramId);
    try {
      await next();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      deps.log({ event: "error", userId: ctx.userId, error: message });
      await ctx.reply(REPLIES.failed).catch(() => undefined);
    }
  });

  bot.command("start", (ctx) => reply(ctx, REPLIES.start));

  // A shared location goes straight to the core: the model can't fake one.
  bot.on(["message:location", "edited_message:location"], async (ctx) => {
    const { latitude, longitude } = ctx.msg.location;
    const zone = zonesAt(latitude, longitude)[0];
    const result =
      zone === undefined
        ? undefined
        : await setLocation(
            ctx.userId,
            { zone, placeName: cityName(zone), source: "shared_location" },
            deps,
          );
    const live = ctx.editedMessage !== undefined;
    deps.log({ event: "location", userId: ctx.userId, live });
    if (live) return; // live location updates: saved quietly
    if (result?.ok !== true) {
      await reply(ctx, REPLIES.locationUnknown);
      return;
    }
    const { current } = result.value;
    if (current.kind === "known") {
      await reply(ctx, REPLIES.locationSaved(current.place, current.localTime));
    }
  });

  bot.on("message:text", async (ctx) => {
    const started = deps.clock.now();
    await ctx.replyWithChatAction("typing");
    const answer = await handleMessage(ctx.userId, ctx.message.text, deps);
    await reply(ctx, answer.text.replaceAll("**", "")); // Telegram would show the model's bold as asterisks
    deps.log({
      event: "reply",
      userId: ctx.userId,
      outcome: answer.outcome,
      inputTokens: answer.usage.inputTokens,
      outputTokens: answer.usage.outputTokens,
      ms: started.until(deps.clock.now()).total({ unit: "milliseconds" }),
    });
  });

  bot.on("message", (ctx) => reply(ctx, REPLIES.unsupported));

  return bot;
}
