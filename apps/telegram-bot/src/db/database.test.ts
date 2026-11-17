import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, onTestFinished, test } from "vitest";
import { openDatabase } from "./database.ts";

/** A database folder path in a temp folder that's removed when the test ends. */
async function tempDataDir(): Promise<string> {
  const parent = await mkdtemp(join(tmpdir(), "database-"));
  onTestFinished(() => rm(parent, { recursive: true, force: true }));
  return join(parent, "pglite");
}

describe("openDatabase", () => {
  test("a second program can't open a database folder that's already open", async () => {
    const dir = await tempDataDir();
    const first = await openDatabase(dir);
    onTestFinished(() => first.close());

    await expect(openDatabase(dir)).rejects.toThrow(
      `in use by another program (process ${process.pid})`,
    );
  });

  test("closing lets the next program open it", async () => {
    const dir = await tempDataDir();
    await (await openDatabase(dir)).close();

    const second = await openDatabase(dir);
    expect((await second.db.query("select 1 as one")).rows).toEqual([{ one: 1 }]);
    await second.close();
  });

  test("a lock left by a program that crashed is taken over", async () => {
    const dir = await tempDataDir();
    const finished = spawnSync(process.execPath, ["-e", ""]).pid;
    await writeFile(`${dir}.lock`, String(finished));

    const database = await openDatabase(dir);
    await database.close();
  });
});
