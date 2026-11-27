import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, statfs, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execute = promisify(execFile);

test("login persists only in the checkout root and evals reject global credentials", async (t) => {
  const ram = process.env.EVAL_TEST_TMPDIR ?? "/dev/shm";
  assert.equal((await statfs(ram)).type, 0x01021994, "Tests require a RAM-backed tmpfs directory");
  const root = await mkdtemp(join(ram, "icare-auth-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const repo = join(root, "checkout");
  const home = join(root, "home");
  const codexHome = join(root, "global-codex");
  for (const directory of [join(repo, "evals"), join(repo, "skills"), join(repo, "seed"), join(home, ".codex"), codexHome]) {
    await mkdir(directory, { recursive: true });
  }
  for (const name of ["cli.ts", "suite.ts", "skills.ts", "runner.ts"]) {
    await copyFile(new URL(name, import.meta.url), join(repo, "evals", name));
  }
  await writeFile(join(repo, "package.json"), '{"type":"module"}');
  await symlink(fileURLToPath(new URL("../node_modules", import.meta.url)), join(repo, "node_modules"));
  const globalPaths = [join(home, ".codex", "ai-sdk.auth.json"), join(codexHome, "ai-sdk.auth.json")];
  for (const path of globalPaths) await writeFile(path, "global credential sentinel");
  const suite = join(repo, "suite.json");
  await writeFile(suite, JSON.stringify({ cases: [{
    id: "auth-boundary", seed: "seed", prompt: "Hello", skills: [],
    checks: [{ type: "response", name: "answered", includes: "Hello" }],
  }] }));
  const cli = join(repo, "evals", "cli.ts");
  const env = { ...process.env, HOME: home, CODEX_HOME: codexHome, NODE_OPTIONS: "" };
  await assert.rejects(execute(process.execPath, [cli, "run", "--suite", suite], { cwd: home, env }), (error: unknown) => {
    assert.ok(error instanceof Error && "stderr" in error);
    assert.match(String(error.stderr), /Run pnpm eval:login first/);
    return true;
  });

  const transport = join(root, "oauth.mjs");
  await writeFile(transport, `
const payload = Buffer.from(JSON.stringify({
  exp: 4102444800,
  "https://api.openai.com/auth": { chatgpt_account_id: "test-account" }
})).toString("base64url");
globalThis.fetch = async (input) => {
  const url = String(input);
  if (url === "https://auth.openai.com/api/accounts/deviceauth/usercode")
    return Response.json({ device_auth_id: "device", user_code: "TEST-CODE", interval: "1" });
  if (url === "https://auth.openai.com/api/accounts/deviceauth/token")
    return Response.json({ authorization_code: "approved", code_challenge: "challenge", code_verifier: "verifier" });
  if (url === "https://auth.openai.com/oauth/token")
    return Response.json({ access_token: "test." + payload + ".test", refresh_token: "test-refresh" });
  throw new Error("Unexpected network request: " + url);
};
`);
  const login = await execute(process.execPath, ["--import", transport, cli, "login"], { cwd: home, env });
  const credentialPath = join(repo, ".auth", "codex.json");
  assert.ok(login.stderr.includes(`Credentials saved to ${credentialPath}`));
  const saved = JSON.parse(await readFile(credentialPath, "utf8"));
  assert.equal(saved.accountId, "test-account");
  assert.equal(saved.refreshToken, "test-refresh");
  assert.equal((await stat(credentialPath)).mode & 0o777, 0o600);
  assert.equal((await stat(join(repo, ".auth"))).mode & 0o777, 0o700);
  for (const path of globalPaths) assert.equal(await readFile(path, "utf8"), "global credential sentinel");
});
