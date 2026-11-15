import { PGlite } from "@electric-sql/pglite";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, onTestFinished, test } from "vitest";
import { migrate } from "./migrate.ts";

/** An empty in-memory database, closed when the test ends, pass or fail. */
function emptyDb(): PGlite {
  const db = new PGlite();
  onTestFinished(() => db.close());
  return db;
}

async function tableNames(db: PGlite): Promise<string[]> {
  const { rows } = await db.query<{ table_name: string }>(
    "select table_name from information_schema.tables where table_schema = 'public'",
  );
  return rows.map((row) => row.table_name).sort();
}

describe("migrate", () => {
  test("a second run applies nothing", async () => {
    const db = emptyDb();
    await migrate(db);
    expect(await migrate(db)).toEqual([]);
  });

  test("a failing migration is rolled back, and later ones don't run", async () => {
    const dir = await mkdtemp(join(tmpdir(), "migrations-"));
    onTestFinished(() => rm(dir, { recursive: true }));
    await writeFile(join(dir, "001-ok.sql"), "create table a (id int);");
    await writeFile(join(dir, "002-bad.sql"), "create table b (id int); select * from missing;");
    await writeFile(join(dir, "003-later.sql"), "create table c (id int);");
    const db = emptyDb();

    await expect(migrate(db, dir)).rejects.toThrow("Migration 002-bad.sql failed");
    expect(await tableNames(db)).toEqual(["a", "migrations"]);
  });
});
