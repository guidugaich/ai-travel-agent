import type { PGlite } from "@electric-sql/pglite";
import {
  EVENT_KINDS,
  importTrips,
  type ImportProblem,
  type Result,
  type TimeError,
} from "@ai-travel-agent/core";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { openDatabase } from "./db/database.ts";
import { postgresRepository, telegramUserId } from "./db/postgres-repository.ts";

const wallTime = z.strictObject({ local: z.string(), zone: z.string() });
const minutes = z.int().nonnegative();

// Strict objects: a misspelt optional field would otherwise be dropped without a word.
const seedFile = z.strictObject({
  user: z.strictObject({
    telegramId: z.int().positive(),
    transitMinutes: z.strictObject({
      airport: minutes.exactOptional(),
      other: minutes.exactOptional(),
    }),
  }),
  trips: z.array(
    z.strictObject({
      title: z.string().min(1),
      startDate: z.iso.date(),
      endDate: z.iso.date().exactOptional(),
      events: z.array(
        z.strictObject({
          kind: z.enum(EVENT_KINDS),
          title: z.string().min(1),
          start: wallTime,
          end: wallTime.exactOptional(),
          transitMinutes: minutes.exactOptional(),
          flight: z
            .strictObject({ from: z.string(), to: z.string(), international: z.boolean() })
            .exactOptional(),
        }),
      ),
    }),
  ),
});

/** Replaces the Telegram user's trips and settings with the file's, or changes nothing. */
export async function seed(
  db: PGlite,
  file: unknown,
): Promise<Result<{ readonly trips: number; readonly events: number }, readonly string[]>> {
  const parsed = seedFile.safeParse(file);
  if (!parsed.success) return { ok: false, error: [z.prettifyError(parsed.error)] };

  const { user, trips } = parsed.data;
  const repo = postgresRepository(db);
  const userId = await telegramUserId(db, user.telegramId);
  const imported = await importTrips(userId, trips, { repo });
  if (!imported.ok) return { ok: false, error: imported.error.map(describeProblem) };

  await repo.saveUser({ id: userId, transitMinutes: user.transitMinutes });
  return imported;
}

function describeProblem(problem: ImportProblem): string {
  const event = `event '${problem.event}'`;
  switch (problem.kind) {
    case "missing":
      return problem.field === "end"
        ? `${event}: needs an "end" time`
        : `${event}: a flight needs "flight": { "from", "to", "international" }`;
    case "ends_before_start":
      return `${event}: ends before it starts`;
    case "bad_time":
      return `${event}, ${problem.field}: ${describeTimeError(problem.error)}`;
  }
}

function describeTimeError(error: TimeError): string {
  switch (error.kind) {
    case "invalid_zone":
      return `unknown timezone '${error.zone}'`;
    case "invalid_local_time":
      return `'${error.local}' isn't a date and time like 2026-10-14T17:05`;
    case "nonexistent":
      return `${error.local} doesn't exist in ${error.zone} (clocks jump forward)`;
    case "ambiguous":
      return `${error.local} happens twice in ${error.zone} (clocks fall back), so pick another time`;
  }
}

async function main(path: string): Promise<number> {
  let file: unknown;
  try {
    file = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    const reason =
      error instanceof SyntaxError ? `isn't valid JSON: ${error.message}` : "not found";
    console.error(`${path} ${reason}. To start, copy seed.example.json to seed.json.`);
    return 1;
  }

  const db = await openDatabase();
  try {
    const result = await seed(db, file);
    if (!result.ok) {
      console.error(`Nothing was imported:\n${result.error.join("\n")}`);
      return 1;
    }
    console.log(`Imported. Trips: ${result.value.trips}, events: ${result.value.events}.`);
    return 0;
  } finally {
    await db.close();
  }
}

if (import.meta.main) process.exitCode = await main(process.argv[2] ?? "seed.json");
