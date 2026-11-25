import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { Client, Pool } from "pg";
import { pgSql } from "../db/pg-sql.ts";
import type { Sql } from "../db/sql.ts";

/** An empty database for one test file: a new one on the Postgres server at TEST_DATABASE_URL (as in CI), or else PGlite in memory. */
export async function openTestDatabase(): Promise<{
  readonly db: Sql;
  readonly close: () => Promise<void>;
}> {
  const server = process.env.TEST_DATABASE_URL;
  if (server === undefined || server === "") {
    const db = new PGlite();
    return { db, close: () => db.close() };
  }

  const name = `test_${randomUUID().replaceAll("-", "")}`;
  await runOn(server, `create database ${name}`);
  const url = new URL(server);
  url.pathname = `/${name}`;
  const pool = new Pool({ connectionString: url.toString() });
  return {
    db: pgSql(pool),
    close: async () => {
      await pool.end();
      await runOn(server, `drop database ${name}`);
    },
  };
}

async function runOn(server: string, statement: string): Promise<void> {
  const client = new Client({ connectionString: server });
  await client.connect();
  try {
    await client.query(statement);
  } finally {
    await client.end();
  }
}
