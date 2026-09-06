import { createBelief } from './belief.js';

const key = ([x, y]) => `${x},${y}`;
const point = (value) => Array.isArray(value) && value.length >= 2 ? [Number(value[0]), Number(value[1])]
  : value && Number.isFinite(value.x) && Number.isFinite(value.y) ? [value.x, value.y] : null;
const same = (a, b) => a[0] === b[0] && a[1] === b[1];
const neighboursAndSelf = ([x, y], width, height) => [[x, y], [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]
  .filter(([a, b]) => a >= 1 && a <= width && b >= 1 && b <= height);

function policyOf(frame) {
  const policy = frame?.policy ?? frame;
  if (policy && typeof policy.inspect === 'function') return policy.inspect();
  if (policy && typeof policy === 'object') return policy;
  throw new TypeError('analyzeBelief requires a frame with a policy snapshot');
}
function observationsOf(policy) {
  const provenance = Array.isArray(policy.provenance) ? policy.provenance : [];
  return provenance.filter((event) => event?.type === 'observe' && point(event.location) && event.percept)
    .map((event) => ({ location: point(event.location), percept: { ...event.percept } }));
}

/** Reconstruct a pure debugger report from information visible to policy only. */
export function analyzeBelief(frame, { pitPrior } = {}) {
  const policy = policyOf(frame);
  const recorded = observationsOf(policy);
  const sourceBelief = policy.belief ?? {};
  const width = sourceBelief.width ?? policy.width ?? 4;
  const height = sourceBelief.height ?? policy.height ?? 4;
  const start = point(sourceBelief.start ?? policy.start) ?? [1, 1];
  const prior = pitPrior ?? sourceBelief.pitPrior ?? 0.2;
  const assumptions = [
    'Pits are independent before conditioning, with the supplied pit prior; the start is pit-safe.',
    'One stationary Wumpus starts outside the safe start cell.',
    'Compatible Wumpus locations are weighted uniformly; stench is true on its cell and cardinal neighbours, including after death.',
    'Pit and Wumpus risks are reported separately; this analysis does not multiply independent hazard evidence.',
  ];
  const constraints = [];
  let belief;
  try {
    belief = createBelief({ width, height, start, pitPrior: prior });
    for (const { location, percept } of recorded) {
      belief.observe(percept, location);
      constraints.push(`${percept.breeze ? 'breeze' : 'no breeze'} at (${location.join(',')})`);
    }
  } catch (error) {
    throw new Error(`Contradictory recorded policy observations: ${error.message}`);
  }
  const posterior = belief.inspect();
  const cells = [];
  for (let y = 1; y <= height; y += 1) for (let x = 1; x <= width; x += 1) {
    const cell = [x, y]; if (!same(cell, start)) cells.push(cell);
  }
  let candidates = cells;
  let wumpusAlive = true;
  for (const { location, percept } of recorded) {
    const sensed = new Set(neighboursAndSelf(location, width, height).map(key));
    if (percept.stench === true) candidates = candidates.filter((cell) => sensed.has(key(cell)));
    if (percept.stench === false) candidates = candidates.filter((cell) => !sensed.has(key(cell)));
    constraints.push(`${percept.stench ? 'stench' : 'no stench'} at (${location.join(',')})`);
    if (percept.scream) wumpusAlive = false;
    else if (wumpusAlive) candidates = candidates.filter((cell) => !same(cell, location));
  }
  if (!candidates.length) throw new Error('Contradictory recorded policy observations: no stationary Wumpus location is compatible.');
  const locationProbability = 1 / candidates.length;
  const wumpusLocationProbabilities = Object.fromEntries(cells.map((cell) => [key(cell), candidates.some((c) => same(c, cell)) ? locationProbability : 0]));
  const wumpusProbabilities = Object.fromEntries(cells.map((cell) => [key(cell), wumpusAlive ? wumpusLocationProbabilities[key(cell)] : 0]));
  return {
    pitPrior: prior,
    pitProbabilities: { ...posterior.pitProbabilities },
    remaining: posterior.candidates.length,
    pitCandidates: posterior.candidates.map((candidate) => ({ ...candidate })),
    observations: recorded.map(({ location, percept }) => ({ location: [...location], percept: { ...percept } })),
    wumpusProbabilities,
    wumpusLocationProbabilities,
    wumpusCandidates: candidates.map((cell) => [...cell]),
    candidates: candidates.map((cell) => [...cell]),
    wumpusAlive,
    assumptions,
    constraints,
  };
}
export default analyzeBelief;
