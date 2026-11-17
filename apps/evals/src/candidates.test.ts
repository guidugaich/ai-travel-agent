import { describe, expect, test } from "vitest";
import { parseCandidates } from "./candidates.ts";

describe("parseCandidates", () => {
  test("reads the models to compare", () => {
    expect(
      parseCandidates([
        { name: "local", baseUrl: "http://localhost:11434/v1", model: "some-model" },
        {
          name: "hosted",
          baseUrl: "https://llm.example/v1",
          model: "other-model",
          apiKeyEnv: "EXAMPLE_API_KEY",
          price: { inputPerMillion: 0.4, outputPerMillion: 2 },
          dataTerms: "EU, no training",
        },
      ]),
    ).toMatchObject({ ok: true, value: [{ name: "local" }, { name: "hosted" }] });
  });

  test("an entry without a model is refused, saying where", () => {
    const result = parseCandidates([{ name: "local", baseUrl: "http://localhost:11434/v1" }]);
    expect(result.ok ? "" : result.error).toContain("at [0].model");
  });

  test("a name that can't be a file name is refused, since it names the results file", () => {
    const result = parseCandidates([
      { name: "qwen/large", baseUrl: "http://localhost:11434/v1", model: "m" },
    ]);
    expect(result.ok ? "" : result.error).toContain("at [0].name");
  });

  test("an API key pasted into the file is refused: only the name of a .env variable goes there", () => {
    const result = parseCandidates([
      { name: "hosted", baseUrl: "https://llm.example/v1", model: "m", apiKeyEnv: "sk-abc123" },
    ]);
    expect(result.ok ? "" : result.error).toContain("apiKeyEnv");
  });
});
