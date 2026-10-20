import { Cause, Effect, Exit } from "effect"
import { getUser } from "./getUser.ts"
import { Users } from "./Users.ts"

for (const id of ["1", "2"]) {
  const exit = await Effect.runPromiseExit(
    getUser(id).pipe(Effect.provide(Users.layer)),
  )
  if (Exit.isSuccess(exit)) console.log(`found ${exit.value.name}`)
  else console.log(Cause.pretty(exit.cause))
}
