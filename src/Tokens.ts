import { Context, Effect, Layer, Redacted, Schema } from "effect"
import { SqlClient, SqlSchema } from "effect/sql"
import { createHash, randomBytes } from "node:crypto"
import { Unauthorized } from "./Auth.ts"
import { User } from "./User.ts"

const hash = (token: string) => createHash("sha256").update(token).digest("hex")

const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  const findByHash = SqlSchema.findOne({
    Request: Schema.String,
    Result: User,
    execute: (tokenHash) => sql`
      SELECT u.id::text, u.name, u.email
      FROM api_tokens t JOIN users u ON u.id = t.user_id
      WHERE t.token_hash = ${tokenHash}
    `,
  })

  return {
    // The token is shown once. The table only ever sees its hash.
    issue: Effect.fn("Tokens.issue")(
      function* (userId: string) {
        const token = randomBytes(32).toString("base64url")
        yield* sql`INSERT INTO api_tokens ${sql.insert({ token_hash: hash(token), user_id: userId })}`
        return Redacted.make(token)
      },
      Effect.catchTag("SqlError", Effect.die),
    ),
    // A missing header arrives here as an empty token, and fails the lookup like a wrong one.
    verify: Effect.fn("Tokens.verify")(
      function* (token: Redacted.Redacted) {
        return yield* findByHash(hash(Redacted.value(token))).pipe(
          Effect.catchTag("NoSuchElementError", () => new Unauthorized()),
        )
      },
      Effect.catchTags({ SqlError: Effect.die, SchemaError: Effect.die }),
    ),
  }
})

export class Tokens extends Context.Service<Tokens>()("Tokens", { make }) {
  // Needs SqlClient, like Users.layer.
  static readonly layer = Layer.effect(this, this.make)
}
