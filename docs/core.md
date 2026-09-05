# Core API

The core is a small, importable boundary for the embodied Wumpus world. Public state is exposed through readonly views: callers may inspect a snapshot, but cannot mutate hidden engine state through an object reference. `executeTick` is the state transition seam; `createWorld` creates an initial world and `getWorldView` projects its public view.

## Math primitives

`src/core/math.js` contains pure helpers shared by world rules and material or calculation LAB experiments:

- `point(x, y)` creates a frozen integer grid point. Coordinates use `x` to the right and `y` downward.
- `addPoints(a, b)` returns a new point; neither input is changed.
- `manhattanDistance(a, b)` returns `abs(a.x-b.x) + abs(a.y-b.y)`.
- `neighbors(origin, bounds?)` returns frozen point objects in north, east, south, west order. With `{ width, height }`, only cells in the half-open grid `[0,width) × [0,height)` are included.
- `intersection(a, b)` accepts iterables and returns a frozen array of unique values present in both. It preserves the first iterable's order and uses `Set`/SameValueZero equality.
- `rectangleIntersection(a, b)` intersects integer, axis-aligned, half-open rectangles. It returns a frozen rectangle with positive area, or `null` for edge-only/disjoint overlap.

All helpers validate their inputs and avoid shared mutable state, so they are suitable for deterministic rule calculations and focused experiments.

## Provenance and composition

This is a narrow extraction for the Wumpus LAB. PxC and tracked access patterns are adapted from the ChainSpot reference packages at `packages/alg/src/exec/{board,contract,gateway,pcr,feature-set}.ts`; this does not claim to extract the full ChainSpot engine. Any material, provenance, or composition metadata is optional and descriptive. It can record where an observation came from or how a result was composed, but it does not grant access to engine internals and is not required for ordinary world execution.

Composition must preserve the readonly-view policy: metadata and derived values may be copied into a view, while mutable registries, random sources, and other hidden state remain private to the core implementation.

## Tick testimony

Each successful `executeTick` receipt records `calculations`: one captured record for every scoped `call('fn.*', args)` in call order. A record contains its `address`, captured `input` and `output`, and an explicit limitation: the core records the registered address only, not a function-body hash, closure, or transitive dependency hash. Receipt objects, arrays, and ordinary nested objects are recursively frozen. Typed arrays, `ArrayBuffer`s, `Map`s, and `Set`s cannot be made reliably immutable by JavaScript; they are instead copied before receipt exposure, so mutating a receipt cannot mutate PxC state or a calculation's stored input/output.

## Probability primitives

`conditionWeights(items, likelihood)` computes a normalized posterior over an iterable of object records. Each record's prior is its finite, non-negative `weight`, defaulting to `1`; `likelihood(record, index)` must return a finite, non-negative number. The posterior mass is `prior × likelihood`, and the function returns a frozen array of frozen shallow copies with `weight` replaced by the normalized mass. Other enumerable metadata is preserved and the inputs are not mutated. An empty input, an all-zero likelihood, or any non-finite total throws a `RangeError`; malformed inputs throw `TypeError`.

`marginalProbability(items, predicate)` returns the fraction of total prior weight for which `predicate(record, index)` is truthy. It uses the same `weight` default and validation as `conditionWeights`, does not mutate inputs, and throws `RangeError` when the total prior weight is zero or non-finite.
