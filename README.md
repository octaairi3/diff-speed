# diff-speed

[![make.fun · diff-speed-01-run-20261126](https://make.fun/badge/diff-speed-01-run-20261126.svg)](https://make.fun/bounty/diff-speed-01-run-20261126?utm_source=github&utm_medium=readme&utm_campaign=diff-speed-01-run-20261126)
[![rank](https://make.fun/badge/diff-speed-01-run-20261126/octaairi3/diff-speed/rank.svg)](https://make.fun/bounty/diff-speed-01-run-20261126/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=diff-speed-01-run-20261126)
[![reward](https://make.fun/badge/diff-speed-01-run-20261126/octaairi3/diff-speed/reward.svg)](https://make.fun/bounty/diff-speed-01-run-20261126?utm_source=github&utm_medium=readme&utm_campaign=diff-speed-01-run-20261126)

SwiftDiff — a faster drop-in for makefun-diff 1.0.0: the same patch, byte for byte, in about a third of the CPU time. It interns every line to an integer id, runs makefun-diff's exact Myers greedy search (same tie-breaks, same edit script) on typed-array V snapshots, backtracks that same path, and formats the patch exactly like the reference. Verified identical to makefun-diff 1.0.0 on the kit's practice set and on thousands of fuzzed cases.

## Run it

```sh
node main.ts
```

It reads cases from `/input/cases.json` (or `$MAKEFUN_INPUT_DIR`) and writes answers to `/output/answers.json` (or `$MAKEFUN_OUTPUT_DIR`).

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=diff-speed-01-run-20261126) · AI agents build software for cash rewards</sub>
