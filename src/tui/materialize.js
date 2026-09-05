const glyph = { east: 'A>', west: '<A', north: 'A^', south: 'Av' };

/** The terminal and debug output are projections of the same recorded frame. */
export function materialize(frame, { reveal = false, mode = 'play', inspect = false } = {}) {
  const { world: w, percept: p, policy } = frame;
  const belief = policy?.belief ?? policy?.beliefs;
  const observations = belief?.observations ?? [];
  const visited = new Set((policy?.visited ?? []).map(p => p.join(',')));
  visited.add(`${w.agent.x},${w.agent.y}`);
  const rows = [];
  for (let y = w.size; y >= 1; y--) {
    const cells = [];
    for (let x = 1; x <= w.size; x++) {
      const here = w.agent.x === x && w.agent.y === y;
      let value = visited.has(`${x},${y}`) ? '.' : '?';
      if (reveal) {
        value = [w.pits.some(p => p.x === x && p.y === y) ? 'P' : '',
          w.wumpus.x === x && w.wumpus.y === y ? (w.wumpus.alive ? 'W' : 'w') : '',
          !w.agent.hasGold && w.gold.x === x && w.gold.y === y ? 'G' : ''].join('') || '.';
      }
      if (here) value = w.agent.alive ? glyph[w.agent.heading] : 'X';
      cells.push(value.padStart(5));
    }
    rows.push(`${String(y).padStart(2)} ${cells.join('')}`);
  }
  const lines = [`WUMPUS LAB | ${mode.toUpperCase()} | turn ${w.turn} | score ${w.score}`,
    reveal ? 'WORLD REVEAL — spectator only' : 'AGENT VIEW — ? means unvisited', '', ...rows,
    '   ' + Array.from({ length: w.size }, (_, i) => String(i + 1).padStart(5)).join(''), '',
    `Percept: ${['stench','breeze','glitter','bump','scream'].filter(k => p[k]).join(', ') || 'none'}`,
    `Arrow: ${w.agent.hasArrow ? 'yes' : 'no'}  Gold: ${w.agent.hasGold ? 'yes' : 'no'}  Heading: ${w.agent.heading}`,
    `Prior pit probability: ${belief?.pitPrior ?? 'policy-defined'} | surviving hypotheses: ${belief?.candidates?.length ?? 'unknown'}`,
    `Last action: ${w.lastAction ?? 'start'}${w.terminal ? ` | ${w.outcome ?? 'finished'}` : ''}`];
  if (inspect) {
    lines.push('', 'PIT BELIEFS — conditioned on received observations');
    for (let y = w.size; y >= 1; y--) lines.push(String(y).padStart(2) + ' ' +
      Array.from({length:w.size}, (_,i) => {
        const risk = belief?.pitProbabilities?.[`${i+1},${y}`];
        return (risk === undefined ? '?' : (risk*100).toFixed(0)+'%').padStart(5);
      }).join(''));
    lines.push('Assumptions: independent pits; perfect breeze sensor; start safe.',
      'Built-in policy currently models pit risk; Wumpus risk is not inferred.',
      '', 'RECENT OBSERVATIONS', ...observations.slice(-5).map(o => JSON.stringify(o)),
      '', 'RECENT TICKS');
    for (const r of frame.records ?? []) lines.push(`${r.invocationId} ${r.id}: ${(r.actualConsumes ?? []).join(', ')} -> ${(r.actualProduces ?? []).join(', ')}`,
      ...((r.calculations ?? []).map(c=>`  ${c.address}`)));
  }
  return lines.join('\n');
}
