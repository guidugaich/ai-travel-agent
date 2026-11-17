import { memoryConversations, scriptedLlm, type ScriptStep } from "@ai-travel-agent/agent/testing";
import type { Location } from "@ai-travel-agent/core";
import {
  setupDeps,
  sharedLisbon,
  testUser as user,
  usEastCoast,
} from "@ai-travel-agent/core/testing";
import type { Chat, Message, Update, UserFromGetMe } from "grammy/types";
import { describe, expect, test } from "vitest";
import { createBot, type LogEntry } from "./bot.ts";

const you = 4242;
const stranger = 9999;

const botInfo: UserFromGetMe = {
  id: 1,
  is_bot: true,
  first_name: "Test bot",
  username: "test_bot",
  can_join_groups: false,
  can_read_all_group_messages: false,
  supports_inline_queries: false,
  can_connect_to_business: false,
  has_main_web_app: false,
  has_topics_enabled: false,
  allows_users_to_create_topics: false,
  can_manage_bots: false,
  supports_join_request_queries: false,
};

/** A bot wired to fakes (now is Tue 13 Oct, 09:12 UTC), recording what it would send to Telegram. */
async function setup(script: readonly ScriptStep[] = [], locations: readonly Location[] = []) {
  const { deps, repo } = await setupDeps({ locations, trips: [usEastCoast] });
  const llm = scriptedLlm(script);
  const logs: LogEntry[] = [];
  const bot = createBot(
    "123:test-token",
    {
      ...deps,
      llm,
      conversations: memoryConversations(),
      allowedTelegramIds: new Set([you]),
      userIdFor: () => Promise.resolve(user),
      log: (entry) => logs.push(entry),
    },
    botInfo,
  );
  const calls: { method: string; payload: Record<string, unknown> }[] = [];
  bot.api.config.use((_previous, method, payload) => {
    calls.push({ method, payload });
    return Promise.resolve({ ok: true, result: true } as never);
  });
  const texts = () =>
    calls.filter((call) => call.method === "sendMessage").map((call) => call.payload.text);
  return { bot, calls, texts, llm, repo, logs };
}

/** A Telegram update as the Bot API would deliver it, from `from` in their private chat by default. */
function update(
  from: number,
  content: Partial<Message>,
  options: { edited?: boolean; chat?: "private" | "group" } = {},
): Update {
  const chat: Chat =
    options.chat === "group"
      ? { id: from, type: "group", title: "Group" }
      : { id: from, type: "private", first_name: "Tester" };
  const message = {
    message_id: 1,
    date: 0,
    chat,
    from: { id: from, is_bot: false, first_name: "Tester" },
    ...content,
  } as NonNullable<Update["message"]>;
  return options.edited === true
    ? { update_id: 1, edited_message: { ...message, edit_date: 1 } }
    : { update_id: 1, message };
}

const text = (value: string) => ({ text: value });
const at = (latitude: number, longitude: number) => ({ location: { latitude, longitude } });

describe("the Telegram bot", () => {
  test("a text message is answered by the agent, with the location button underneath", async () => {
    const { bot, calls } = await setup([{ text: "I don't know where you are yet." }]);
    await bot.handleUpdate(update(you, text("What time is it?")));
    expect(calls).toEqual([
      { method: "sendChatAction", payload: { chat_id: you, action: "typing" } },
      {
        method: "sendMessage",
        payload: {
          chat_id: you,
          text: "I don't know where you are yet.",
          reply_markup: {
            keyboard: [[{ text: "Share my location", request_location: true }]],
            is_persistent: true,
            resize_keyboard: true,
          },
        },
      },
    ]);
  });

  test("a shared location sets your timezone directly, without the model", async () => {
    const { bot, texts, llm, repo } = await setup();
    await bot.handleUpdate(update(you, at(41.15, -8.61)));

    expect(texts()).toEqual(["Location saved: Lisbon time, 10:12 now."]);
    expect(await repo.getLocations(user)).toMatchObject([
      { zone: "Europe/Lisbon", placeName: "Lisbon", source: "shared_location" },
    ]);
    expect(llm.requests).toHaveLength(0);
  });

  test("live location updates are saved quietly", async () => {
    const { bot, calls, repo } = await setup([], [sharedLisbon]);
    await bot.handleUpdate(update(you, at(40.42, -3.7), { edited: true }));
    expect(calls).toEqual([]);
    expect(await repo.getLocations(user)).toMatchObject([{ zone: "Europe/Madrid" }]);
  });

  test("at sea, the place is named by its offset from UTC", async () => {
    const { bot, texts } = await setup();
    await bot.handleUpdate(update(you, at(30, -40)));
    expect(texts()).toEqual(["Location saved: UTC-03:00 time, 06:12 now."]);
  });

  test("/start greets you and shows the location button", async () => {
    const { bot, calls } = await setup();
    await bot.handleUpdate(
      update(you, { text: "/start", entities: [{ type: "bot_command", offset: 0, length: 6 }] }),
    );
    expect(calls).toMatchObject([
      { method: "sendMessage", payload: { reply_markup: { is_persistent: true } } },
    ]);
  });

  test("someone not on the allowlist gets one refusal with their id, then silence", async () => {
    const { bot, texts, llm } = await setup();
    await bot.handleUpdate(update(stranger, text("Hi")));
    await bot.handleUpdate(update(stranger, text("Hello?")));
    expect(texts()).toEqual([`Sorry, this bot is private. Your Telegram id is ${stranger}.`]);
    expect(llm.requests).toHaveLength(0);
  });

  test("group chats are ignored, even with you in them", async () => {
    const { bot, calls } = await setup();
    await bot.handleUpdate(update(you, text("What time is it?"), { chat: "group" }));
    expect(calls).toEqual([]);
  });

  test("other kinds of message get a short explanation", async () => {
    const { bot, texts } = await setup();
    await bot.handleUpdate(
      update(you, { photo: [{ file_id: "f", file_unique_id: "u", width: 1, height: 1 }] }),
    );
    expect(texts()).toEqual(["I can read text messages and shared locations."]);
  });

  test("if something fails, you get an apology, the error is logged, and the bot carries on", async () => {
    const { bot, texts, logs } = await setup([]);
    await bot.handleUpdate(update(you, text("What time is it?")));
    expect(texts()).toEqual(["Sorry, something went wrong. Please try again."]);
    expect(logs).toEqual([
      { event: "error", userId: user, error: "The script has no reply for model call 1" },
    ]);
  });
});

describe("logs", () => {
  test("one line per reply: ids, outcome, tokens and time taken, never the text", async () => {
    const { bot, logs } = await setup([{ text: "I don't know where you are yet." }]);
    await bot.handleUpdate(update(you, text("What time is it?")));
    expect(logs).toEqual([
      {
        event: "reply",
        userId: user,
        outcome: "answered",
        inputTokens: 100,
        outputTokens: 10,
        ms: 0,
      },
    ]);
  });

  test("shared locations are logged without coordinates or place", async () => {
    const { bot, logs } = await setup();
    await bot.handleUpdate(update(you, at(41.15, -8.61)));
    await bot.handleUpdate(update(you, at(40.42, -3.7), { edited: true }));
    expect(logs).toEqual([
      { event: "location", userId: user, live: false },
      { event: "location", userId: user, live: true },
    ]);
  });
});
