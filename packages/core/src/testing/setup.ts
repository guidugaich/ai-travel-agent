import type { Location, NewTrip, User } from "../domain.js";
import type { Deps } from "../ports.js";
import { fixedClock } from "./fixed-clock.js";
import { MemoryRepository } from "./memory-repository.js";

export const testUser = "user-1";

/** Services' dependencies with a fixed "now" (the spec's default: Tue 13 Oct 2026, 09:12 UTC). */
export async function setupDeps(options: {
  now?: string;
  user?: User;
  locations?: readonly Location[];
  trips?: readonly NewTrip[];
}): Promise<{ deps: Deps; repo: MemoryRepository }> {
  const repo = new MemoryRepository();
  if (options.user) await repo.saveUser(options.user);
  for (const location of options.locations ?? []) await repo.setLocation(testUser, location);
  await repo.replaceTrips(testUser, options.trips ?? []);
  return { deps: { clock: fixedClock(options.now ?? "2026-10-13T09:12:00Z"), repo }, repo };
}
