import { Context, Data, Effect, Layer } from "effect"

export interface User {
  readonly id: string
  readonly name: string
}

export class UserNotFound extends Data.TaggedError("UserNotFound")<{
  readonly id: string
}> {
  override get message() {
    return `user ${this.id} not found`
  }
}

const make = Effect.sync(() => {
  const rows = new Map<string, User>([["1", { id: "1", name: "Ada" }]])
  return {
    find: Effect.fn("Users.find", { attributes: { "db.system": "memory" } })(
      function* (id: string) {
        yield* Effect.annotateCurrentSpan("user.id", id)
        const user = rows.get(id)
        if (!user) return yield* new UserNotFound({ id })
        return user
      },
    ),
  }
})

export class Users extends Context.Service<Users>()("Users", { make }) {
  static readonly layer = Layer.effect(this, this.make)
}
