/** Inside a transaction: run a query with parameters, or several statements without. */
export interface SqlTransaction {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- the caller names the row shape, as with PGlite and pg
  query<Row>(text: string, params?: readonly unknown[]): Promise<{ readonly rows: Row[] }>;
  exec(text: string): Promise<unknown>;
}

/** All the storage code needs from a database. PGlite (in tests) fits as it is; a Postgres server fits through `pgSql`. */
export interface Sql extends SqlTransaction {
  transaction<T>(run: (tx: SqlTransaction) => Promise<T>): Promise<T>;
}
