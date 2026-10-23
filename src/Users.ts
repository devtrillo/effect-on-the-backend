import { Context, Effect, Layer, Schema } from "effect"
import { SqlClient, SqlSchema } from "effect/sql"
import { Ids } from "./Ids.ts"
import { NewUser, User } from "./User.ts"

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
  const sql = yield* SqlClient.SqlClient

  // Postgres returns bigint ids as JS bigints. User.id is a string, so cast in the query.
  const findById = SqlSchema.findOne({
    Request: Schema.String,
    Result: User,
    execute: (id) => sql`SELECT id::text, name, email FROM users WHERE id = ${id}`,
  })
  const insert = SqlSchema.findOne({
    Request: NewUser,
    Result: User,
    execute: (input) => sql`INSERT INTO users ${sql.insert(input)} RETURNING id::text, name, email`,
  })

  return {
    find: Effect.fn("Users.find", { attributes: { "db.system": "postgresql" } })(
      function* (id: string) {
        yield* Effect.annotateCurrentSpan("user.id", id)
        return yield* findById(id).pipe(
          Effect.catchTag("NoSuchElementError", () => new UserNotFound({ id })),
        )
      },
      // A database or decoding failure isn't the caller's problem: it's a defect, and a 500.
      Effect.catchTags({ SqlError: Effect.die, SchemaError: Effect.die }),
    ),
    create: Effect.fn("Users.create", { attributes: { "db.system": "postgresql" } })(
      function* (input: NewUser) {
        const user = yield* insert(input)
        yield* Effect.annotateCurrentSpan("user.id", user.id)
        return user
      },
      Effect.catchTags({ SqlError: Effect.die, SchemaError: Effect.die, NoSuchElementError: Effect.die }),
    ),
  }
})

// Parts 1 to 8 kept users in a Map. Their side files still run against this version.
export const makeMemory = Effect.gen(function* () {
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
  // Needs SqlClient. main.ts provides it once, outside HttpRouter.serve, so the whole server shares one pool.
  static readonly layer = Layer.effect(this, this.make)
  static readonly layerMemory = Layer.effect(this, makeMemory).pipe(Layer.provide(Ids.layer))
}
