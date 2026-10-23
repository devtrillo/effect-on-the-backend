import { Context, Schema } from "effect"
import { HttpApiMiddleware, HttpApiSecurity } from "effect/http-api"
import type { User } from "./User.ts"

// The user behind the bearer token. Only the Authorization middleware provides it.
export class CurrentUser extends Context.Service<CurrentUser, User>()("CurrentUser") {}

export class Unauthorized extends Schema.TaggedError<Unauthorized>()(
  "Unauthorized",
  {},
  { httpApiStatus: 401 },
) {}

// The contract half: where the credential comes from, what it provides, how it fails.
// The implementation is AuthorizationLive in main.ts, so the client never imports it.
export class Authorization extends HttpApiMiddleware.Service<Authorization, {
  provides: CurrentUser
}>()("Authorization", {
  security: { bearer: HttpApiSecurity.bearer },
  error: Unauthorized,
}) {}
