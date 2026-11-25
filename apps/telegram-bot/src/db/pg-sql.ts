import type { Pool, PoolClient } from "pg";
import type { Sql, SqlTransaction } from "./sql.ts";

/** Sql on a Postgres server, through a pool of connections. A transaction keeps one connection to itself. */
export function pgSql(pool: Pool): Sql {
  return {
    ...calls(pool),
    async transaction(run) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const result = await run(calls(client));
        await client.query("commit");
        return result;
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

function calls(on: Pool | PoolClient): SqlTransaction {
  return {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- the caller names the row shape, as with PGlite and pg
    async query<Row>(text: string, params: readonly unknown[] = []) {
      const { rows } = await on.query(text, [...params]);
      return { rows: rows as Row[] };
    },
    // Without parameters, pg sends the text as is, so it may hold several statements (a migration).
    exec: (text) => on.query(text),
  };
}
