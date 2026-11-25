import { Pool } from "pg";
import { migrate } from "./migrate.ts";
import { pgSql } from "./pg-sql.ts";
import type { Sql } from "./sql.ts";

export interface Database {
  readonly db: Sql;
  /** Closes every connection, so the program can exit. */
  readonly close: () => Promise<void>;
  /** The migrations this opening applied, oldest first; empty when the tables were up to date. */
  readonly migrated: readonly string[];
}

/** Connects to the Postgres server at `url` and brings its tables up to date. */
export async function openDatabase(url: string): Promise<Database> {
  const pool = new Pool({ connectionString: url });
  const db = pgSql(pool);
  let migrated: string[];
  try {
    migrated = await migrate(db);
  } catch (error) {
    await pool.end();
    if (error instanceof Error && "code" in error && error.code === "ECONNREFUSED") {
      throw new Error(
        `Can't reach the database at ${new URL(url).host}. Start it with: docker compose up -d`,
        { cause: error },
      );
    }
    throw error;
  }
  return { db, close: () => pool.end(), migrated };
}
