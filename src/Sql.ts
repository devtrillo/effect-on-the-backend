import { NodeServices } from "@effect/platform-node"
import { PgClient, PgMigrator } from "@effect/sql-pg"
import { Config, Layer } from "effect"

const PgLive = PgClient.layerConfig({ url: Config.Redacted("DATABASE_URL") })

// Runs every migration in src/migrations that the database hasn't seen, while the layer builds.
const MigratorLive = PgMigrator.layer({
  loader: PgMigrator.fromFileSystem(`${import.meta.dirname}/migrations`),
}).pipe(Layer.provide(NodeServices.layer))

// provideMerge: the migrator needs the client, and so does everything built on SqlLive.
export const SqlLive = MigratorLive.pipe(Layer.provideMerge(PgLive))
