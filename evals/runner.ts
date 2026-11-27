import { streamText, isStepCount, tool, type LanguageModel, type ToolSet, type LanguageModelUsage } from "ai";
import { Bash } from "just-bash";
import { z } from "zod";
import { skillReader, type Skill } from "./skills.ts";
import type { EvalCase, Seed } from "./suite.ts";

export async function createSandbox(seed: Seed): Promise<Bash> {
  const bash = new Bash({
    files: seed.files,
    cwd: "/workspace",
    env: {},
    executionLimitProfile: "hardened",
    executionLimits: {
      maxExecutionTimeMs: 5_000,
      maxOutputSize: 32_768,
      maxFileSystemBytes: 32 * 1024 * 1024,
    },
  });
  for (const directory of seed.directories) await bash.fs.mkdir(directory, { recursive: true });
  return bash;
}

type CheckResult = { name: string; passed: boolean; stdout?: string; stderr?: string; exitCode?: number };
type TraceStep = { text: string; toolCalls: unknown[]; toolResults: unknown[]; finishReason: string; usage: LanguageModelUsage };
export type EvalResult = {
  id: string;
  iteration: number;
  status: "passed" | "failed" | "error" | "incomplete";
  score: number;
  elapsedMs: number;
  text: string;
  finishReason?: string;
  error?: string;
  usage?: LanguageModelUsage;
  checks: CheckResult[];
  steps: TraceStep[];
};

export async function runCase({ entry, seed, skills, model, iteration = 1 }: {
  entry: EvalCase;
  seed: Seed;
  skills: ReadonlyMap<string, Skill>;
  model: LanguageModel;
  iteration?: number;
}): Promise<EvalResult> {
  const started = performance.now();
  const steps: TraceStep[] = [];
  const base = { id: entry.id, iteration, steps };
  let text = "";
  try {
    const bash = await createSandbox(seed);
    const tools: ToolSet = {
      bash: tool({
        description: "Execute bash in an in-memory /workspace. Files persist between calls; shell variables and cwd reset. No host commands, network, Python, or Node.js. Use standard text tools such as cat, sed, jq, and grep.",
        inputSchema: z.object({ command: z.string().min(1).max(16_384) }).strict(),
        execute: async ({ command }, { abortSignal }) => {
          const result = await bash.exec(command, { signal: abortSignal });
          return { stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode };
        },
      }),
    };
    if (skills.size > 0) tools.read_skill = skillReader(skills);
    const catalog = [...skills.values()].map((skill) => `- ${skill.name}: ${skill.description}`).join("\n");
    const result = streamText({
      model,
      instructions: [
        "Complete the user's task in /workspace. Use bash to inspect and modify the supplied files. Only report work you actually performed.",
        skills.size > 0 ? `Available icare skills follow. Read relevant skills with read_skill before applying them.\n${catalog}` : "",
      ].filter(Boolean).join("\n\n"),
      prompt: entry.prompt,
      tools,
      toolCallConcurrency: 1,
      stopWhen: isStepCount(entry.maxSteps),
      timeout: entry.timeoutMs,
      maxRetries: 0,
      telemetry: { isEnabled: false },
      onStepFinish: (step) => {
        steps.push({ text: step.text, toolCalls: step.toolCalls, toolResults: step.toolResults, finishReason: step.finishReason, usage: step.usage });
      },
    });
    for await (const part of result.stream) {
      if (part.type === "text-delta") text += part.text;
      if (part.type === "error") throw part.error;
    }
    text = await result.text;
    const finishReason = await result.finishReason;
    const usage = await result.usage;
    const checks: CheckResult[] = [];
    for (const check of entry.checks) {
      if (check.type === "response") {
        checks.push({ name: check.name, passed: text.includes(check.includes) });
      } else {
        const graded = await bash.exec(check.command);
        checks.push({ name: check.name, passed: graded.exitCode === 0, stdout: graded.stdout, stderr: graded.stderr, exitCode: graded.exitCode });
      }
    }
    const complete = finishReason === "stop";
    const score = checks.filter((check) => check.passed).length / checks.length;
    return {
      ...base,
      status: !complete ? "incomplete" : score === 1 ? "passed" : "failed",
      score,
      text,
      finishReason,
      usage,
      checks,
      elapsedMs: Math.round(performance.now() - started),
    };
  } catch (error) {
    return {
      ...base,
      status: "error",
      score: 0,
      text,
      checks: [],
      error: error instanceof Error ? error.message : String(error),
      elapsedMs: Math.round(performance.now() - started),
    };
  }
}
