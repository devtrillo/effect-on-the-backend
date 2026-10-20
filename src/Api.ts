import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api"
import { NewUser, User, UserParams } from "./User.ts"

export const UsersGroup = HttpApiGroup.make("users").add(
  HttpApiEndpoint.get("get", "/users/:id", {
    params: UserParams,
    success: User,
  }),
  HttpApiEndpoint.post("create", "/users", {
    payload: NewUser,
    success: User.pipe(HttpApiSchema.status(201)),
  }),
)

export const Api = HttpApi.make("api").add(UsersGroup)
