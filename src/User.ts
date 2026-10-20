import { Schema } from "effect"

export const UserId = Schema.String.check(
  Schema.isPattern(/^[1-9][0-9]*$/, { message: "Expected a positive integer" }),
).pipe(Schema.brand("UserId"))
export type UserId = typeof UserId.Type

export const UserParams = Schema.Struct({ id: UserId })

export const NewUser = Schema.Struct({
  name: Schema.Trim.check(Schema.isMinLength(1), Schema.isMaxLength(100)),
  email: Schema.Trim.check(
    Schema.isPattern(/^[^@\s]+@[^@\s]+$/, { message: "Expected an email address" }),
  ),
})
export type NewUser = typeof NewUser.Type

export const User = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.optionalKey(Schema.String),
}).annotate({ identifier: "User" })
export type User = typeof User.Type
