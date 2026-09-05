/**
 * A small, deterministic Wumpus World simulator.
 *
 * Coordinates are one based (`x` grows east and `y` grows north). The agent
 * starts at (1, 1), facing east. World values are plain data so callers may
 * serialize them or use them as immutable snapshots.
 * @module wumpus/world
 */

const DIRECTIONS = Object.freeze(['north', 'east', 'south', 'west']);
const DELTAS = Object.freeze({ north: [0, 1], east: [1, 0], south: [0, -1], west: [-1, 0] });
const PIT_PROBABILITY = 0.2;

/** @typedef {{x:number,y:number}} Cell */
/** @typedef {{x:number,y:number,heading:'north'|'east'|'south'|'west',alive:boolean,hasArrow:boolean,hasGold:boolean,inCave:boolean,dir?:string}} Agent */
/** @typedef {{x:number,y:number,alive:boolean}} Wumpus */
/** @typedef {{x:number,y:number,grabbed:boolean}} Gold */
/**
 * @typedef {Object} World
 * @property {number} size
 * @property {Agent} agent
 * @property {Wumpus} wumpus
 * @property {Gold} gold
 * @property {Cell[]} pits
 * @property {boolean} arrow
 * @property {boolean} terminal
 * @property {'ongoing'|'dead'|'won'} outcome
 * @property {'playing'|'dead'|'won'} status
 * @property {number} score
 * @property {number} turn
 * @property {number} rng
 * @property {string|null} lastAction
 * @property {string[]} events
 */

function nextRandom(state) {
  // Mulberry32, kept as an integer in the world to make stepWorld pure.
  let t = (state.rng + 0x6D2B79F5) | 0;
  t = Math.imul(t ^ t >>> 15, t | 1);
  t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  const value = ((t ^ t >>> 14) >>> 0);
  return { value: value / 4294967296, rng: t | 0 };
}

function canonicalize(world) {
  const heading = String(world.agent.heading || world.agent.dir || 'east').toLowerCase();
  world.agent.heading = DIRECTIONS.includes(heading) ? heading : 'east';
  world.agent.dir = world.agent.heading[0].toUpperCase();
  world.agent.alive = world.status !== 'dead' && world.outcome !== 'dead';
  world.agent.hasArrow = Boolean(world.arrow);
  world.agent.hasGold = Boolean(world.gold.grabbed || world.agent.hasGold);
  world.agent.inCave = world.outcome !== 'won';
  world.gold.grabbed = world.agent.hasGold;
  world.arrow = world.agent.hasArrow;
  world.status = world.outcome === 'ongoing' ? 'playing' : world.outcome;
  world.terminal = world.outcome !== 'ongoing';
  return world;
}

function cloneWorld(world) {
  return {
    ...world,
    agent: { ...world.agent },
    wumpus: { ...world.wumpus },
    gold: { ...world.gold },
    pits: world.pits.map((p) => ({ ...p })),
    events: [...(world.events || [])],
  };
}

function key(x, y) { return `${x},${y}`; }
function isStart(x, y) { return x === 1 && y === 1; }
function inBounds(world, x, y) { return x >= 1 && x <= world.size && y >= 1 && y <= world.size; }
function sameCell(a, b) { return a.x === b.x && a.y === b.y; }

function adjacentCells(world, cell, includeSelf = false) {
  const out = [];
  if (includeSelf) out.push({ x: cell.x, y: cell.y });
  for (const [dx, dy] of Object.values(DELTAS)) {
    const x = cell.x + dx, y = cell.y + dy;
    if (inBounds(world, x, y)) out.push({ x, y });
  }
  return out;
}

function hasPit(world, x, y) { return world.pits.some((p) => p.x === x && p.y === y); }

/** Create a seeded random Wumpus World. @param {{seed?:number,size?:number}} [options] @returns {World} */
export function createWorld({ seed = 1, size = 4 } = {}) {
  if (!Number.isInteger(size) || size < 2) throw new RangeError('size must be an integer >= 2');
  const initial = Number.isFinite(seed) ? (Math.trunc(seed) | 0) : 1;
  let rng = initial;
  const random = () => { const r = nextRandom({ rng }); rng = r.rng; return r.value; };
  const cells = [];
  for (let y = 1; y <= size; y += 1) for (let x = 1; x <= size; x += 1) if (!isStart(x, y)) cells.push({ x, y });
  const pits = cells.filter(() => random() < PIT_PROBABILITY);
  const pick = () => cells[Math.floor(random() * cells.length)];
  const wumpusCell = pick();
  const goldCell = pick();
  return {
    size,
    agent: { x: 1, y: 1, heading: 'east', dir: 'E', alive: true, hasArrow: true, hasGold: false, inCave: true },
    wumpus: { ...wumpusCell, alive: true },
    gold: { ...goldCell, grabbed: false },
    pits,
    arrow: true,
    terminal: false,
    outcome: 'ongoing',
    status: 'playing',
    score: 0,
    turn: 0,
    rng,
    lastAction: null,
    events: [],
  };
  return canonicalize(world);
}

