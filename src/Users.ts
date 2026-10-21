import { Context, Effect, Layer, Schema } from "effect"
import { Ids } from "./Ids.ts"
import type { NewUser, User } from "./User.ts"

export type { User }

export class UserNotFound extends Schema.TaggedError<UserNotFound>()(
  "UserNotFound",
  { id: Schema.String },
  { httpApiStatus: 404 },
) {
  override get message() {
    return `user ${this.id} not found`
  }
}

const make = Effect.gen(function* () {
  const ids = yield* Ids
  const ada = yield* ids.next
  const rows = new Map<string, User>([[ada, { id: ada, name: "Ada" }]])
  return {
    find: Effect.fn("Users.find", { attributes: { "db.system": "memory" } })(
      function* (id: string) {
        yield* Effect.annotateCurrentSpan("user.id", id)
        const user = rows.get(id)
        if (!user) return yield* new UserNotFound({ id })
        return user
      },
    ),
    create: Effect.fn("Users.create", { attributes: { "db.system": "memory" } })(
      function* (input: NewUser) {
        const user: User = { id: yield* ids.next, ...input }
        rows.set(user.id, user)
        yield* Effect.annotateCurrentSpan("user.id", user.id)
        return user
      },
    ),
  }
})

export class Users extends Context.Service<Users>()("Users", { make }) {
  static readonly layer = Layer.effect(this, this.make).pipe(Layer.provide(Ids.layer))
}
