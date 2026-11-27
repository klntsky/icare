import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { auth, createCodex, createFileCodexCredentialStore } from "ai-sdk-codex-subscription-provider";
import { loadSuite, loadSeed } from "./suite.ts";
import { loadIcareSkills, selectSkills } from "./skills.ts";
import { runCase, type EvalResult } from "./runner.ts";

const authPath = fileURLToPath(new URL("../.auth/codex.json", import.meta.url));

const help = `Usage:
  pnpm eval:login
  pnpm eval run [options]

Options:
  --suite PATH    Suite JSON (default: evals/suites/example.json)
  --case ID       Run one case
  --model ID      Codex model (default: gpt-5.4-mini)
  --repeat N      Independent runs per case (default: 1)
  --baseline      Disable the icare skill reader and catalog
  --output PATH   Also save the JSON report (stdout always receives JSON)
  --help          Show this help

Login uses OpenAI device authorization and Codex subscription usage, not API billing.
Credentials: ${authPath}
`;

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      suite: { type: "string", default: "evals/suites/example.json" },
      case: { type: "string" },
      model: { type: "string", default: "gpt-5.4-mini" },
      repeat: { type: "string", default: "1" },
      baseline: { type: "boolean", default: false },
      output: { type: "string" },
      help: { type: "boolean", default: false },
    },
  });
  if (values.help) {
    process.stdout.write(help);
    return;
  }
  const command = positionals[0] ?? "run";
  if (positionals.length > 1 || !["run", "login"].includes(command)) throw new Error(help);
  const authStore = createFileCodexCredentialStore({ authPath });
  if (command === "login") {
    const device = await auth.createDeviceAuthorization();
    console.error(`Open ${device.verificationUri}\nEnter code: ${device.userCode}\nWaiting for OpenAI authorization…`);
    await authStore.set(await auth.pollDeviceAuthorization(device));
    console.error(`Authorized. Credentials saved to ${authPath}`);
    return;
  }
  const repeat = Number(values.repeat);
  if (!Number.isSafeInteger(repeat) || repeat < 1 || repeat > 100) throw new Error("--repeat must be an integer from 1 to 100");
  const { suitePath, cases } = await loadSuite(values.suite);
  const selected = cases.filter((entry) => !values.case || entry.id === values.case);
  if (selected.length === 0) throw new Error(`Unknown case: ${values.case}`);
  const catalog = await loadIcareSkills();
  const prepared = [];
  for (const entry of selected) {
    const skills = selectSkills(catalog, entry.skills);
    prepared.push({ entry, seed: await loadSeed(entry.seed), skills: values.baseline ? new Map() : skills });
  }
  if (!(await authStore.get())) throw new Error("OpenAI authorization required. Run pnpm eval:login first. API keys are not used.");
  const model = createCodex({ authStore })(values.model);
  const results: EvalResult[] = [];
  for (const input of prepared) {
    for (let iteration = 1; iteration <= repeat; iteration++) {
      console.error(`Running ${input.entry.id} (${iteration}/${repeat})`);
      const result = await runCase({ ...input, model, iteration });
      results.push(result);
      console.error(`${result.status}: ${result.id} score=${result.score}${result.error ? ` ${result.error}` : ""}`);
    }
  }
  const report = {
    version: 1,
    createdAt: new Date().toISOString(),
    suite: suitePath,
    model: values.model,
    baseline: values.baseline,
    inputs: prepared.map(({ entry, seed, skills }) => ({
      ...entry,
      files: seed.hashes,
      skills: [...skills.values()].map(({ name, sha256 }) => ({ name, sha256 })),
    })),
    summary: {
      runs: results.length,
      passed: results.filter((result) => result.status === "passed").length,
      meanScore: results.reduce((sum, result) => sum + result.score, 0) / results.length,
    },
    results,
  };
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (values.output) {
    await mkdir(dirname(values.output), { recursive: true });
    await writeFile(values.output, json, { mode: 0o600 });
  }
  process.stdout.write(json);
  if (results.some((result) => result.status !== "passed")) process.exitCode = 1;
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
