// Runnable: node --env-file-if-exists=.env src/part-9/gotchas.ts
// Needs the database from compose.yaml. Uses its own gotcha_* tables and drops them first.
import { NodeServices } from "@effect/platform-node"
import { PgClient, PgMigrator } from "@effect/sql-pg"
import { Config, Effect, Layer, Schema } from "effect"
import { SqlClient, SqlSchema } from "effect/sql"
import { User } from "../User.ts"

const program = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  yield* sql`DROP TABLE IF EXISTS gotcha_migrations, gotcha_one, gotcha_two, gotcha_three, gotcha_four, gotcha_five`

  // 1. Values become parameters. Only sql("...") puts text into the query, quoted as an identifier.
  const name = "Robert'); DROP TABLE users;--"
  console.log("value           ", JSON.stringify(sql`SELECT * FROM users WHERE name = ${name}`.compile()))
  console.log("identifier      ", JSON.stringify(sql`SELECT ${sql("name")} FROM ${sql("users")}`.compile()))
  console.log("insert          ", JSON.stringify(sql`INSERT INTO users ${sql.insert({ name: "Grace", email: "grace@example.com" })}`.compile()))

  // 2. bigint columns come back as JS bigints, and User.id is a string.
  const raw = SqlSchema.findOne({
    Request: Schema.String,
    Result: User,
    execute: (id) => sql`SELECT id, name, email FROM users WHERE id = ${id}`,
  })
  const rawError = yield* Effect.flip(raw("1"))
  console.log("bigint id       ", rawError._tag, rawError.message.replaceAll("\n", " "))

  // 3. The migrator only runs ids above the highest one it has recorded.
  const migrate = (migrations: Record<string, Effect.Effect<void, unknown, SqlClient.SqlClient>>) =>
    PgMigrator.run({ loader: PgMigrator.fromRecord(migrations), table: "gotcha_migrations" }).pipe(
      Effect.map((done) => JSON.stringify(done)),
      Effect.catchCause((cause) => Effect.succeed(String(cause).split("\n")[0])),
    )
  const create = (table: string) => Effect.asVoid(sql`CREATE TABLE ${sql(table)} (id int)`)
  console.log("1 and 3         ", yield* migrate({ "1_one": create("gotcha_one"), "3_three": create("gotcha_three") }))
  console.log("then add 2      ", yield* migrate({ "1_one": create("gotcha_one"), "2_two": create("gotcha_two"), "3_three": create("gotcha_three") }))
  const tables = yield* sql<{ name: string }>`SELECT tablename AS name FROM pg_tables WHERE tablename LIKE 'gotcha_%' ORDER BY 1`
  console.log("tables          ", tables.map((t) => t.name).join(", "))

  // 4. A failing migration rolls back, its table and its row in the migrations table.
  console.log("4 fails         ", yield* migrate({ "4_four": Effect.andThen(create("gotcha_four"), sql`SELECT 1/0`) }))
  const four = yield* sql`SELECT 1 FROM pg_tables WHERE tablename = 'gotcha_four'`
  const recorded = yield* sql<{ id: number }>`SELECT migration_id AS id FROM gotcha_migrations ORDER BY 1`
  console.log("after 4         ", `gotcha_four exists: ${four.length > 0}, recorded: ${recorded.map((r) => r.id).join(", ")}`)

  // 5. Two instances starting at once: the table lock makes the second wait, then it has nothing to do.
  const slow = { "5_five": Effect.andThen(sql`SELECT pg_sleep(0.5)`, create("gotcha_five")) }
  const [a, b] = yield* Effect.all([migrate(slow), migrate(slow)], { concurrency: 2 })
  console.log("two at once     ", a, b)

  yield* sql`DROP TABLE IF EXISTS gotcha_migrations, gotcha_one, gotcha_two, gotcha_three, gotcha_four, gotcha_five`
})

const PgLive = PgClient.layerConfig({ url: Config.Redacted("DATABASE_URL") })
await Effect.runPromise(program.pipe(Effect.provide(Layer.merge(PgLive, NodeServices.layer))))
