import { Context, Data, Effect, Layer } from "effect"

export interface User {
  readonly id: string
  readonly name: string
}

export class UserNotFound extends Data.TaggedError("UserNotFound")<{
  readonly id: string
}> {}

const make = Effect.sync(() => {
  const rows = new Map<string, User>([["1", { id: "1", name: "Ada" }]])
  return {
    find: (id: string) => {
      const user = rows.get(id)
      return user ? Effect.succeed(user) : Effect.fail(new UserNotFound({ id }))
    },
  }
})

export class Users extends Context.Service<Users>()("Users", { make }) {
  static readonly layer = Layer.effect(this, this.make)
}
