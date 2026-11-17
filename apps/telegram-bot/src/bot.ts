import { handleMessage, type AgentDeps } from "@ai-travel-agent/agent";
import { cityName, setLocation, type UserId } from "@ai-travel-agent/core";
import { find as zonesAt } from "geo-tz";
import { Bot, Keyboard, type Context } from "grammy";
import type { UserFromGetMe } from "grammy/types";

export interface BotDeps extends AgentDeps {
  /** Telegram ids that get answers. Everyone else gets one refusal that tells them their id. */
  readonly allowedTelegramIds: ReadonlySet<number>;
  /** Our user id for a Telegram account, created on first contact. */
  readonly userIdFor: (telegramId: number) => Promise<UserId>;
}

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
export function createBot(token: string, deps: BotDeps, botInfo?: UserFromGetMe): Bot {
  const bot = new Bot(token, botInfo === undefined ? {} : { botInfo });
  const keyboard = new Keyboard().requestLocation(REPLIES.shareButton).persistent().resized();
  const reply = (ctx: Context, text: string) => ctx.reply(text, { reply_markup: keyboard });
  const refused = new Set<number>();

  // Only private chats with allowed people get further.
  bot.use(async (ctx, next) => {
    const telegramId = ctx.from?.id;
    if (ctx.chat?.type !== "private" || telegramId === undefined) return;
    if (deps.allowedTelegramIds.has(telegramId)) {
      await next();
    } else if (!refused.has(telegramId)) {
      refused.add(telegramId);
      await ctx.reply(REPLIES.private(telegramId));
    }
  });

  bot.use(async (ctx, next) => {
    try {
      await next();
    } catch (error) {
      await ctx.reply(REPLIES.failed).catch(() => undefined);
      throw error;
    }
  });

  bot.command("start", (ctx) => reply(ctx, REPLIES.start));

  // A shared location goes straight to the core: the model can't fake one.
  bot.on(["message:location", "edited_message:location"], async (ctx) => {
    const { latitude, longitude } = ctx.msg.location;
    const zone = zonesAt(latitude, longitude)[0];
    const userId = await deps.userIdFor(ctx.from.id);
    const result =
      zone === undefined
        ? undefined
        : await setLocation(
            userId,
            { zone, placeName: cityName(zone), source: "shared_location" },
            deps,
          );
    if (ctx.editedMessage !== undefined) return; // live location updates: saved quietly
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
    const userId = await deps.userIdFor(ctx.from.id);
    await ctx.replyWithChatAction("typing");
    const answer = await handleMessage(userId, ctx.message.text, deps);
    await reply(ctx, answer.text);
  });

  bot.on("message", (ctx) => reply(ctx, REPLIES.unsupported));

  return bot;
}
