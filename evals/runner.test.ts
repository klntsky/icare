import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, statfs, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import type { LanguageModelV4StreamPart as StreamPart } from "@ai-sdk/provider";
import { MockLanguageModelV4 } from "ai/test";
import { loadIcareSkills, selectSkills, skillReader } from "./skills.ts";
import { createSandbox, runCase } from "./runner.ts";
import { loadSeed, loadSuite, suiteSchema } from "./suite.ts";

async function temp(t: TestContext): Promise<string> {
  const root = process.env.EVAL_TEST_TMPDIR ?? "/dev/shm";
  assert.equal((await statfs(root)).type, 0x01021994, "Tests require a RAM-backed tmpfs directory");
  const path = await mkdtemp(join(root, "icare-evals-"));
  t.after(() => rm(path, { recursive: true, force: true }));
  return path;
}

function modelWith(turns: StreamPart[][]): MockLanguageModelV4 {
  let turn = 0;
  return new MockLanguageModelV4({
    doStream: async () => {
      const parts = turns[turn++];
      assert.ok(parts, "Unexpected model call");
      return {
        stream: new ReadableStream<StreamPart>({
          start(controller) {
            controller.enqueue({ type: "stream-start", warnings: [] });
            for (const part of parts) controller.enqueue(part);
            controller.enqueue({
              type: "finish",
              finishReason: { unified: parts.some((part) => part.type === "tool-call") ? "tool-calls" : "stop", raw: undefined },
              usage: {
                inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
                outputTokens: { total: 5, text: 5, reasoning: 0 },
              },
            });
            controller.close();
          },
        }),
      };
    },
  });
}

function call(name: string, input: unknown, id = name): StreamPart {
  return { type: "tool-call", toolCallId: id, toolName: name, input: JSON.stringify(input) };
}

function answer(text: string): StreamPart[] {
  return [
    { type: "text-start", id: "answer" },
    { type: "text-delta", id: "answer", delta: text },
    { type: "text-end", id: "answer" },
  ];
}

function entry(seed: string) {
  return suiteSchema.parse({ cases: [{
    id: "edit",
    seed,
    prompt: "Replace before with after in input.txt and report Done.",
    checks: [
      { type: "bash", name: "edited", command: "test \"$(cat input.txt)\" = after" },
      { type: "response", name: "answered", includes: "Done" },
    ],
  }] }).cases[0];
}

test("disk seeds are snapshots; runs preserve bytes and empty directories without writing through", async (t) => {
  const root = await temp(t);
  await mkdir(join(root, "empty"));
  await writeFile(join(root, "data.bin"), new Uint8Array([0, 128, 255]));
  const seed = await loadSeed(root);
  await writeFile(join(root, "data.bin"), "host changed after snapshot");
  const first = await createSandbox(seed);
  const second = await createSandbox(seed);
  assert.deepEqual([...await first.fs.readFileBuffer("/workspace/data.bin")], [0, 128, 255]);
  assert.equal((await first.exec("test -d empty")).exitCode, 0);
  await first.exec("printf modified > data.bin; touch new.txt");
  assert.deepEqual([...await second.fs.readFileBuffer("/workspace/data.bin")], [0, 128, 255]);
  assert.equal(await second.fs.exists("/workspace/new.txt"), false);
  assert.equal(await readFile(join(root, "data.bin"), "utf8"), "host changed after snapshot");
  assert.notEqual((await first.exec(`cat '${root}/data.bin'`)).exitCode, 0);
  assert.notEqual((await first.exec("curl https://example.com")).exitCode, 0);
});

test("seed loading rejects symlinks instead of following host files", async (t) => {
  const root = await temp(t);
  await mkdir(join(root, "seed"));
  await writeFile(join(root, "private"), "not a fixture");
  await symlink(join(root, "private"), join(root, "seed", "escape"));
  await assert.rejects(loadSeed(join(root, "seed")), /only regular files/);
  await symlink(join(root, "seed"), join(root, "alias"));
  await assert.rejects(loadSeed(join(root, "alias")), /not a symlink/);
});

