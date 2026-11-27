import { createHash } from "node:crypto";
import { lstat, readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { z } from "zod";

const checkSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("bash"), name: z.string().min(1), command: z.string().min(1) }).strict(),
  z.object({ type: z.literal("response"), name: z.string().min(1), includes: z.string().min(1) }).strict(),
]);

export const suiteSchema = z.object({
  cases: z.array(z.object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
    prompt: z.string().min(1),
    seed: z.string().min(1),
    skills: z.array(z.string().min(1)).optional(),
    maxSteps: z.number().int().min(1).max(100).default(12),
    timeoutMs: z.number().int().min(1).max(600_000).default(120_000),
    checks: z.array(checkSchema).min(1),
  }).strict()).min(1),
}).strict().superRefine(({ cases }, context) => {
  const ids = new Set<string>();
  for (const entry of cases) {
    if (ids.has(entry.id)) context.addIssue({ code: "custom", message: `Duplicate case: ${entry.id}` });
    ids.add(entry.id);
  }
});

export type EvalCase = z.infer<typeof suiteSchema>["cases"][number];
export type Seed = { files: Record<string, Uint8Array>; directories: string[]; hashes: Record<string, string> };

export function hash(content: string | Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

export async function loadSuite(path: string) {
  const suitePath = resolve(path);
  const suite = suiteSchema.parse(JSON.parse(await readFile(suitePath, "utf8")));
  return { suitePath, cases: suite.cases.map((entry) => ({ ...entry, seed: resolve(dirname(suitePath), entry.seed) })) };
}

export async function loadSeed(root: string): Promise<Seed> {
  const files: Record<string, Uint8Array> = Object.create(null);
  const hashes: Record<string, string> = Object.create(null);
  const directories: string[] = [];
  let totalBytes = 0;
  let entries = 0;
  async function visit(host: string, guest: string): Promise<void> {
    if (++entries > 10_000) throw new Error("Seed exceeds 10000 filesystem entries");
    const stat = await lstat(host);
    if (stat.isDirectory()) {
      directories.push(guest);
      for (const name of (await readdir(host)).sort()) await visit(join(host, name), `${guest}/${name}`);
    } else if (stat.isFile()) {
      totalBytes += stat.size;
      if (totalBytes > 8 * 1024 * 1024) throw new Error("Seed exceeds 8 MiB");
      const bytes = await readFile(host);
      totalBytes += bytes.byteLength - stat.size;
      if (totalBytes > 8 * 1024 * 1024) throw new Error("Seed exceeds 8 MiB");
      files[guest] = bytes;
      hashes[guest] = hash(bytes);
    } else {
      throw new Error(`Seed must contain only regular files and directories: ${host}`);
    }
  }
  if (!(await lstat(root)).isDirectory()) throw new Error(`Seed must be a directory, not a symlink: ${root}`);
  await visit(root, "/workspace");
  return { files, directories, hashes };
}
