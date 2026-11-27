import { lstat, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { tool } from "ai";
import { z } from "zod";
import { hash } from "./suite.ts";

const skillsRoot = fileURLToPath(new URL("../skills/", import.meta.url));
export type Skill = { name: string; description: string; content: string; sha256: string };

export async function loadIcareSkills(): Promise<ReadonlyMap<string, Skill>> {
  const skills = new Map<string, Skill>();
  for (const entry of (await readdir(skillsRoot, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || !/^[a-z0-9][a-z0-9-]*$/.test(entry.name)) continue;
    const path = join(skillsRoot, entry.name, "SKILL.md");
    if (!(await lstat(path)).isFile()) throw new Error(`Skill must be a regular file: ${entry.name}`);
    const skill = await readFile(path, "utf8");
    let introduction = "";
    try {
      const introPath = join(skillsRoot, entry.name, "README.md");
      if (!(await lstat(introPath)).isFile()) throw new Error(`Skill introduction must be a regular file: ${entry.name}`);
      introduction = `${await readFile(introPath, "utf8")}\n\n`;
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
    const content = introduction + skill;
    skills.set(entry.name, {
      name: entry.name,
      description: /^description:\s*(.+)$/m.exec(skill)?.[1]?.trim() ?? entry.name,
      content,
      sha256: hash(content),
    });
  }
  return skills;
}

export function selectSkills(catalog: ReadonlyMap<string, Skill>, names?: string[]): ReadonlyMap<string, Skill> {
  if (!names) return catalog;
  const selected = new Map<string, Skill>();
  for (const name of names) {
    const skill = catalog.get(name);
    if (!skill) throw new Error(`Unknown icare skill: ${name}`);
    selected.set(name, skill);
  }
  return selected;
}

export function skillReader(skills: ReadonlyMap<string, Skill>) {
  if (skills.size === 0) throw new Error("Cannot create an empty skill reader");
  return tool({
    description: "Read an icare skill by its exact catalog name. Returns SKILL.md, preceded by its README when present. No external skills, URLs, or filesystem paths are accepted.",
    inputSchema: z.object({ name: z.enum([...skills.keys()] as [string, ...string[]]) }).strict(),
    execute: async ({ name }) => {
      const skill = skills.get(name);
      if (!skill) throw new Error(`Unknown icare skill: ${name}`);
      return { name: skill.name, content: skill.content };
    },
  });
}
