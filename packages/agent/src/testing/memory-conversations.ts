import type { UserId } from "@ai-travel-agent/core";
import { HISTORY_LIMIT, type ChatMessage, type ConversationStore } from "../conversation.ts";

/** Conversation history in a Map, for tests. */
export function memoryConversations(): ConversationStore {
  const byUser = new Map<UserId, readonly ChatMessage[]>();
  return {
    recent: (userId) => Promise.resolve(byUser.get(userId) ?? []),
    append: (userId, messages) => {
      byUser.set(userId, [...(byUser.get(userId) ?? []), ...messages].slice(-HISTORY_LIMIT));
      return Promise.resolve();
    },
  };
}
