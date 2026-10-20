// The Schema gotchas from the post, printed one per line.
// Run: node src/part-4/gotchas.ts
import { Schema } from "effect"
import { NewUser } from "../User.ts"

const show = (label: string, schema: Schema.Top, input: unknown) =>
  console.log(label.padEnd(36), String(Schema.decodeUnknownExit(schema as Schema.Codec<unknown>)(input)))

for (const s of ["42", "", " ", "0x10", "1e2", "12abc"]) {
  show(`FiniteFromString ${JSON.stringify(s)}`, Schema.FiniteFromString, s)
}
show(`NumberFromString "abc"`, Schema.NumberFromString, "abc")
show(`Date "2027-01-19"`, Schema.Date, "2027-01-19")
show(`DateFromString "2027-01-19"`, Schema.DateFromString, "2027-01-19")

const extra = { name: "Grace", email: "grace@example.com", isAdmin: true }
show("NewUser with isAdmin", NewUser, extra)
console.log(
  "NewUser, onExcessProperty: error".padEnd(36),
  String(Schema.decodeUnknownExit(NewUser)(extra, { onExcessProperty: "error" })),
)
