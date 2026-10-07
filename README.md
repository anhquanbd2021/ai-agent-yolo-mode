# Approval Gate Lab — companion demo

Interactive lab for the article *YOLO Mode Is a Permission Decision, Not a Speed
Hack*. It replays one scripted agent run — "fix the flaky login test and open a
PR" — under three permission models and shows what removing the approval gate
actually changes: which actions execute, how far the damage travels, and what it
costs.

Zero dependencies — Node 20+ only. The policy engine and runner are plain ES
modules shared by the browser UI, the CLI, and the test suite.

## Three policies, one run

| Policy | What it proves |
|---|---|
| **gated** | `gate: "risky"` — every irreversible or external action pauses for a human. The simulated operator approves only what the task asked for: 6 of 11 actions run, blast radius 5. |
| **yolo** | No gate, no denylist, no caps. All 11 actions execute — including `rm -rf` on shared fixtures, `git push --force` to main, an admin merge, a public comment, and `npm publish`. Blast radius 44. |
| **railed** | Autonomy with guardrails: a denylist blocks the four known-dangerous actions and a blast tripwire sits at 20. The listed dangers are stopped — and the fixture deletion still slips through, because a denylist only catches what you wrote down. Blast radius 13. |

## Run it

```text
npm start       # serve the lab on :3000
npm test        # policy engine + runner + examples sync + server
npm run scan    # CLI: one run, three policies side by side
npm run check   # both
```

## Layout

- `public/policy.mjs` — risk tiers (`read`/`reversible`/`irreversible`/`external`),
  deny matching by id / risk / kind, cap checks, evaluation order
  deny > cap > gate > allow.
- `public/runner.mjs` — `runScenario(scenario, policy, approver)`: verdict per
  action, blast + cost counters, halt on tripwires. `expectedApprover` simulates
  the human at the gate: it approves only actions the task declared.
- `public/scenarios.mjs` — embedded copies of `examples/*.json` (a test asserts
  they stay in sync).
- `examples/` — `incident-run.scenario.json` plus `gated`, `yolo`, `railed`
  policy files. Edit one and rerun `npm run scan`.
- `test/` — node:test suite covering the gate, the denylist, both tripwires,
  determinism, fixture sync, and the server allowlist.

## Honest limits

- The action stream is **scripted**. A real agent's steps are not predictable —
  that unpredictability is the argument for the gate, not a flaw in the demo.
- The simulated operator is a rule, not judgment. A tired human approves worse
  than `expectedApprover` — rubber-stamping is a real failure mode.
- Blast-radius and dollar numbers are illustrative units, not measurements.
- Nothing here executes a real command; enforcement in production lives in the
  agent harness, the forge's branch protection, and the credential's scopes.

This is an educational demo, not production infrastructure.
