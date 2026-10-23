import { NodeRuntime } from "@effect/platform-node"
import { Effect, Layer, Redacted } from "effect"
import { SqlLive } from "./Sql.ts"
import { Tokens } from "./Tokens.ts"

// npm run token -- 1   prints a new bearer token for user 1. It's stored hashed, so this is the only time you see it.
const userId = process.argv[2] ?? "1"

Tokens.use((tokens) => tokens.issue(userId)).pipe(
  Effect.flatMap((token) => Effect.sync(() => console.log(Redacted.value(token)))),
  Effect.provide(Tokens.layer.pipe(Layer.provide(SqlLive))),
  NodeRuntime.runMain,
)
