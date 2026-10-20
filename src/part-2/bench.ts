// Run with: node src/part-2/bench.ts
// A rough microbenchmark. Order of magnitude only.
import { Effect } from "effect"

const N = 200_000

const gen = (n: number) => Effect.gen(function* () { return n + 1 })
const named = Effect.fn("named")(function* (n: number) { return n + 1 })
const untraced = Effect.fnUntraced(function* (n: number) { return n + 1 })

const time = (label: string, f: (n: number) => Effect.Effect<number>) =>
  Effect.gen(function* () {
    for (let round = 0; round < 2; round++) {
      const start = performance.now()
      for (let i = 0; i < N; i++) yield* f(i)
      const ns = ((performance.now() - start) * 1e6) / N
      if (round === 1) console.log(`${label.padEnd(18)} ${ns.toFixed(0)} ns/call`)
    }
  })

Effect.runSync(
  Effect.gen(function* () {
    yield* time("Effect.gen wrapper", gen)
    yield* time("Effect.fn(name)", named)
    yield* time("Effect.fnUntraced", untraced)
  }),
)
