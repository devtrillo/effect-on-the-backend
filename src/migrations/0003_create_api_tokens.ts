import { Effect } from "effect"
import { SqlClient } from "effect/sql"

// Bearer tokens are stored hashed. actor_id records who created a user; older events have none.
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  yield* sql`
    CREATE TABLE api_tokens (
      token_hash text PRIMARY KEY,
      user_id bigint NOT NULL REFERENCES users (id),
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `
  yield* sql`ALTER TABLE user_events ADD COLUMN actor_id bigint REFERENCES users (id)`
})
