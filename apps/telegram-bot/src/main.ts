import { createBot, type LogEntry } from "./bot.ts";
import { loadConfig } from "./config.ts";
import { openDatabase } from "./db/database.ts";
import { postgresConversations } from "./db/postgres-conversations.ts";
import { postgresRepository, telegramUserId } from "./db/postgres-repository.ts";
import { standInLlm } from "./stand-in-llm.ts";
import { systemClock } from "./system-clock.ts";

/** One JSON line per event, timestamped, to standard output. */
function log(entry: LogEntry | { readonly event: "unhandled"; readonly error: string }): void {
  console.log(JSON.stringify({ at: systemClock.now().toString(), ...entry }));
}

async function main(): Promise<number> {
  const config = loadConfig(process.env);
  if (!config.ok) {
    console.error(config.error);
    return 1;
  }
  const { token, allowedTelegramIds } = config.value;

  const { db, close } = await openDatabase();
  const bot = createBot(token, {
    clock: systemClock,
    repo: postgresRepository(db),
    conversations: postgresConversations(db),
    llm: standInLlm,
    allowedTelegramIds,
    userIdFor: (telegramId) => telegramUserId(db, telegramId),
    log,
  });
  bot.catch((error) => {
    log({ event: "unhandled", error: error.message });
  });

  const stop = () => void bot.stop();
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    await bot.start({
      onStart: (me) => {
        const nobody = allowedTelegramIds.size === 0;
        console.log(
          `@${me.username} is running. Press Ctrl+C to stop.` +
            (nobody ? " Nobody is allowed yet: message the bot to learn your Telegram id." : ""),
        );
      },
    });
  } finally {
    await close();
  }
  return 0;
}

process.exitCode = await main();
