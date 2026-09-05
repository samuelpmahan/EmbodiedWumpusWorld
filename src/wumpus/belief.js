import { conditionWeights, marginalProbability } from '../core/index.js';
/**
 * Finite Bayesian pit belief for a Wumpus board.  The implementation is
 * deliberately independent of the world engine: observations are plain
 * objects and locations are either [x,y] or "x,y".
 */

export const DEFAULT_WIDTH = 4;
export const DEFAULT_HEIGHT = 4;
export const MAX_HYPOTHESES = 32768;

const keyOf = (p) => Array.isArray(p) ? `${p[0]},${p[1]}` : String(p);
const parseKey = (k) => k.split(',').map(Number);
const asPoint = (p) => Array.isArray(p) ? p : [p?.x, p?.y];
const same = (a, b) => a[0] === b[0] && a[1] === b[1];

function neighbours([x, y], width, height) {
  return [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]
    .filter(([a, b]) => a >= 1 && a <= width && b >= 1 && b <= height);
}

/** Create a finite pit belief. */
export function createBelief(options = {}) {
  const width = options.width ?? DEFAULT_WIDTH;
  const height = options.height ?? DEFAULT_HEIGHT;
  if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1) throw new RangeError('width and height must be positive integers');
  const pitPrior = options.pitPrior ?? 0.2;
  if (typeof pitPrior !== 'number' || !Number.isFinite(pitPrior) || pitPrior < 0 || pitPrior > 1) throw new RangeError('pitPrior must be between 0 and 1');
  const start = asPoint(options.start ?? [1, 1]);
  const cells = [];
  for (let y = 1; y <= height; y++) for (let x = 1; x <= width; x++) {
    if (!same([x, y], start)) cells.push([x, y]);
  }
  if (cells.length > 16) throw new RangeError('belief supports at most 16 non-start cells');
  const count = 1 << cells.length;
  let hypotheses = [];
  for (let mask = 0; mask < count; mask++) {
    let pits = 0;
    for (let i = 0; i < cells.length && i < 30; i++) if (mask & (1 << i)) pits++;
    hypotheses.push({ mask, weight: Math.pow(pitPrior, pits) * Math.pow(1 - pitPrior, cells.length - pits) });
  }
  const provenance = [];
  const observations = [];

  const pitAt = (h, p) => {
    const i = cells.findIndex((c) => same(c, p));
    return i >= 0 && i < 31 ? Boolean(h.mask & (1 << i)) : false;
  };
  const normalize = () => {
    const total = hypotheses.reduce((s, h) => s + h.weight, 0);
    if (total > 0) for (const h of hypotheses) h.weight /= total;
  };
  normalize();

  const api = {
    /** Condition the hypotheses on one percept at a location. */
    observe(percept = {}, location = start) {
      const loc = Array.isArray(location) ? location : (location && typeof location === 'object' ? [location.x, location.y] : parseKey(keyOf(location)));
      const breeze = Boolean(percept.breeze);
      const ns = neighbours(loc, width, height).filter((p) => !same(p, start));
      const priorCount = hypotheses.length;
      hypotheses = conditionWeights(hypotheses, (h) => {
        const sensed = ns.some((p) => pitAt(h, p));
        if (sensed !== breeze) return 0;
        // Receiving a percept after a movement means the current square was survived.
        if (!same(loc, start) && !percept.dead && pitAt(h, loc)) return 0;
        return 1;
      });
      const retained = hypotheses.reduce((count, hypothesis) => count + (hypothesis.weight > 0 ? 1 : 0), 0);
      const record = { location: [...loc], breeze, retained, hypothesisCount: priorCount };
      observations.push(record);
      provenance.push({ type: 'percept', location: [...loc], breeze, retained });
      return api.inspect();
    },
    candidates() {
      return hypotheses.filter((h) => h.weight > 0).map((h) => ({ mask: h.mask, weight: h.weight }));
    },
    expandCandidates() {
      return hypotheses.filter((h) => h.weight > 0).map((h) => ({
        mask: h.mask, pits: cells.filter((p) => pitAt(h, p)).map((p) => [...p]), weight: h.weight,
      }));
    },
    probability(location) {
      return marginalProbability(hypotheses, (h) => pitAt(h, location));
    },
    inspect() {
      const pitProbabilities = Object.fromEntries(cells.map((p) => [keyOf(p), api.probability(p)]));
      return { width, height, pitPrior, start: [...start], cells: cells.map((p) => [...p]), hypotheses: hypotheses.length,
        candidates: api.candidates(), pitProbabilities, provenance: provenance.slice(), observations: observations.slice() };
    },
    get width() { return width; },
    get height() { return height; },
    get start() { return [...start]; },
  };
  return api;
}

export default createBelief;
