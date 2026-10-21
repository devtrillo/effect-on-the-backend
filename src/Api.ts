import { Schema } from "effect"
import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiMiddleware,
  HttpApiSchema,
} from "effect/http-api"
import { NewUser, User, UserParams } from "./User.ts"
import { UserNotFound } from "./Users.ts"

export class BadRequest extends Schema.TaggedError<BadRequest>()(
  "BadRequest",
  {
    issues: Schema.Array(Schema.Struct({ message: Schema.String, path: Schema.Array(Schema.String) })),
  },
  { httpApiStatus: 400 },
) {}

export class Validation extends HttpApiMiddleware.Service<Validation>()("Validation", {
  error: BadRequest,
}) {}

export const UsersGroup = HttpApiGroup.make("users").add(
  HttpApiEndpoint.get("get", "/users/:id", {
    params: UserParams,
    success: User,
    error: UserNotFound,
  }),
  HttpApiEndpoint.post("create", "/users", {
    payload: NewUser,
    success: User.pipe(HttpApiSchema.status(201)),
  }),
)

export const Api = HttpApi.make("api")
  .add(UsersGroup)
  .middleware(Validation)
  .annotate(HttpApi.PayloadParseOptions, { errors: "all" })
