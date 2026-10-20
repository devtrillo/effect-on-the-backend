// Type-check only: `npm run check` proves each claim below.
import { Effect, Schema } from "effect"
import { HttpRouter, HttpServerError, HttpServerRequest } from "effect/http"
import { NewUser, UserParams } from "../User.ts"

// Path params arrive as strings, so the schema's encoded side has to be a string.
// @ts-expect-error TS2345: Type '{ readonly id: number; }' is not assignable to type 'Readonly<Record<string, string | undefined>>'.
HttpRouter.schemaPathParams(Schema.Struct({ id: Schema.Number }))

// A decoded id is branded. A plain string is not a UserId.
// @ts-expect-error TS2322: Type 'string' is not assignable to type 'string & Brand<"UserId">'.
export const fake: typeof UserParams.Type = { id: "1" }

// Bad JSON and a bad shape are two different errors.
const body = HttpServerRequest.schemaBodyJson(NewUser)
export const errors: Effect.Error<typeof body> extends
  | HttpServerError.HttpServerError
  | Schema.SchemaError
  ? true
  : false = true

// The wire format and the value the handler gets.
export type Wire = typeof NewUser.Encoded
export type Decoded = typeof NewUser.Type
