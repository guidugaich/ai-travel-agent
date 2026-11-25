import type { Sql } from "./db/sql.ts";
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

// Strict objects: a misspelt optional field would otherwise be dropped without a word.
const seedFile = z.strictObject({
  user: z.strictObject({
    telegramId: z.int().positive(),
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
          flight: z
            .strictObject({ from: z.string(), to: z.string(), international: z.boolean() })
            .exactOptional(),
        }),
      ),
    }),
  ),
});

/** Replaces the Telegram user's trips with the file's, or changes nothing. */
export async function seed(
  db: Sql,
  file: unknown,
): Promise<Result<{ readonly trips: number; readonly events: number }, readonly string[]>> {
  const parsed = seedFile.safeParse(file);
  if (!parsed.success) return { ok: false, error: [z.prettifyError(parsed.error)] };

  const { user, trips } = parsed.data;
  const userId = await telegramUserId(db, user.telegramId);
  const imported = await importTrips(userId, trips, { repo: postgresRepository(db) });
  return imported.ok ? imported : { ok: false, error: imported.error.map(describeProblem) };
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
  const url = process.env.DATABASE_URL;
  if (url === undefined || url === "") {
    console.error("DATABASE_URL isn't set. Copy it from .env.example into .env.");
    return 1;
  }
  let file: unknown;
  try {
    file = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    const reason =
      error instanceof SyntaxError ? `isn't valid JSON: ${error.message}` : "not found";
    console.error(`${path} ${reason}. To start, copy seed.example.json to seed.json.`);
    return 1;
  }

  const { db, close, migrated } = await openDatabase(url);
  console.log(
    migrated.length > 0
      ? `Applied migrations: ${migrated.join(", ")}`
      : "No migrations to apply: the tables are up to date.",
  );
  try {
    const result = await seed(db, file);
    if (!result.ok) {
      console.error(`Nothing was imported:\n${result.error.join("\n")}`);
      return 1;
    }
    console.log(`Imported. Trips: ${result.value.trips}, events: ${result.value.events}.`);
    return 0;
  } finally {
    await close();
  }
}

if (import.meta.main) process.exitCode = await main(process.argv[2] ?? "seed.json");
