// Run with: node src/part-1/option-is-not-an-effect.ts
import { Effect, Option } from "effect"

// @ts-expect-error Option is not an Effect in v4. The error lands here, on Effect.gen
const program: Effect.Effect<string> = Effect.gen(function* () {
  const id = yield* Option.some("1")
  return id
})

const exit = await Effect.runPromiseExit(program)
console.log(String(exit))