/** A stable, hand-authored 4x4 world useful for examples and demos. @returns {World} */
export function demoWorld() {
  return {
    size: 4,
    agent: { x: 1, y: 1, heading: 'east', dir: 'E', alive: true, hasArrow: true, hasGold: false, inCave: true },
    wumpus: { x: 4, y: 4, alive: true },
    gold: { x: 3, y: 3, grabbed: false },
    pits: [{ x: 3, y: 1 }, { x: 1, y: 3 }, { x: 3, y: 4 }],
    arrow: true,
    terminal: false,
    outcome: 'ongoing',
    status: 'playing',
    score: 0,
    turn: 0,
    rng: 1,
    lastAction: null,
    events: [],
  };
  return canonicalize(world);
}

/** Return percepts at the agent's current cell. @param {World} world */
export function perceive(world) {
  const here = world.agent;
  const outcome = world.outcome || (world.status === 'playing' ? 'ongoing' : world.status);
  if (outcome !== 'ongoing') return { stench: false, breeze: false, glitter: false, bump: false, scream: false, dead: outcome === 'dead', won: outcome === 'won', status: outcome === 'ongoing' ? 'playing' : outcome };
  const wumpusCell = { x: world.wumpus.x, y: world.wumpus.y };
  const nearby = adjacentCells(world, here, true);
  const stench = nearby.some((c) => sameCell(c, wumpusCell));
  const breeze = adjacentCells(world, here, false).some((c) => hasPit(world, c.x, c.y));
  return {
    stench,
    breeze,
    glitter: sameCell(here, world.gold) && !world.gold.grabbed,
    bump: world.lastAction === 'forward' && world.events.includes('bump'),
    scream: world.lastAction === 'shoot' && world.events.includes('scream'),
    dead: outcome === 'dead',
    won: outcome === 'won',
    status: world.status,
  };
}

function normalizeAction(action) {
  const value = typeof action === 'string' ? action : action && (action.type || action.action);
  const normalized = String(value || '').toLowerCase().replace(/[-_ ]/g, '');
  const map = {
    forward: 'forward', move: 'forward', go: 'forward',
    left: 'left', turnleft: 'left',
    right: 'right', turnright: 'right',
    shoot: 'shoot', fire: 'shoot',
    grab: 'grab', pickup: 'grab', take: 'grab',
    climb: 'climb', exit: 'climb',
    noop: 'noop', wait: 'noop',
  };
  return map[normalized] || normalized;
}

/** Apply one action and return a new world snapshot. @param {World} world @param {string|{type?:string,action?:string}} action @returns {World} */
export function stepWorld(world, action) {
  const next = canonicalize(cloneWorld(world));
  const kind = normalizeAction(action);
  const allowed = new Set(['forward', 'left', 'right', 'shoot', 'grab', 'climb', 'noop']);
  if (!allowed.has(kind)) throw new RangeError(`unknown action: ${String(action)}`);
  if (world.terminal || world.status === 'dead' || world.status === 'won') return next;
  next.lastAction = kind;
  next.events = [];
  next.turn += 1;
  if (kind === 'forward') {
    next.score -= 1;
    const [dx, dy] = DELTAS[next.agent.heading || String(next.agent.dir || 'E').toLowerCase()];
    const x = next.agent.x + dx, y = next.agent.y + dy;
    if (!inBounds(next, x, y)) { next.events.push('bump'); return next; }
    next.agent.x = x; next.agent.y = y;
    if (hasPit(next, x, y) || (next.wumpus.alive && sameCell(next.agent, next.wumpus))) {
      next.status = 'dead'; next.outcome = 'dead'; next.terminal = true; next.score -= 1000; next.events.push(hasPit(next, x, y) ? 'fell' : 'eaten');
    }
  } else if (kind === 'left' || kind === 'right') {
    next.score -= 1;
    const offset = kind === 'left' ? -1 : 1;
    next.agent.heading = DIRECTIONS[(DIRECTIONS.indexOf(next.agent.heading || String(next.agent.dir || 'east').toLowerCase()) + offset + 4) % 4];
  } else if (kind === 'shoot') {
    if (!next.arrow) { next.score -= 1; return canonicalize(next); }
    next.score -= 10;
    next.arrow = false;
    const [dx, dy] = DELTAS[next.agent.heading || String(next.agent.dir || 'E').toLowerCase()];
    let x = next.agent.x + dx, y = next.agent.y + dy;
    while (inBounds(next, x, y)) {
      if (next.wumpus.alive && next.wumpus.x === x && next.wumpus.y === y) {
        next.wumpus.alive = false; next.events.push('scream'); break;
      }
      x += dx; y += dy;
    }
  } else if (kind === 'grab') {
    next.score -= 1;
    if (sameCell(next.agent, next.gold) && !next.gold.grabbed) { next.gold.grabbed = true; next.agent.hasGold = true; next.events.push('grabbed'); }
  } else if (kind === 'climb') {
    next.score -= 1;
    if (isStart(next.agent.x, next.agent.y)) { next.status = 'won'; next.outcome = 'won'; next.terminal = true; next.agent.inCave = false; if (next.gold.grabbed) next.score += 1000; next.events.push('escaped'); }
  }
  return canonicalize(next);
}

