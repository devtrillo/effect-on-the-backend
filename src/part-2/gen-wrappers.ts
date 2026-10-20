// Run with: node src/part-2/gen-wrappers.ts
// The naive port: functions that return Effect.gen.
import { Cause, Effect, Exit } from "effect"
import { type User, UserNotFound } from "../Users.ts"

const rows = new Map<string, User>([["1", { id: "1", name: "Ada" }]])

const findUser = (id: string) =>
  Effect.gen(function* () {
    const user = rows.get(id)
    if (!user) return yield* new UserNotFound({ id })
    return user
  })

const getUser = (id: string) =>
  Effect.gen(function* () {
    return yield* findUser(id)
  })

const exit = await Effect.runPromiseExit(getUser("2"))
if (Exit.isFailure(exit)) console.log(Cause.pretty(exit.cause))
