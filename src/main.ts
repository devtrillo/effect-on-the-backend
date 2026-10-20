import { Effect } from "effect"
import { Users } from "./Users.ts"

const program = Effect.gen(function* () {
  const users = yield* Users
  const user = yield* users.find("1")
  console.log(`found ${user.name}`)
})

Effect.runPromise(program.pipe(Effect.provide(Users.layer)))