/** Parse a simple text world description. Keys include size, wumpus, gold, pits, agent. */
export function parseWorld(text) {
  if (typeof text !== 'string') throw new TypeError('world text must be a string');
  const lines = text.split(/\r?\n/).map((line) => line.replace(/#.*/, '').trim()).filter(Boolean);
  const data = {}; let grid = [];
  const cell = (value) => { const m = String(value).match(/(-?\d+)\s*[, ]\s*(-?\d+)/); return m ? { x: Number(m[1]), y: Number(m[2]) } : null; };
  for (const line of lines) {
    const match = line.match(/^([A-Za-z_]+)(?:\s*[:=]\s*|\s+)(.*)$/);
    if (!match) { if (/^[.#+GWPASNSEW ]+$/.test(line)) grid.push(line.replace(/\s/g, '')); else throw new SyntaxError(`invalid world record: ${line}`); continue; }
    const name = match[1].toLowerCase(), value = match[2];
    if (name === 'size') data.size = Number(value);
    else if (name === 'wumpus') data.wumpus = cell(value);
    else if (name === 'gold') data.gold = cell(value);
    else if (name === 'agent' || name === 'start') { data.agent = cell(value); const h = value.match(/(?:,|\s)(north|south|east|west|n|s|e|w)\s*$/i); if (h) data.heading = ({n:'north',s:'south',e:'east',w:'west'})[h[1].toLowerCase()] || h[1].toLowerCase(); }
    else if (name === 'pits' || name === 'pit') data.pits = [...(data.pits || []), ...value.split(/[;|]/).map(cell).filter(Boolean)];
    else throw new SyntaxError(`unknown world record: ${name}`);
  }
  if (grid.length) { data.size ||= grid.length; data.pits ||= []; grid.forEach((row, ri) => [...row].forEach((ch, ci) => { const c={x:ci+1,y:grid.length-ri}; if(ch.toUpperCase()==='P') data.pits.push(c); if(ch.toUpperCase()==='W') data.wumpus=c; if(ch.toUpperCase()==='G') data.gold=c; if(ch.toUpperCase()==='A') data.agent=c; })); }
  if (!Number.isInteger(data.size) || data.size < 2 || !data.wumpus || !data.gold) throw new SyntaxError('world requires integer size, wumpus, and gold');
  const valid = (c) => c && Number.isInteger(c.x) && Number.isInteger(c.y) && c.x >= 1 && c.x <= data.size && c.y >= 1 && c.y <= data.size;
  if (!valid(data.wumpus) || !valid(data.gold)) throw new RangeError('wumpus and gold must be in bounds');
  if ((data.wumpus.x === 1 && data.wumpus.y === 1) || (data.gold.x === 1 && data.gold.y === 1)) throw new RangeError('wumpus and gold cannot be at start');
  if (data.agent && (!valid(data.agent))) throw new RangeError('agent must be in bounds');
  if ((data.pits || []).some((c) => !valid(c) || (c.x === 1 && c.y === 1))) throw new RangeError('pits must be in bounds and cannot be at start');
  const world = createWorld({ size: data.size, seed: 1 });
  if (data.wumpus) world.wumpus = { ...data.wumpus, alive: true };
  if (data.gold) world.gold = { ...data.gold, grabbed: false };
  if (data.pits) world.pits = data.pits;
  if (data.agent) { world.agent.x = data.agent.x; world.agent.y = data.agent.y; }
  if (data.heading) world.agent.heading = data.heading;
  return canonicalize(world);
}

/** Load a world from text or a world object. Async file loading belongs to callers. */
export function loadWorld(source) { return typeof source === 'string' ? parseWorld(source) : canonicalize(cloneWorld(source)); }

export { DIRECTIONS }; 
