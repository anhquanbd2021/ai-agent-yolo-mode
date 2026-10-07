// Policy engine for the Approval Gate Lab.
// Classifies agent actions by blast radius and decides who may authorize them:
// a human gate, a written denylist, a tripwire cap — or nobody (yolo).

// Risk tiers, ordered by how far the damage can travel.
export const RISK = Object.freeze({
  READ: 'read',             // observes only — nothing to undo
  REVERSIBLE: 'reversible', // local change with an undo path (edit, commit)
  IRREVERSIBLE: 'irreversible', // local destruction with no undo (rm -rf data)
  EXTERNAL: 'external',     // lands outside the sandbox: pushes, merges, posts, publishes
});

// Tiers a human gate intercepts. Reads and reversible local edits flow through.
export const GATE_RISKS = new Set([RISK.IRREVERSIBLE, RISK.EXTERNAL]);

export function gateApplies(action) {
  return GATE_RISKS.has(action.risk);
}

// A deny entry matches an action by id, by risk tier, or by kind tag.
export function matchesDeny(action, denyList = []) {
  return denyList.some(entry =>
    entry === action.id || entry === action.risk || entry === action.kind);
}

// Evaluation order matters: deny > cap > gate > allow.
// A denylist entry beats every other rule in every mode — that is the point of
// encoding known-dangerous actions in policy instead of relying on attention.
export function evaluate(action, policy, state = { blast: 0, cost: 0 }) {
  if (matchesDeny(action, policy.deny)) {
    return { verdict: 'denied-by-policy', execute: false };
  }
  if (policy.maxCost != null && state.cost + action.cost > policy.maxCost) {
    return { verdict: 'blocked-budget', execute: false, halt: true };
  }
  if (policy.maxBlast != null && state.blast + action.blast > policy.maxBlast) {
    return { verdict: 'blocked-blast-cap', execute: false, halt: true };
  }
  if (policy.gate === 'risky' && gateApplies(action)) {
    return { verdict: 'needs-approval', execute: false, ask: true };
  }
  return { verdict: 'auto-allowed', execute: true };
}

// Validate a policy object loaded from JSON. Fails loudly on unknown shapes —
// a policy that silently ignores a misspelled key is worse than no policy.
export function validatePolicy(policy) {
  const problems = [];
  if (!policy || typeof policy !== 'object') problems.push('policy must be an object');
  else {
    if (typeof policy.name !== 'string' || !policy.name) problems.push('name is required');
    if (!['risky', 'never'].includes(policy.gate)) problems.push('gate must be "risky" or "never"');
    if (policy.deny != null && !Array.isArray(policy.deny)) problems.push('deny must be an array');
    for (const key of ['maxBlast', 'maxCost']) {
      if (policy[key] != null && (typeof policy[key] !== 'number' || policy[key] < 0)) {
        problems.push(`${key} must be a non-negative number`);
      }
    }
    for (const key of Object.keys(policy)) {
      if (!['name', 'gate', 'deny', 'maxBlast', 'maxCost', 'note'].includes(key)) {
        problems.push(`unknown key "${key}"`);
      }
    }
  }
  return problems;
}
