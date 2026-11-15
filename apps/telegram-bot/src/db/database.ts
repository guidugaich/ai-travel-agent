import { PGlite } from "@electric-sql/pglite";
import { fileURLToPath } from "node:url";
import { migrate } from "./migrate.ts";

const LOCAL_DATA_DIR = fileURLToPath(new URL("../../../../.data/", import.meta.url));

/** Opens the database and brings its tables up to date. By default, the dev database in .data/. */
export async function openDatabase(dataDir = LOCAL_DATA_DIR): Promise<PGlite> {
  const db = new PGlite(dataDir);
  await migrate(db);
  return db;
}
