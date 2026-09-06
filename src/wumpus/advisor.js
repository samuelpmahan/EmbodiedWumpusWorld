import { ACTIONS } from './policy.js';

const DIRS = [[1, 0], [0, -1], [-1, 0], [0, 1]];
const NAMES = ['east', 'south', 'west', 'north'];
const key = ([x, y]) => `${x},${y}`;
const point = (p) => Array.isArray(p) ? [p[0], p[1]] : (p && Number.isFinite(p.x) && Number.isFinite(p.y) ? [p.x, p.y] : null);
const same = (a, b) => a?.[0] === b?.[0] && a?.[1] === b?.[1];
const heading = (v) => typeof v === 'number' ? ((v % 4) + 4) % 4 : ({ east: 0, e: 0, south: 1, s: 1, west: 2, w: 2, north: 3, n: 3 }[String(v ?? 'east').toLowerCase()] ?? 0);
const stateOf = (frame) => { const value = frame?.policy ?? frame ?? {}; return typeof value.inspect === 'function' ? value.inspect() : value; };
const riskMap = (analysis, state) => analysis?.pitProbabilities ?? state?.belief?.pitProbabilities ?? {};
const wumpusMap = (analysis) => analysis?.wumpusProbabilities ?? analysis?.wumpusLocationProbabilities ?? analysis?.wumpus?.probabilities ?? {};
function riskAt(map, p) { const n = map?.[key(p)]; return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0; }
function actionFor(from, to, facing) {
  const d = DIRS.findIndex(([x, y]) => from[0] + x === to[0] && from[1] + y === to[1]);
  if (d < 0) return ACTIONS.CLIMB;
  const turn = (d - facing + 4) % 4;
  return turn === 0 ? ACTIONS.FORWARD : turn === 1 ? ACTIONS.RIGHT : ACTIONS.LEFT;
}
function neighbours(p, width, height) { return DIRS.map(([dx, dy], d) => ({ p: [p[0] + dx, p[1] + dy], d })).filter(({ p: q }) => q[0] >= 1 && q[0] <= width && q[1] >= 1 && q[1] <= height); }

/** Propose one blind action from a recorded frame and belief analysis. */
export function advise(frame = {}, analysis = {}, { riskTolerance = 0.25 } = {}) {
  if (!Number.isFinite(riskTolerance) || riskTolerance < 0 || riskTolerance > 1) throw new RangeError('riskTolerance must be between 0 and 1');
  const state = stateOf(frame);
  const belief = state.belief ?? {};
  const location = point(state.location) ?? [1, 1];
  const start = point(belief.start ?? state.start) ?? [1, 1];
  const width = Number(belief.width ?? state.width ?? 4), height = Number(belief.height ?? state.height ?? 4);
  const facing = heading(state.heading);
  const percept = state.lastPercept ?? state.percept ?? {};
  const visited = new Set((state.visited ?? []).map(point).filter(Boolean).map(key));
  visited.add(key(location));
  const pits = riskMap(analysis, state), wumpus = analysis?.wumpusAlive === false ? {} : wumpusMap(analysis);
  const make = (cell, path = []) => {
    const pitRisk = riskAt(pits, cell), wumpusRisk = riskAt(wumpus, cell);
    const risk = Math.min(1, pitRisk + wumpusRisk);
    return { cell: [...cell], action: path.length ? actionFor(location, path[0], facing) : ACTIONS.FORWARD,
      pitRisk, wumpusRisk, risk, visited: visited.has(key(cell)), eligible: risk <= riskTolerance, path: path.map((p) => [...p]), reachable: risk <= riskTolerance,
      reason: `Cell (${cell.join(',')}) has conservative pit-or-Wumpus upper bound ${(risk * 100).toFixed(1)}%, ${risk <= riskTolerance ? 'within' : 'above'} the ${(riskTolerance * 100).toFixed(1)}% limit; route uses recorded visited cells.` };
  };
  if (percept.glitter) return { action: ACTIONS.GRAB, target: null, candidates: [], reason: 'The current percept reports glitter.', riskTolerance };
  if (state.hasGold && same(location, start)) return { action: ACTIONS.CLIMB, target: null, candidates: [], reason: 'Gold has been collected and the agent is at the start.', riskTolerance };

  if (state.hasGold) {
    const queue = [{ p: location, path: [] }], seen = new Set([key(location)]);
    let homePath = null;
    while (queue.length && !homePath) {
      const { p, path } = queue.shift();
      for (const { p: next } of neighbours(p, width, height)) {
        const nextKey = key(next); if (seen.has(nextKey) || !visited.has(nextKey)) continue;
        const nextPath = [...path, next]; seen.add(nextKey);
        if (same(next, start)) { homePath = nextPath; break; }
        queue.push({ p: next, path: nextPath });
      }
    }
    if (homePath) return { action: actionFor(location, homePath[0], facing), target: [...start], candidates: [],
      reason: 'Gold is recorded; follow the recorded visited route home.', riskTolerance };
  }

  // BFS through the recorded safe route to discover frontier cells.
  const queue = [{ p: location, path: [] }], seen = new Set([key(location)]), candidates = [];
  while (queue.length) {
    const { p, path } = queue.shift();
    for (const { p: next } of neighbours(p, width, height)) {
      const nk = key(next); if (seen.has(nk)) continue; seen.add(nk);
      const nextPath = [...path, next];
      if (visited.has(nk)) queue.push({ p: next, path: nextPath });
      else candidates.push(make(next, nextPath));
    }
  }
  candidates.sort((a, b) => a.risk - b.risk || a.path.length - b.path.length || key(a.cell).localeCompare(key(b.cell)));
  const selected = candidates.find((c) => c.eligible) ?? null;
  if (!selected) {
    const queue = [{ p: location, path: [] }], seen = new Set([key(location)]);
    let retreat = null;
    while (queue.length && !retreat) {
      const { p, path } = queue.shift();
      for (const { p: next } of neighbours(p, width, height)) {
        const nextKey = key(next); if (seen.has(nextKey) || !visited.has(nextKey)) continue;
        const nextPath = [...path, next]; seen.add(nextKey);
        if (same(next, start)) { retreat = nextPath; break; }
        queue.push({ p: next, path: nextPath });
      }
    }
    if (retreat) return { action: actionFor(location, retreat[0], facing), target: [...start], risk: 0, candidates,
      selected: null, reason: 'No frontier is within the danger budget; retreat along recorded safe cells.', riskTolerance };
    return { action: same(location, start) ? ACTIONS.CLIMB : ACTIONS.LEFT, target: null, risk: null, candidates,
      selected: null, reason: same(location, start) ? 'No eligible frontier remains at the start.' : 'No reachable frontier is within the selected danger budget.', riskTolerance };
  }
  return { action: selected.action, target: selected.cell, risk: selected.risk, candidates,
    selected: selected.cell, reason: selected.reason, riskTolerance };
}

export function createAdvisor(options = {}) {
  let frame = options.frame ?? options.policy ?? options.state ?? options;
  let analysis = options.analysis ?? {};
  return { observe(percept) { const state = stateOf(frame); frame = { ...frame, policy: frame.policy ? { ...state, lastPercept: { ...(percept ?? {}) } } : { ...state, lastPercept: { ...(percept ?? {}) } } }; return this.inspect(); }, advise(opts) { return advise(frame, analysis, { ...options, ...(opts ?? {}) }); }, inspect() { return structuredClone(stateOf(frame)); }, get policy() { return frame?.policy ?? frame; } };
}
export default createAdvisor;
