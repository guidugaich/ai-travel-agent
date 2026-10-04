/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "packages-not-to-apps",
      severity: "error",
      comment: "Packages are libraries; only apps (entry points) may depend on them.",
      from: { path: "^packages/" },
      to: { path: "^apps/" },
    },
    {
      name: "apps-not-to-other-apps",
      severity: "error",
      comment: "Apps share code through packages, never by importing each other.",
      from: { path: "^apps/([^/]+)/" },
      to: { path: "^apps/", pathNot: "^apps/$1/" },
    },
    {
      name: "contracts-is-a-leaf",
      severity: "error",
      comment: "contracts holds shared schemas and may not depend on any other package.",
      from: { path: "^packages/contracts/" },
      to: { path: "^packages/", pathNot: "^packages/contracts/" },
    },
    {
      name: "core-only-to-contracts",
      severity: "error",
      comment: "core may depend on contracts only; the agent depends on core, not the reverse.",
      from: { path: "^packages/core/" },
      to: { path: "^packages/", pathNot: "^packages/(core|contracts)/" },
    },
    {
      name: "core-no-channel-http-llm-or-db-libraries",
      severity: "error",
      comment:
        "core and contracts stay channel-, transport-, vendor- and storage-agnostic. " +
        "Use a port in core and an adapter outside it.",
      from: { path: "^packages/(core|contracts)/" },
      to: {
        path: "(^|node_modules/)(grammy|telegraf|node-telegram-bot-api|express|fastify|hono|@anthropic-ai|openai|ai|@google/genai|ollama|pg|postgres)(/|$)",
      },
    },
    {
      name: "core-no-node-builtins",
      severity: "error",
      comment: "core and contracts must run in browsers and React Native, so no Node built-ins.",
      from: { path: "^packages/(core|contracts)/" },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "no-circular",
      severity: "error",
      comment: "Circular dependencies make layering meaningless.",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-non-package-json",
      severity: "error",
      comment: "Every imported package must be declared in the importing workspace's package.json.",
      from: {},
      to: { dependencyTypes: ["npm-no-pkg", "npm-unknown"] },
    },
    {
      name: "not-to-unresolvable",
      severity: "error",
      comment: "This import cannot be resolved on disk.",
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(^|/)(dist|coverage)/" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.base.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
    },
  },
};
