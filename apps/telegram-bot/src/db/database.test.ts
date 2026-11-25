import { describe, expect, test } from "vitest";
import { openDatabase } from "./database.ts";

describe("openDatabase", () => {
  test("when nothing answers at the address, the error says how to start the database", async () => {
    await expect(openDatabase("postgresql://postgres@127.0.0.1:1/dev")).rejects.toThrow(
      "Can't reach the database at 127.0.0.1:1. Start it with: docker compose up -d",
    );
  });
});
