// Runnable: node --env-file-if-exists=.env src/part-10/gotchas.ts
// Needs the database from compose.yaml. Uses its own gotcha_* tables and drops them at the end.
import { PgClient } from "@effect/sql-pg"
import { Config, Effect, Fiber } from "effect"
import { SqlClient } from "effect/sql"

const program = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  yield* sql`DROP TABLE IF EXISTS gotcha_events, gotcha_users`
  yield* sql`CREATE TABLE gotcha_users (id int PRIMARY KEY, name text NOT NULL)`
  yield* sql`CREATE TABLE gotcha_events (user_id int NOT NULL REFERENCES gotcha_users (id), type text NOT NULL)`
  const users = sql<{ id: number }>`SELECT id FROM gotcha_users ORDER BY id`.pipe(
    Effect.map((rows) => JSON.stringify(rows.map((row) => row.id))),
  )
  const idleInTransaction = sql<{ n: number }>`
    SELECT count(*)::int AS n FROM pg_stat_activity WHERE state = 'idle in transaction'
  `.pipe(Effect.map((rows) => rows[0].n))

  // 1. Two writes, and the second one fails (its user_id doesn't exist).
  const twoWrites = (id: number) =>
    Effect.gen(function* () {
      yield* sql`INSERT INTO gotcha_users ${sql.insert({ id, name: "Grace" })}`
      yield* sql`INSERT INTO gotcha_events ${sql.insert({ user_id: id + 1000, type: "created" })}`
    })
  yield* Effect.flip(twoWrites(1))
  console.log("no transaction  ", "users:", yield* users)
  yield* Effect.flip(sql.withTransaction(twoWrites(2)))
  console.log("withTransaction ", "users:", yield* users)

  // 2. Interrupt a transaction halfway through a slow query.
  const started = Date.now()
  const slow = sql.withTransaction(
    Effect.gen(function* () {
      yield* sql`INSERT INTO gotcha_users ${sql.insert({ id: 3, name: "Slow" })}`
      yield* sql`SELECT pg_sleep(5)`
    }),
  )
  const exit = yield* Effect.exit(slow.pipe(Effect.timeout("500 millis")))
  console.log(
    "interrupted     ",
    `${exit._tag} after ${Math.round((Date.now() - started) / 100) * 100} ms, users: ${yield* users}, idle in transaction: ${yield* idleInTransaction}`,
  )

  // 3. A transaction is one connection. Concurrent queries inside it take turns.
  const backend = sql<{ pid: number }>`SELECT pg_backend_pid() AS pid, pg_sleep(0.1)`.pipe(
    Effect.map((rows) => rows[0].pid),
  )
  const three = Effect.all([backend, backend, backend], { concurrency: "unbounded" })
  const outside = yield* three
  const inside = yield* sql.withTransaction(three)
  console.log("connections     ", `outside: ${new Set(outside).size}, inside: ${new Set(inside).size}`)

  // 4. A fiber forked inside a transaction keeps the transaction's connection in its context.
  const child = yield* sql.withTransaction(
    Effect.gen(function* () {
      yield* sql`INSERT INTO gotcha_users ${sql.insert({ id: 4, name: "Parent" })}`
      return yield* Effect.forkDetach(
        Effect.andThen(Effect.sleep("100 millis"), sql`INSERT INTO gotcha_users ${sql.insert({ id: 5, name: "Child" })}`),
      )
    }),
  )
  const childError = yield* Effect.flip(Fiber.join(child))
  console.log("forked          ", `${childError.message}, users: ${yield* users}`)

  // 5. reserve: one connection, yours until the scope closes.
  const pids = yield* Effect.scoped(
    Effect.gen(function* () {
      const conn = yield* sql.reserve
      const first = yield* conn.execute("SELECT pg_backend_pid() AS pid", [], undefined)
      const second = yield* conn.execute("SELECT pg_backend_pid() AS pid", [], undefined)
      return [first, second].map((rows) => (rows[0] as { pid: number }).pid)
    }),
  )
  console.log("reserve         ", `same connection: ${pids[0] === pids[1]}`)

  // 6. acquireRelease: finalizers run when the scope closes, last acquired first, interruption included.
  const resource = (name: string) =>
    Effect.acquireRelease(
      Effect.sync(() => console.log("                 acquire", name)),
      (_, exit) => Effect.sync(() => console.log("                 release", name, exit._tag)),
    )
  const scoped = Effect.scoped(
    Effect.gen(function* () {
      yield* resource("connection")
      yield* resource("transaction")
      yield* Effect.never
    }),
  )
  console.log("scoped          ", (yield* Effect.exit(scoped.pipe(Effect.timeout("100 millis"))))._tag)

  yield* sql`DROP TABLE IF EXISTS gotcha_events, gotcha_users`
})

const PgLive = PgClient.layerConfig({ url: Config.Redacted("DATABASE_URL") })
await Effect.runPromise(program.pipe(Effect.provide(PgLive)))
