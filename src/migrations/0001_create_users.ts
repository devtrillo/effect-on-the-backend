import { Effect } from "effect"
import { SqlClient } from "effect/sql"

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  yield* sql`
    CREATE TABLE users (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      name text NOT NULL,
      email text NOT NULL
    )
  `
  yield* sql`INSERT INTO users ${sql.insert({ name: "Ada", email: "ada@example.com" })}`
})
