import { Effect } from "effect"
import { type User, UserNotFound, Users } from "./Users.ts"

export const getUser = Effect.fn("getUser")(function* (
  id: string,
): Effect.fn.Return<User, UserNotFound, Users> {
  const users = yield* Users
  return yield* users.find(id)
})
