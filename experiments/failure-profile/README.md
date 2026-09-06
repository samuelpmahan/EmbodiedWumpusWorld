# Failure profile: interpretation is not one stage

Four fresh learner sessions, one response each, no feedback or tools: Luna low/medium and Terra low/medium. Each received three tasks. We requested complete compatible worlds, each world's prior weight, numerator, denominator, quotient, and confidence. Raw returned text is preserved in `raw/`, including malformed JSON. The deterministic profiler runs through PxC with integer prior units (p=3/10; four cells; denominator 10000).

## Controlled task changes

- Familiar: Wumpus cells ABCD; breezes AB, BC, CD mean at least one pit; query B.
- Neutral: switches KMRZ; lamps MR, RZ, KM mean at least one switch on; query M. This is isomorphic to Familiar, with renamed variables, changed story, and reordered observations.
- Changed rule: Wumpus variant; sensors AB, BC, CD mean exactly one pit; query B.

All cells independent, p=.3; unlisted variables in a world are false. Low-effort sessions saw Familiar → Neutral → Changed rule; medium saw the reverse. This order is confounded with effort and cannot establish an effort effect. Within-session cases can influence each other. No answer key was shown. The profile is descriptive, not a training-contamination test or model ranking.

## Results

| Session | Familiar | Neutral | Changed rule | Response format |
|---|---|---|---|---|
| Luna low | Wrong world weight | Same wrong world weight | Correct | Valid |
| Luna medium | Correct | Correct | Correct | Valid |
| Terra low | Correct recovered task | Correct recovered task | Correct recovered task | Invalid JSON |
| Terra medium | Missing ACD world | Missing KMZ world | Correct | Valid |

The correct Familiar/Neutral numerator is .153, denominator .216, answer 17/24. The exactly-one task retains AC and BD, total mass .0882 and answer .5.

### Failure 1: a wrong local weight propagates coherently

Luna low lists all eight compatible worlds but gives the all-four-true assignment .008 instead of .0081 (=.3^4). Its reported numerator .1529 and denominator .2159 correctly sum its wrong ledger. Its quotient correctly divides those wrong totals. This localizes the observable defect to a world weight. It does not reveal whether the cause was arithmetic, truncation, transcription, or something else internal. The same mistake appears in the neutral task; the repeated error may reflect within-response reuse.

### Failure 2: correct membership checks do not establish completeness

Terra medium never lists an incompatible world. However, it omits ACD in Familiar and KMZ in Neutral. Every listed weight is right; both totals and division agree with the incomplete list. Omitting ACD removes a non-query world and inflates the answer to .7762557078. Omitting KMZ removes a query world and depresses it to .6803652968.

This is a completeness/enumeration failure in the submitted representation. It does not establish that the model misunderstood the breeze predicate. Renaming did not eliminate the failure, but changed which world was missed; this single paired observation cannot identify why.

### Failure 3: correct recoverable math, unusable response

Terra low emits malformed JSON, prematurely closing the enclosing tasks structure. The profiler extracts intact task objects for diagnosis and finds their math correct. It still marks the response `formatValid:false`; recovered correctness is not counted as a clean end-to-end pass.

### Confidence did not flag these failures

All twelve returned task objects report confidence 1, including four wrong numeric answers. That is a failure signal in these particular outputs, not a population calibration estimate. The confidence field is self-report, not access to internal certainty.

## What this says about familiarity

Recognition of familiar rules would not guarantee exhaustive enumeration, correct weights, correct aggregation, or valid serialization. All returned individual worlds obey their supplied rule, including the exactly-one override. That weakens a simple story of blindly substituting standard breeze semantics in these tasks; it does not rule out memorization or show novel learning. XOR and these small graphs may themselves be familiar.

Our earlier phrase “interpretation can fail” was too coarse. The measurable boundaries are: rule compatibility, completeness, per-world weighting, aggregation, division, and output format. All four fresh sessions had more detailed elicitation than the earlier teaching cohort. Luna medium passes here after failing a weight total earlier; that is variability across prompts/samples, not demonstrated improvement.

## Implication for LAB

The operational solver already rejects incomplete certificates and owns the arithmetic. The profile explains why both controls matter: checking only that every submitted world is legal lets omissions slip through, and checking only the final division accepts consistently propagated upstream errors. The next teaching feedback should name a missing world and the constraints it satisfies; after the world set passes, arithmetic stays in PxC.

## Reproduce

```sh
node experiments/failure-profile/run.js
node --test tests/failure-profile.test.js
```

`results.json` is generated, not hand-scored. `src/failure-profile.js` is intentionally a bounded four-cell p=.3 oracle. It records named enumeration, compatibility, and resolution calculations. `earliestFailure` means earliest incorrect submitted layer, not an inferred chronological internal thought process. Parsing and schema failures are reported separately.

## Prompt record

Shared request: “Bounded diagnostic, not a teaching lesson. No tools, files, web, other agents. Three separate tasks; each variable independently true with p=.3. A listed set of true variables denotes a COMPLETE world (unlisted false). Return JSON only {tasks:[{id,worlds:[{true:[names],weight:number}],numerator:number,denominator:number,answer:number,confidence:number}],notes:string}. Enumerate every compatible world with its PRIOR weight, numerator = compatible prior mass where query variable true, denominator = all compatible prior mass. Confidence 0..1 is reported confidence only.”

Task text supplied: familiar — “Wumpus pits A B C D; perfect breeze reports AT LEAST ONE pit in each of AB, BC, CD; query P(B).” Neutral — “switches K M R Z; a lamp lights iff AT LEAST ONE named switch is on; lamps over MR, RZ, KM all lit; query P(M).” Changed rule — “Wumpus VARIANT pits A B C D; sensor reports true iff EXACTLY ONE named cell contains a pit (not standard breeze); sensors AB, BC, CD all true; query P(B).”

Closing instruction: “Follow supplied rules. Do not infer hidden values. No feedback will be supplied during these tasks.” Each session used the task ordering documented above and a fresh context without earlier learner answers.
