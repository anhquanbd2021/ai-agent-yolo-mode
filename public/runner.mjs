// Scenario runner: replays a scripted agent run under a policy and produces a
// verdict-per-action log plus blast-radius and cost counters. Deterministic —
// same scenario + same policy = same log. Nothing here executes anything real.

import { evaluate } from './policy.mjs';

// The simulated operator behind a gated run: approves only the risky actions the
// task actually asked for (action.expected === true). Everything else a model
// decides on its own — deleting test data, force-pushing, merging, posting,
// publishing — gets a human "no". This stands in for a person reading the
// request; it is a rule, not judgment (see README honest limits).
export const expectedApprover = action => action.expected === true;

export function runScenario(scenario, policy, approver = expectedApprover) {
  const log = [];
  let blast = 0;
  let cost = 0;
  let approvals = 0;
  let halted = false;

  scenario.actions.forEach((action, index) => {
    if (halted) {
      log.push({ step: index + 1, action, verdict: 'not-run', executed: false, blastAfter: blast, costAfter: cost });
      return;
    }

    const decision = evaluate(action, policy, { blast, cost });
    let verdict = decision.verdict;
    let executed = false;

    if (decision.ask) {
      approvals += 1;
      if (approver(action, scenario)) {
        verdict = 'approved';
        executed = true;
      } else {
        verdict = 'denied-by-operator';
      }
    } else if (decision.execute) {
      executed = true;
    }

    if (executed) {
      blast += action.blast;
      cost = round2(cost + action.cost);
    }
    if (decision.halt) halted = true;

    log.push({ step: index + 1, action, verdict, executed, blastAfter: blast, costAfter: cost });
  });

  return {
    log,
    summary: {
      policy: policy.name,
      actions: scenario.actions.length,
      executed: log.filter(e => e.executed).length,
      deniedByPolicy: log.filter(e => e.verdict === 'denied-by-policy').length,
      deniedByOperator: log.filter(e => e.verdict === 'denied-by-operator').length,
      blockedByCap: log.filter(e => e.verdict === 'blocked-budget' || e.verdict === 'blocked-blast-cap').length,
      approvals,
      blast,
      cost,
      halted,
    },
  };
}

// Worst-case blast radius of a scenario: what the run would touch with no gate,
// no denylist, and no caps — the yolo baseline.
export function maxBlast(scenario) {
  return scenario.actions.reduce((sum, a) => sum + a.blast, 0);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
