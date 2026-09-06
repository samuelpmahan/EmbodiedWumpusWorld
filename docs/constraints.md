# Constraints and provenance

Constraints are plain data that can be evaluated without changing PxC state. A leaf names the stored materials its predicate needs:

```js
{
  kind: 'constraint',
  id: 'safe-next-cell',
  label: 'Next cell is safe',
  materials: { belief: 'px.agent.beliefs', action: 'px.action' },
  predicate: 'fn.constraint.safeNextCell',
  basis: { observations: ['px.percept.latest'], assumptions: ['px.assumption.perfectSensors'] }
}
```

`evaluateConstraint(pxc, node)` reads every material and every basis address only after `pxc.has`. It calls the registered `fn.*` predicate with `{ materials, observations, assumptions }`: `materials` is keyed by semantic material name, while `observations` and `assumptions` map each basis address to its captured value. It returns a judgment with `status` (`satisfied`, `violated`, or `unknown`), a reason, the constraint id, and the addresses read or missing. Predicates may return a boolean or a judgment object with a valid status plus optional `reason`, `measurements`, and `details`. A missing material or basis value produces `unknown` without invoking the predicate. Malformed definitions, empty groups, and malformed predicate results are rejected with errors; runtime errors from predicates remain visible to the caller.

A group has `kind: 'constraint-group'`, `operator: 'all' | 'any'`, and a non-empty `members` array. Groups preserve their child judgments and use three-valued logic: `all` is violated by any violated child and `any` is satisfied by any satisfied child; otherwise an unknown child keeps the applicable group unknown. Callers decide whether and how to record evaluation results in a tick receipt.

`traceAddress(records, address, { beforeIndex })` turns execute-tick receipts into a JSON-friendly explanation tree. Each node contains its address, the latest strictly preceding producer (when one exists), captured value, input trees, and calculation addresses. An input can bind only to a write from an earlier receipt, so it cannot depend on the producer's own output or a later tick. Leaf inputs retain their captured receipt value. `beforeIndex` is an exclusive receipt index for inspecting history at a prior point.
