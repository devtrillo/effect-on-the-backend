// Type-check only. Each @ts-expect-error marks a line that must not compile.
import { NodeHttpServer } from "@effect/platform-node"
import { Config, Effect, Layer } from "effect"
import { HttpServer, HttpServerError } from "effect/http"
import { createServer } from "node:http"

// A Redacted is not a string. You have to take the value out on purpose.
export const Connect = Effect.gen(function* () {
  // @ts-expect-error Type 'Redacted<string>' is not assignable to type 'string'
  const url: string = yield* Config.Redacted("DATABASE_URL")
  return url
})

// A server layer that reads config can fail with ConfigError, and the type says so.
// @ts-expect-error Type 'ConfigError | ServeError' is not assignable to type 'ServeError'
export const NodeServer: Layer.Layer<HttpServer.HttpServer, HttpServerError.ServeError> =
  NodeHttpServer.layerConfig(createServer, { port: Config.Port("PORT") })
