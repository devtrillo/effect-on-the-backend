// Part 1: what changed in Effect 4. Type-check only (`npm run check`); it
// imports packages that don't exist, so don't run it. Every @ts-expect-error
// below is a v3 name that is gone in 4.0.5, and the check fails if one returns.
import { Cause, Context, Effect, Fiber, Option, Ref, Result } from "effect"
import { HttpRouter } from "effect/http"
import { HttpApi } from "effect/http-api"
import { SqlClient } from "effect/sql"
// @ts-expect-error @effect/platform has no v4 release; HTTP lives in effect/http
import { HttpServer } from "@effect/platform"
// @ts-expect-error the unstable/ segment was dropped in 4.0.0
import { HttpRouter as OldRouter } from "effect/unstable/http"
// @ts-expect-error Either is now Result
import { Either } from "effect"
import { Users, UserNotFound } from "../Users.ts"

// Services: one way to define them.
// @ts-expect-error replaced by Context.Service
Context.Tag
// @ts-expect-error replaced by Context.Service
Effect.Tag
// @ts-expect-error replaced by Context.Service with `make`
Effect.Service

// No static accessors. Yield the service, or reach it with `use`.
export const findAda = Effect.gen(function* () {
  const users = yield* Users
  return yield* users.find("1")
})
export const viaUse = Users.use((users) => users.find("1"))

// Error handling: the catch family was renamed.
// @ts-expect-error now Effect.catch
Effect.catchAll
// @ts-expect-error now Effect.catchCause
Effect.catchAllCause
// @ts-expect-error now Effect.catchDefect
Effect.catchAllDefect
// @ts-expect-error now Effect.catchFilter
Effect.catchSome

//      ┌─── Effect<User | null, never, Users>
export const orNull = findAda.pipe(Effect.catch(() => Effect.succeed(null)))

// A Cause is a flat list of reasons: Fail, Die or Interrupt.
export const logged = findAda.pipe(
  Effect.catchCause((cause) => {
    for (const reason of cause.reasons) {
      if (reason._tag === "Fail") console.error("failed:", reason.error._tag)
      if (reason._tag === "Die") console.error("defect:", reason.defect)
    }
    return Effect.failCause(cause)
  }),
)

// Fewer things are Effects. Convert explicitly.
export const counted = Effect.gen(function* () {
  const ref = yield* Ref.make(0)
  // @ts-expect-error a Ref is not an Effect anymore
  yield* ref
  const n = yield* Ref.get(ref)
  const id = yield* Effect.fromOption(Option.some("1"))
  const ok = yield* Effect.fromResult(Result.succeed(true))
  return { n, id, ok }
})

// Forking: fork is forkChild, forkDaemon is forkDetach.
// @ts-expect-error now Effect.forkChild
Effect.fork
// @ts-expect-error now Effect.forkDetach
Effect.forkDaemon

export const joined = Effect.gen(function* () {
  const fiber = yield* Effect.forkChild(findAda)
  return yield* Fiber.join(fiber)
})

void HttpRouter, HttpApi, SqlClient, HttpServer, OldRouter, Either, Cause, UserNotFound
