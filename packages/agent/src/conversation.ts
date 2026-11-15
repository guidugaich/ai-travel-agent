import type { UserId } from "@ai-travel-agent/core";

export const HISTORY_LIMIT = 20;

/** Only what the user and the bot said. Tool calls and results aren't kept: their values go stale. */
export interface ChatMessage {
  readonly role: "user" | "assistant";
  readonly content: string;
}

/** Recent messages per user. Implemented by the app on Postgres, and by a fake in tests. */
export interface ConversationStore {
  /** The last HISTORY_LIMIT messages, oldest first. */
  recent(userId: UserId): Promise<readonly ChatMessage[]>;
  /** Adds messages, then deletes all but the last HISTORY_LIMIT. */
  append(userId: UserId, messages: readonly ChatMessage[]): Promise<void>;
}
