import type { Sql } from "./sql.ts";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const MIGRATIONS_DIR = fileURLToPath(new URL("./migrations/", import.meta.url));

/** Runs the .sql files not yet applied, in name order, each in its own transaction. Returns their names. */
export async function migrate(db: Sql, dir = MIGRATIONS_DIR): Promise<string[]> {
  await db.exec("create table if not exists migrations (name text primary key)");
  const { rows } = await db.query<{ name: string }>("select name from migrations");
  const applied = new Set(rows.map((row) => row.name));

  const pending = (await readdir(dir))
    .filter((file) => file.endsWith(".sql") && !applied.has(file))
    .sort();
  for (const file of pending) {
    const sql = await readFile(join(dir, file), "utf8");
    try {
      await db.transaction(async (tx) => {
        await tx.exec(sql);
        await tx.query("insert into migrations (name) values ($1)", [file]);
      });
    } catch (error) {
      throw new Error(`Migration ${file} failed`, { cause: error });
    }
  }
  return pending;
}
