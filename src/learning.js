/**
 * Human-readable, policy-view-only explanations for a Wumpus frame.
 * These helpers deliberately do not inspect `frame.world`: a learner should
 * see the same evidence that the policy received.
 */

const keyOf = (value) => {
  if (Array.isArray(value) && value.length >= 2) return `${value[0]},${value[1]}`;
  if (value && typeof value === 'object' && Number.isFinite(value.x) && Number.isFinite(value.y)) return `${value.x},${value.y}`;
  return typeof value === 'string' ? value.replace(/\s+/g, '') : null;
};

const pointOf = (value) => {
  const key = keyOf(value);
  if (!key) return null;
  const [x, y] = key.split(',').map(Number);
  return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
};

const sameCell = (a, b) => a && b && a[0] === b[0] && a[1] === b[1];
const adjacent = (a, b) => a && b && Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;

function beliefFor(frame) {
  const policy = frame?.policy ?? {};
  return policy.belief ?? policy.beliefs ?? frame?.belief ?? frame?.beliefs ?? {};
}

function observationsFor(belief) {
  const observations = belief?.observations ?? belief?.history ?? [];
  return Array.isArray(observations) ? observations : [];
}

function breezeFor(observation) {
  if (typeof observation?.breeze === 'boolean') return observation.breeze;
  if (typeof observation?.percept?.breeze === 'boolean') return observation.percept.breeze;
  return null;
}

function isLiveObservation(observation) {
  return observation?.dead !== true && observation?.percept?.dead !== true && observation?.status !== 'dead' && observation?.percept?.status !== 'dead';
}

/**
 * Explain the pit evidence for one cell using the policy's recorded beliefs.
 * @param {object} frame recorded session frame
 * @param {[number, number]|{x:number,y:number}|string} cell target cell
 * @returns {{probability:number|null,evidence:string[],summary:string}}
 */
export function explainCell(frame, cell) {
  const target = pointOf(cell);
  if (!target) return { probability: null, evidence: [], summary: 'Choose a cell as [x, y] to inspect its pit evidence.' };

  const policy = frame?.policy ?? {};
  const belief = beliefFor(frame);
  const targetKey = keyOf(target);
  const evidence = [];
  const start = pointOf(belief?.start ?? policy?.start ?? [1, 1]);
  const observations = observationsFor(belief);
  const visited = Array.isArray(policy?.visited) ? policy.visited.map(pointOf).filter(Boolean) : [];
  const observedHere = observations.some((observation) => isLiveObservation(observation) && sameCell(pointOf(observation?.location ?? observation?.cell), target));
  const visitedHere = visited.some((visitedCell) => sameCell(visitedCell, target));
  const quietNeighbor = observations.find((observation) => isLiveObservation(observation) && breezeFor(observation) === false && adjacent(pointOf(observation?.location ?? observation?.cell), target));
  const breezyNeighbor = observations.find((observation) => isLiveObservation(observation) && breezeFor(observation) === true && adjacent(pointOf(observation?.location ?? observation?.cell), target));

  if (sameCell(target, start)) {
    evidence.push('The start cell is defined as safe.');
    return { probability: 0, evidence, summary: `Cell ${targetKey} has no pit: it is the start cell.` };
  }
  if (visitedHere || observedHere) {
    evidence.push(visitedHere ? 'The policy recorded this cell as visited while alive.' : 'A live percept was recorded at this cell.');
    return { probability: 0, evidence, summary: `Cell ${targetKey} has no pit: the agent was there and survived.` };
  }
  if (quietNeighbor) {
    evidence.push(`No breeze at adjacent cell ${keyOf(quietNeighbor.location ?? quietNeighbor.cell)} rules out a pit here.`);
    return { probability: 0, evidence, summary: `Cell ${targetKey} has no pit: an adjacent no-breeze observation rules out its pit.` };
  }
  if (breezyNeighbor) evidence.push(`A breeze at adjacent cell ${keyOf(breezyNeighbor.location ?? breezyNeighbor.cell)} leaves risk among its neighboring cells; it does not identify this cell.`);

  const rawProbability = belief?.pitProbabilities?.[targetKey];
  const probability = typeof rawProbability === 'number' && Number.isFinite(rawProbability) ? rawProbability : null;
  if (probability !== null) evidence.push(`The policy's conditioned pit belief assigns ${(probability * 100).toFixed(1)}% to this cell.`);
  if (probability === null) return { probability, evidence, summary: evidence.length ? `Cell ${targetKey} has nearby evidence, but no numeric pit belief was recorded.` : `No recorded pit evidence is available for cell ${targetKey}.` };
  return { probability, evidence, summary: `The recorded pit probability for cell ${targetKey} is ${(probability * 100).toFixed(1)}%.` };
}

/** Return concise interpretations of the currently active percept flags. */
export function senseGuide(percept = {}) {
  const guide = [];
  if (percept.breeze) guide.push('Breeze: at least one adjacent cell contains a pit.');
  else guide.push('No breeze: all adjacent cells are free of pits, assuming the perfect sensor. Diagonals do not count.');
  if (percept.stench) guide.push('Stench: the Wumpus is in or adjacent to this cell; stench produces no built-in pit inference.');
  if (percept.glitter) guide.push('Glitter: gold is in this cell and can be grabbed.');
  if (percept.bump) guide.push('Bump: the last forward move hit a wall, so the agent did not change cells.');
  if (percept.scream) guide.push('Scream: the last shot killed the Wumpus.');
  return guide.length ? guide : ['No breeze, stench, glitter, bump, or scream is currently perceived.'];
}
