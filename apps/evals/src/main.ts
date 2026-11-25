import { openAiCompatible } from "@ai-travel-agent/openai-compatible";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCandidates, type Candidate } from "./candidates.ts";
import type { Expectations } from "./check.ts";
import { runScenario, type RunResult } from "./run-scenario.ts";
import { SCENARIOS } from "./scenarios.ts";
import { scorecard } from "./scorecard.ts";

const CANDIDATES = fileURLToPath(new URL("../candidates.json", import.meta.url));
const RESULTS = fileURLToPath(new URL("../results/", import.meta.url));
// Models answer differently each time, so each scenario runs several times; 3 was too few to compare prompts.
const RUNS = 5;

async function main(only: string | undefined): Promise<number> {
  let json: unknown;
  try {
    json = JSON.parse(await readFile(CANDIDATES, "utf8"));
  } catch {
    console.error("No models to compare yet: list them in apps/evals/candidates.json.");
    return 1;
  }
  const candidates = parseCandidates(json);
  if (!candidates.ok) {
    console.error(candidates.error);
    return 1;
  }

  const results: { candidate: Candidate; runs: RunResult[] }[] = [];
  await mkdir(RESULTS, { recursive: true });
  for (const candidate of candidates.value) {
    if (only !== undefined && candidate.name !== only) continue;
    const apiKey =
      candidate.apiKeyEnv === undefined ? "" : (process.env[candidate.apiKeyEnv] ?? "");
    if (candidate.apiKeyEnv !== undefined && apiKey === "") {
      console.error(`Skipping ${candidate.name}: ${candidate.apiKeyEnv} isn't set in .env.`);
      continue;
    }
    const llm = openAiCompatible({ baseUrl: candidate.baseUrl, model: candidate.model, apiKey });

    const runs: RunResult[] = [];
    for (const scenario of SCENARIOS) {
      console.log(
        `\n${scenario.name}\n  asks:    ${scenario.message}\n  expects: ${expected(scenario.expect)}`,
      );
      for (let n = 1; n <= RUNS; n++) {
        const run = await runScenario(scenario, llm);
        const why = run.passed ? "" : `: ${run.failures.join("; ")}`;
        console.log(
          `${candidate.name} ${run.passed ? "✔" : "✘"} ${scenario.name} (${n}/${RUNS})${why}`,
        );
        if (run.reply !== "")
          console.log(`  reply:   ${run.reply.replace(/\n/g, "\n           ")}`);
        runs.push(run);
      }
    }
    results.push({ candidate, runs });
    await writeFile(join(RESULTS, `${candidate.name}.json`), JSON.stringify(runs, null, 2));
  }

  if (results.length === 0) {
    console.error(only === undefined ? "No model was run." : `No candidate named ${only}.`);
    return 1;
  }
  const card = scorecard(results);
  await writeFile(join(RESULTS, "scorecard.md"), card);
  console.log(`\n${card}\nEvery conversation is in apps/evals/results/.`);
  return 0;
}

function expected(expect: Expectations): string {
  return [
    ...(expect.tools ?? []).map((tool) => `calls ${tool}`),
    ...(expect.contains ?? []).map((value) => `says "${value}"`),
    ...(expect.excludes ?? []).map((pattern) => `never ${String(pattern)}`),
  ].join(", ");
}

process.exitCode = await main(process.argv[2]);
