import { Effect } from "effect"
import { SqlClient } from "effect/sql"

// One row per thing that happened to a user. Creating a user writes "created" in the same transaction.
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  yield* sql`
    CREATE TABLE user_events (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      user_id bigint NOT NULL REFERENCES users (id),
      type text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `
})
