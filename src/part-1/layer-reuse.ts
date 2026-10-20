// Run with: node src/part-1/layer-reuse.ts
import { Effect, Layer } from "effect"
import { Users } from "../Users.ts"

const layer = Layer.effect(
  Users,
  Users.make.pipe(Effect.tap(() => Effect.sync(() => console.log("building Users")))),
)

const program = Effect.gen(function* () {
  const users = yield* Users
  return yield* users.find("1")
})

// A helper that provides Users itself, called from a program that already did.
const nested = program.pipe(Effect.provide(layer))
await Effect.runPromise(nested.pipe(Effect.provide(layer)))
