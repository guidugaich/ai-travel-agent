import type { PGlite } from "@electric-sql/pglite";
import { HISTORY_LIMIT, type ConversationStore } from "@ai-travel-agent/agent";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { openDatabase } from "./database.ts";
import { postgresConversations } from "./postgres-conversations.ts";
import { postgresRepository } from "./postgres-repository.ts";

const you = "00000000-0000-4000-8000-000000000001";
const someoneElse = "00000000-0000-4000-8000-000000000002";

let db: PGlite;
let conversations: ConversationStore;

beforeAll(async () => {
  db = await openDatabase("memory://");
  conversations = postgresConversations(db);
});

beforeEach(async () => {
  await db.exec("truncate users cascade");
  const repo = postgresRepository(db);
  await repo.saveUser({ id: you, transitMinutes: {} });
  await repo.saveUser({ id: someoneElse, transitMinutes: {} });
});

afterAll(async () => {
  await db.close();
});

async function messageRows(): Promise<number> {
  const { rows } = await db.query<{ count: number }>("select count(*)::int as count from messages");
  return rows[0]?.count ?? -1;
}

describe("conversation history on Postgres", () => {
  test("messages come back oldest first", async () => {
    await conversations.append(you, [
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello." },
    ]);
    await conversations.append(you, [{ role: "user", content: "What time is it?" }]);
    expect(await conversations.recent(you)).toEqual([
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello." },
      { role: "user", content: "What time is it?" },
    ]);
  });

  test(`only the last ${HISTORY_LIMIT} are kept; older ones are deleted, not hidden`, async () => {
    for (let n = 1; n <= HISTORY_LIMIT + 5; n++) {
      await conversations.append(you, [{ role: "user", content: `message ${n}` }]);
    }
    const recent = await conversations.recent(you);
    expect(recent).toHaveLength(HISTORY_LIMIT);
    expect(recent[0]?.content).toBe("message 6");
    expect(recent.at(-1)?.content).toBe(`message ${HISTORY_LIMIT + 5}`);
    expect(await messageRows()).toBe(HISTORY_LIMIT);
  });

  test("each user has their own history", async () => {
    await conversations.append(someoneElse, [{ role: "user", content: "Hi" }]);
    expect(await conversations.recent(you)).toEqual([]);
  });

  test("deleting a user deletes their messages", async () => {
    await conversations.append(you, [{ role: "user", content: "Hi" }]);
    await db.query("delete from users where id = $1", [you]);
    expect(await messageRows()).toBe(0);
  });
});
