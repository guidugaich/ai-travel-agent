import { PGlite } from "@electric-sql/pglite";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "./migrate.ts";

const LOCAL_DATA_DIR = fileURLToPath(new URL("../../../../.data/pglite", import.meta.url));

export interface Database {
  readonly db: PGlite;
  /** Closes the database and lets the next program open it. */
  readonly close: () => Promise<void>;
}

/** Opens the database and brings its tables up to date. By default, the dev database in .data/. */
export async function openDatabase(dataDir = LOCAL_DATA_DIR): Promise<Database> {
  const unlock = dataDir.startsWith("memory://") ? () => Promise.resolve() : await lock(dataDir);
  try {
    const db = new PGlite(dataDir);
    await migrate(db);
    return {
      db,
      close: async () => {
        await db.close();
        await unlock();
      },
    };
  } catch (error) {
    await unlock();
    throw error;
  }
}

// PGlite lets two programs open one folder and silently loses one's writes, so only one may.
async function lock(dataDir: string): Promise<() => Promise<void>> {
  const lockPath = `${resolve(dataDir)}.lock`;
  await mkdir(dirname(lockPath), { recursive: true });
  try {
    await writeFile(lockPath, String(process.pid), { flag: "wx" });
  } catch (error) {
    if (!hasCode(error, "EEXIST")) throw error;
    const holder = Number(await readFile(lockPath, "utf8"));
    if (isRunning(holder)) {
      throw new Error(
        `The database at ${dataDir} is in use by another program (process ${holder}). Stop that program, such as the bot, then try again.`,
        { cause: error },
      );
    }
    await rm(lockPath);
    return lock(dataDir);
  }
  return () => rm(lockPath, { force: true });
}

function isRunning(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0); // signal 0 sends nothing; it only checks that the process exists
    return true;
  } catch (error) {
    return hasCode(error, "EPERM");
  }
}

function hasCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}
