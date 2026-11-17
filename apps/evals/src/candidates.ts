import type { Result } from "@ai-travel-agent/core";
import { z } from "zod";

const candidateSchema = z.strictObject({
  /** Shown in the scorecard, and names the results file. */
  name: z.string().regex(/^[a-z0-9][a-z0-9.-]*$/, "Use lowercase letters, digits, dots and dashes"),
  baseUrl: z.url(),
  model: z.string().min(1),
  /** The name of the .env variable holding the API key, never the key itself. */
  apiKeyEnv: z
    .string()
    .regex(/^[A-Z][A-Z0-9_]*$/, "Expected the name of a .env variable, like MISTRAL_API_KEY")
    .exactOptional(),
  /** US dollars per million tokens, from the provider's price page. */
  price: z
    .strictObject({
      inputPerMillion: z.number().nonnegative(),
      outputPerMillion: z.number().nonnegative(),
    })
    .exactOptional(),
  /** A short summary of where data goes and how it's used, from the provider's terms. */
  dataTerms: z.string().exactOptional(),
});

export type Candidate = z.infer<typeof candidateSchema>;

/** The models to compare, from apps/evals/candidates.json. */
export function parseCandidates(json: unknown): Result<Candidate[], string> {
  const parsed = z.array(candidateSchema).min(1).safeParse(json);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, error: `apps/evals/candidates.json:\n${z.prettifyError(parsed.error)}` };
}
