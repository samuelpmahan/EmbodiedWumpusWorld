import { createPxC, executeTick, conditionWeights, marginalProbability, math } from './core/index.js';

/** One reusable composition: independent binary prior -> observation -> posterior. */
export function breezeExperiment(pitPrior = 0.2) {
  if (!Number.isFinite(pitPrior) || pitPrior < 0 || pitPrior > 1) throw Error('Prior must lie in [0,1]');
  const pxc = createPxC();
  pxc.set('px.prior', { pitProbability: pitPrior, assumption: 'independent pits in A and B' });
  pxc.set('px.neighborhood', { cells: ['A', 'B'], sensor: 'perfect adjacent-pit breeze' });
  pxc.set('px.observation', { breeze: true });
  pxc.register('fn.independentBinaryPrior', p => [
    { label: 'Neither', pits: [], weight: (1-p) ** 2 },
    { label: 'A only', pits: ['A'], weight: p*(1-p) },
    { label: 'B only', pits: ['B'], weight: p*(1-p) },
    { label: 'Both', pits: ['A','B'], weight: p*p },
  ]);
  pxc.register('fn.conditionWeights', ({ hypotheses, breeze, cells }) =>
    conditionWeights(hypotheses, h => Number((math.intersection(h.pits,cells).length > 0) === breeze)));
  const records = [];
  records.push(executeTick(pxc, { id: 'prior', consumes: ['px.prior'], produces: ['px.hypotheses'],
    run: b => b.set('px.hypotheses', b.call('fn.independentBinaryPrior', b.get('px.prior').pitProbability)) }));
  records.push(executeTick(pxc, { id: 'condition', consumes: ['px.hypotheses','px.observation','px.neighborhood'], produces: ['px.posterior'],
    run: b => b.set('px.posterior', b.call('fn.conditionWeights', { hypotheses: b.get('px.hypotheses'), breeze: b.get('px.observation').breeze, cells:b.get('px.neighborhood').cells })) }));
  const posterior = pxc.get('px.posterior');
  return { prior: pitPrior, hypotheses: pxc.get('px.hypotheses'), posterior,
    probabilityA: marginalProbability(posterior, h => h.pits.includes('A')), records };
}

export function materializePriors(result) {
  const pct = n => (n*100).toFixed(2).padStart(7) + '%';
  return ['WHY THIS BELIEF? — observed breeze; adjacent cells A and B',
    `Assumption: independent pit probability ${result.prior}; perfect sensor`, '',
    'Possibility      Prior  Posterior',
    ...result.hypotheses.map((h,i) => `${h.label.padEnd(12)} ${pct(h.weight)} ${pct(result.posterior[i].weight)}`),
    '', `P(pit at A | breeze) = ${pct(result.probabilityA).trim()}`,
    'Composition: independent prior → likelihood filter → normalize → marginalize',
    'Materials: px.prior · px.neighborhood · px.observation · px.hypotheses · px.posterior'].join('\n');
}
