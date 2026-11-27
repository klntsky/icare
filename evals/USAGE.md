# Local skill evals

Requires Node.js 22.18+ and a ChatGPT plan with Codex access.

```sh
npm ci
npm run eval:login
npm run --silent eval -- run --case sandbox-smoke
npm run --silent eval -- run --case test-selection --output evals/results/skills.json
npm run --silent eval -- run --case test-selection --baseline --output evals/results/baseline.json
```

Login prints an OpenAI verification URL and a device code. Open the URL on your
own device, sign in, and approve it. Enable device-code authorization in ChatGPT's
security settings if OpenAI requires it. This works over SSH or a Telegram bridge;
no browser callback to the runner is required. Never send access or refresh tokens
in chat.

Credentials live in `$CODEX_HOME/ai-sdk.auth.json`, or
`~/.codex/ai-sdk.auth.json`, with private permissions. They are deliberately separate
from Codex CLI credentials to avoid sharing refresh-token rotation. The provider
refreshes tokens automatically. `OPENAI_API_KEY` is not used and there is no
API-billing fallback. An expired or rejected login requires authorization again.

The [community Codex provider](https://github.com/giuseppeg/ai-sdk-codex-subscription-provider)
uses the ChatGPT Codex subscription endpoint, not the public OpenAI API. It is
unofficial, intended for local use, and its backend protocol can change. Model
availability and usage limits depend on the account. Select another available
model with `--model ID`; the default is `gpt-5.4-mini`. Token counts in the report
are model usage, not a remaining-subscription-quota measurement. The runner does
not estimate dollar costs or retry failed generations.

## Cases

`evals/suites/example.json` demonstrates the format. Pass another file with
`--suite PATH`; seed paths are relative to that file, not the working directory.
Each case contains:

- `id`: unique lowercase, hyphenated identifier.
- `prompt`: task shown to the model.
- `seed`: explicit directory copied into `/workspace` before model execution.
- `skills`: optional allow-list of icare skill names; omitted means all icare
  skills, and `[]` means none.
- `maxSteps`: maximum model turns, including the final answer (default 12).
- `timeoutMs`: total model/tool-loop deadline (default 120000).
- `checks`: nonempty list of named assertions. `type: "bash"` runs `command`
  against the final in-memory filesystem and passes only on exit code zero.
  `type: "response"` checks for a case-sensitive `includes` substring in the
  final response.

Checks stay outside the model's filesystem and prompt. Bash checks are trusted
suite-author code, run sequentially after generation; keep them read-only so one
check cannot influence the next. They use just-bash, not host executables: Node,
npm, Python, and arbitrary native programs are unavailable. A framework needing
those runtimes needs a different execution backend, not a host-shell escape.

`test-selection` is a small demonstration, not evidence of general skill efficacy.
Add representative held-out tasks and compare repeated runs with and without
skills. `--repeat N` runs each case N times sequentially, each from the same seed
snapshot. `--case ID` selects one case. The runner does not claim deterministic
model output.

## icare-only skill reader

`read_skill` accepts exact names discovered under this repository's `skills/`.
It returns `README.md` first when present, followed by `SKILL.md`. The tool schema
contains only the case's allowed names, and execution also checks the allow-list.
Paths, URLs, home-directory skills, and third-party registries are not supported.
The model sees skill names and descriptions and chooses which skills to read;
skill bodies are not injected automatically. Reads appear in the tool trace.

The catalog is snapshotted before any runs. The model cannot modify it through
bash. `--baseline` removes both the catalog instructions and the reader tool;
it does not merely ask the model to ignore skills. Keep task prompts independent
of skill names when comparing baseline results.

## Isolation and results

The [just-bash](https://github.com/vercel-labs/just-bash) filesystem is entirely in
memory, seeded eagerly using asynchronous disk reads. No disk-backed overlay,
lazy host reads, host environment, network commands, custom host commands, or
optional language runtimes are exposed to the model. Binary file bytes and empty
directories are preserved. Symlinks and special files in seeds are rejected.
Seeds are limited to 8 MiB / 10000 entries. Each run has a fresh filesystem with a
32 MiB retained-file limit, 32 KiB command-output limit, and 5-second command
limit. just-bash is an in-process interpreter, not an OS security boundary; use
process/container isolation for hostile workloads.

Only explicitly selected fixtures are loaded. Do not seed secrets: file contents
read by the model are sent to OpenAI and can appear in reports. Do not mutate seed
or skill directories during loading. Credentials are never seeded automatically.
Agent edits never write back to disk. Only an explicitly requested `--output`
report is persisted; it may contain sensitive fixture text and model output.

Stdout contains the JSON report (`npm run --silent` avoids npm's command banner);
progress goes to stderr. Reports contain input/check definitions, seed and skill
SHA-256 hashes, model ID, per-step text/tool calls/results, token usage, elapsed
time, assertion results, and aggregate scores. Raw HTTP headers and OAuth tokens
are not recorded. Exit status is zero only when every run finishes normally and
passes every check. A failed check, provider error, or exhausted step budget exits
nonzero; these have distinct `failed`, `error`, and `incomplete` statuses. Score is
the fraction of checks passing, not proof that a run completed successfully.

## Verification

```sh
npm run check
npm run test:evals
```

Tests exercise the real AI SDK tool loop with scripted model streams and real
just-bash execution, without a live account. Temporary test files use Linux
`/dev/shm`; `EVAL_TEST_TMPDIR` may select another tmpfs mount. These tests do not
verify live OAuth or backend compatibility. Use `sandbox-smoke` after login for
that; it consumes subscription usage.
