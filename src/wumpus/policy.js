import { createBelief } from './belief.js';

const DIRS = [[1, 0], [0, -1], [-1, 0], [0, 1]];
const ACTIONS = Object.freeze({ FORWARD: 'forward', LEFT: 'turnLeft', RIGHT: 'turnRight', GRAB: 'grab', CLIMB: 'climb', SHOOT: 'shoot' });
const key = ([x, y]) => `${x},${y}`;
const inBounds = (p, w, h) => p[0] >= 1 && p[0] <= w && p[1] >= 1 && p[1] <= h;

/** A percept-only, stateful policy. */
export function createPolicy(options = {}) {
  const width = options.width ?? options.size ?? 4, height = options.height ?? options.size ?? 4;
  const belief = options.belief ?? createBelief(options);
  const rawStart = options.start ?? [1, 1];
  let loc = Array.isArray(rawStart) ? [...rawStart] : [rawStart.x, rawStart.y];
  const headingNames = { east: 0, e: 0, south: 1, s: 1, west: 2, w: 2, north: 3, n: 3 };
  let heading = typeof options.heading === 'string' ? (headingNames[options.heading.toLowerCase()] ?? 0) : (options.heading ?? 0);
  let pending = null;
  let lastPercept = null;
  let hasGold = false;
  const visited = new Set([key(loc)]);
  const history = [];

  function apply(action) {
    if (action === ACTIONS.LEFT || action === 'left') heading = (heading + 3) % 4;
    else if (action === ACTIONS.RIGHT || action === 'right') heading = (heading + 1) % 4;
    else if (action === ACTIONS.FORWARD) {
      const next = [loc[0] + DIRS[heading][0], loc[1] + DIRS[heading][1]];
      if (inBounds(next, width, height)) { loc = next; visited.add(key(loc)); }
    }
  }
  function turnToward(dir) {
    const d = (dir - heading + 4) % 4;
    return d === 0 ? ACTIONS.FORWARD : d === 1 ? ACTIONS.RIGHT : ACTIONS.LEFT;
  }
  function routeHomeDirection() {
    const startPoint = [options.start?.x ?? options.start?.[0] ?? 1, options.start?.y ?? options.start?.[1] ?? 1];
    const target = key(startPoint);
    const origin = key(loc);
    if (origin === target) return null;
    const queue = [[loc, null]];
    const seen = new Set([origin]);
    while (queue.length) {
      const [at, first] = queue.shift();
      for (let d = 0; d < DIRS.length; d++) {
        const next = [at[0] + DIRS[d][0], at[1] + DIRS[d][1]];
        const nk = key(next);
        if (!visited.has(nk) || seen.has(nk)) continue;
        const step = first ?? d;
        if (nk === target) return step;
        seen.add(nk); queue.push([next, step]);
      }
    }
    return null;
  }
  return {
    observe(percept = {}) {
      if (pending) {
        // A bump means the attempted forward action did not change pose.
        if (!(pending === ACTIONS.FORWARD && percept.bump)) apply(pending);
        pending = null;
      }
      lastPercept = { ...percept };
      belief.observe(percept, loc);
      history.push({ type: 'observe', location: [...loc], heading, percept: { ...percept } });
      return this.inspect();
    },
    chooseAction() {
      let action;
      if (hasGold && loc[0] === (options.start?.x ?? options.start?.[0] ?? 1) && loc[1] === (options.start?.y ?? options.start?.[1] ?? 1)) action = ACTIONS.CLIMB;
      else if (lastPercept?.glitter) action = ACTIONS.GRAB;
      else if (hasGold && routeHomeDirection() !== null) action = turnToward(routeHomeDirection());
      else if (lastPercept?.bump) action = ACTIONS.RIGHT;
      else {
        const options = DIRS.map((d, i) => [i, [loc[0] + d[0], loc[1] + d[1]]])
          .filter(([, p]) => inBounds(p, width, height) && !visited.has(key(p)))
          .sort((a, b) => belief.probability(a[1]) - belief.probability(b[1]));
        const target = options.find(([, p]) => belief.probability(p) < 0.5);
        action = target ? turnToward(target[0]) : (inBounds([loc[0] + DIRS[heading][0], loc[1] + DIRS[heading][1]], width, height) ? ACTIONS.FORWARD : ACTIONS.RIGHT);
      }
      return action;
    },
    recordAction(action) {
      if (typeof action !== 'string') throw new TypeError('action must be a string');
      pending = action;
      if (action === ACTIONS.GRAB && lastPercept?.glitter) hasGold = true;
      history.push({ type: 'action', action, location: [...loc], heading });
      return action;
    },
    inspect() {
      return { location: [...loc], heading, pendingAction: pending, visited: [...visited].map((s) => s.split(',').map(Number)), lastPercept: lastPercept && { ...lastPercept }, hasGold, belief: belief.inspect(), provenance: history.slice() };
    },
    get belief() { return belief; },
  };
}

export { ACTIONS };
export default createPolicy;
