// Type-check only: `npm run check` proves each claim below.
import { Effect } from "effect"
import { type User, UserNotFound } from "../Users.ts"

const rows = new Map<string, User>([["1", { id: "1", name: "Ada" }]])

// Forgot `yield*`: the error is returned as a value, so it lands in the success type.
const findName = Effect.fn("findName")(function* (id: string) {
  const user = rows.get(id)
  if (!user) return new UserNotFound({ id })
  return user.name
})
// Compiles: the error channel is `never`.
export const loose: Effect.Effect<unknown, never> = findName("2")

// The same body with a return annotation fails to compile.
export const findNameStrict = Effect.fn("findNameStrict")(function* (
  id: string,
): Effect.fn.Return<string, UserNotFound> {
  const user = rows.get(id)
  // @ts-expect-error UserNotFound is not a string
  if (!user) return new UserNotFound({ id })
  return user.name
})

// Careful: an Error has a `name`, so UserNotFound fits the shape of User.
// This one compiles with the annotation and still puts the error in the success channel.
export const findUserStrict = Effect.fn("findUserStrict")(function* (
  id: string,
): Effect.fn.Return<User, UserNotFound> {
  const user = rows.get(id)
  if (!user) return new UserNotFound({ id })
  return user
})
