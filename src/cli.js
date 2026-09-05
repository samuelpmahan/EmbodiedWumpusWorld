#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { emitKeypressEvents } from 'node:readline';
import { createSession, demoWorld } from './session.js';
import { materialize } from './tui/materialize.js';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] ?? 'help';
  const option = (name, fallback) => { const i = args.indexOf(`--${name}`); return i < 0 ? fallback : args[i + 1]; };
  const number = (name, fallback) => { const v = Number(option(name, fallback)); if (!Number.isFinite(v)) throw Error(`Invalid --${name}`); return v; };
  if (command === 'priors') {
    const { breezeExperiment, materializePriors } = await import('./priors.js');
    console.log(materializePriors(breezeExperiment(number('prior', 0.2))));
    if (option('compare') !== undefined) console.log('\n' + materializePriors(breezeExperiment(number('compare', 0.5))));
    return;
  }
  if (command === 'help' || args.includes('--help')) {
    console.log(`Wumpus LAB — materials × calculations
node src/cli.js play [--seed 1] [--world file.txt]
node src/cli.js watch [--seed 1] [--policy ./my-policy.js]
node src/cli.js demo [--prior 0.2] [--steps 12] [--reveal]
node src/cli.js replay saved.json
node src/cli.js priors --prior 0.2 --compare 0.5

Options: --prior 0.2 --save run.json --inspect --reveal
Keys: f forward | l/r turn | g grab | s shoot | c climb
      n policy step | space run/pause | +/- speed | v reveal
      i inspect | [/] browse history | q quit
Custom module: export createPolicy({pitPrior}) with observe, recordAction,
chooseAction, inspect. It receives percepts and its own actions only.
Noninteractive play/watch prints the current materialization; demo runs steps.`);
    return;
  }
  let session, frames;
  if (command === 'replay') {
    const replay = JSON.parse(await readFile(args[1], 'utf8'));
    if (replay.schema !== 'lab-replay@1' || !Array.isArray(replay.frames) || !replay.frames.length) throw Error('Unsupported or empty replay');
    frames = replay.frames;
  } else {
    if (!['play', 'watch', 'demo'].includes(command)) throw Error(`Unknown command '${command}'`);
    let world = command === 'demo' ? demoWorld() : undefined;
    if (option('world')) {
      const { parseWorld } = await import('./wumpus/index.js');
      world = parseWorld(await readFile(option('world'), 'utf8'));
    }
    const prior = number('prior', 0.2);
    let policy;
    if (option('policy')) {
      const module = await import(pathToFileURL(resolve(option('policy'))));
      policy = module.createPolicy({ pitPrior: prior });
    }
    session = createSession({ seed: number('seed', 1), prior, world, policy });
    frames = session.frames;
  }
  let reveal = args.includes('--reveal'), inspect = args.includes('--inspect');
  let index = frames.length - 1, running = false, delay = 500, timer;
  const render = () => materialize(frames[index], { reveal, inspect, mode: command });
  const save = async () => { if (option('save') && session) await writeFile(option('save'), JSON.stringify(session.export(), null, 2) + '\n'); };
  if (!process.stdin.isTTY || !process.stdout.isTTY || command === 'demo') {
    if (command === 'demo') {
      const steps = number('steps', 12);
      if (!Number.isInteger(steps) || steps < 0 || steps > 1000) throw Error('--steps must be an integer from 0 to 1000');
      for (let n = 0; n < steps && !session.snapshot().world.terminal; n++) session.auto();
      index = frames.length - 1;
    }
    console.log(render()); await save(); return;
  }
  const draw = () => { process.stdout.write('\x1b[2J\x1b[H' + render() +
    `\n\n[${index + 1}/${frames.length}] ${running ? 'RUNNING' : 'PAUSED'} ${delay}ms | n step · space pause · v reveal · i inspect · [/] history · q quit\n`); };
  const advance = () => {
    if (session && index === frames.length - 1) { session.auto(); index = frames.length - 1; }
    else index = Math.min(index + 1, frames.length - 1);
    if (frames[index].world.terminal) running = false;
  };
  const schedule = () => { clearInterval(timer); timer = setInterval(() => { if (running) { try { advance(); draw(); } catch (e) { finish(e); } } }, delay); };
  let finished = false;
  const finish = async error => {
    if (finished) return; finished = true; clearInterval(timer);
    process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\x1b[?25h\n');
    try { await save(); } catch (e) { error ??= e; }
    if (error) { console.error(error.message); process.exitCode = 1; }
  };
  emitKeypressEvents(process.stdin); process.stdin.setRawMode(true); process.stdin.resume();
  process.stdout.write('\x1b[?25l');
  process.once('SIGTERM', () => finish()); process.once('SIGINT', () => finish());
  const keys = { f: 'forward', l: 'turnLeft', r: 'turnRight', g: 'grab', s: 'shoot', c: 'climb' };
  process.stdin.on('keypress', (str, key) => {
    try {
      if (str === 'q' || key?.ctrl && key.name === 'c') { finish(); return; }
      if (str === ' ') running = !running;
      else if (str === 'n') { running = false; advance(); }
      else if (str === 'v') reveal = !reveal;
      else if (str === 'i') inspect = !inspect;
      else if (str === '[') { running = false; index = Math.max(0, index - 1); }
      else if (str === ']') { running = false; index = Math.min(frames.length - 1, index + 1); }
      else if (str === '+' || str === '-') { delay = Math.max(50, Math.min(3000, delay + (str === '+' ? -100 : 100))); schedule(); }
      else if (keys[str] && session && index === frames.length - 1) { running = false; session.act(keys[str]); index = frames.length - 1; }
      draw();
    } catch (e) { finish(e); }
  });
  schedule(); draw();
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