test("suite paths resolve against the suite and duplicate cases are rejected", async (t) => {
  const root = await temp(t);
  const spec = entry("fixtures");
  await writeFile(join(root, "suite.json"), JSON.stringify({ cases: [spec] }));
  assert.equal((await loadSuite(join(root, "suite.json"))).cases[0].seed, join(root, "fixtures"));
  assert.throws(() => suiteSchema.parse({ cases: [spec, spec] }), /Duplicate case/);
});

test("skill reader only returns selected icare content, including its introduction", async () => {
  const catalog = await loadIcareSkills();
  const selected = selectSkills(catalog, ["understand-intent"]);
  const reader = skillReader(selected);
  assert.ok(reader.execute);
  const result = await reader.execute({ name: "understand-intent" }, { toolCallId: "read", messages: [], context: {} });
  assert.ok(result && "content" in result);
  assert.ok(result.content.indexOf("---") > 0, "README must precede SKILL frontmatter");
  for (const name of ["../README.md", "/etc/passwd", "https://example.com/skill", "test-intentionally"]) {
    await assert.rejects(async () => reader.execute!({ name }, { toolCallId: "read", messages: [], context: {} }), /Unknown icare skill/);
    if (name !== "test-intentionally") assert.throws(() => selectSkills(catalog, [name]), /Unknown icare skill/);
  }
});

test("AI SDK executes tools, reads icare skills, grades results, and isolates repeat runs", async (t) => {
  const root = await temp(t);
  await writeFile(join(root, "input.txt"), "before\n");
  const seed = await loadSeed(root);
  const skills = selectSkills(await loadIcareSkills(), ["test-intentionally"]);
  const model = modelWith([
    [call("read_skill", { name: "test-intentionally" })],
    [call("bash", { command: "sed -i 's/before/after/' input.txt" })],
    answer("Done"),
    answer("Done"),
  ]);
  const first = await runCase({ entry: entry(root), seed, skills, model });
  assert.equal(first.status, "passed");
  assert.equal(first.score, 1);
  assert.equal(first.steps.length, 3);
  assert.equal(first.usage?.totalTokens, 45);
  const messages = JSON.stringify(model.doStreamCalls[1].prompt);
  assert.match(messages, /Categorizing tests by their value/);
  const repeat = await runCase({ entry: entry(root), seed, skills: new Map(), model, iteration: 2 });
  assert.equal(repeat.status, "failed");
  assert.equal(repeat.score, 0.5);
  assert.equal(repeat.checks[0].exitCode, 1);
  assert.equal(await readFile(join(root, "input.txt"), "utf8"), "before\n");
  assert.ok(!model.doStreamCalls[3].tools?.some((tool) => tool.name === "read_skill"));
});

test("an unfinished tool loop cannot pass, even when its checks pass", async (t) => {
  const root = await temp(t);
  await writeFile(join(root, "input.txt"), "before\n");
  const spec = entry(root);
  spec.maxSteps = 1;
  spec.checks = [spec.checks[0]];
  const result = await runCase({
    entry: spec,
    seed: await loadSeed(root),
    skills: new Map(),
    model: modelWith([[call("bash", { command: "printf after > input.txt" })]]),
  });
  assert.equal(result.status, "incomplete");
  assert.equal(result.score, 1);
});

test("provider errors retain earlier steps and are not misreported as failed assertions", async (t) => {
  const root = await temp(t);
  await writeFile(join(root, "input.txt"), "before\n");
  const result = await runCase({
    entry: entry(root),
    seed: await loadSeed(root),
    skills: new Map(),
    model: modelWith([
      [call("bash", { command: "cat input.txt" })],
      [{ type: "error", error: new Error("subscription limit reached") }],
    ]),
  });
  assert.equal(result.status, "error");
  assert.match(result.error!, /subscription limit reached/);
  assert.equal(result.steps[0].toolResults.length, 1);
  assert.deepEqual(result.checks, []);
});
