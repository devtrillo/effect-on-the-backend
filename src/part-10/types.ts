// Type-check only. Each @ts-expect-error marks a line that must not compile.
import { Effect } from "effect"
import { SqlClient, SqlError } from "effect/sql"

const firstPid = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  const conn = yield* sql.reserve
  return yield* conn.execute("SELECT pg_backend_pid() AS pid", [], undefined)
})

// reserve needs a Scope, and so does everything that yields it until something closes one.
// @ts-expect-error Type 'SqlClient | Scope' is not assignable to type 'SqlClient'
export const Leaked: Effect.Effect<unknown, SqlError.SqlError, SqlClient.SqlClient> = firstPid

// Effect.scoped opens the scope, runs the effect, and closes it: the connection goes back to the pool.
export const Returned: Effect.Effect<unknown, SqlError.SqlError, SqlClient.SqlClient> = Effect.scoped(firstPid)

// withTransaction adds SqlError to whatever the effect could already fail with.
const failing = Effect.fail("nope" as const)
// @ts-expect-error Type 'SqlError' is not assignable to type '"nope"'
export const NoSqlError: Effect.Effect<never, "nope", SqlClient.SqlClient> = SqlClient.SqlClient.use((sql) =>
  sql.withTransaction(failing),
)
