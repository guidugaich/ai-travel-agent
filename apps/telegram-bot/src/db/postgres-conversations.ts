import type { Sql } from "./sql.ts";
import { HISTORY_LIMIT, type ChatMessage, type ConversationStore } from "@ai-travel-agent/agent";

/** The agent's ConversationStore port, on Postgres. Message ids increase, so they give the order. */
export function postgresConversations(db: Sql): ConversationStore {
  return {
    async recent(userId) {
      const { rows } = await db.query<ChatMessage>(
        `select role, content from (
           select id, role, content from messages where user_id = $1 order by id desc limit $2
         ) latest order by id`,
        [userId, HISTORY_LIMIT],
      );
      return rows;
    },

    async append(userId, messages) {
      await db.transaction(async (tx) => {
        for (const message of messages) {
          await tx.query("insert into messages (user_id, role, content) values ($1, $2, $3)", [
            userId,
            message.role,
            message.content,
          ]);
        }
        await tx.query(
          `delete from messages where user_id = $1 and id not in (
             select id from messages where user_id = $1 order by id desc limit $2
           )`,
          [userId, HISTORY_LIMIT],
        );
      });
    },
  };
}
