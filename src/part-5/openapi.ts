// Runnable: node src/part-5/openapi.ts
// Prints the parts of the generated OpenAPI document that don't match what the server does.
import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/http-api"
import { Api } from "../Api.ts"

const spec = OpenApi.fromApi(Api)
const get = spec.paths["/users/{id}"]?.get
const create = spec.paths["/users"]?.post

console.log("GET  /users/{id} responses:", Object.keys(get?.responses ?? {}))
console.log("POST /users responses:     ", Object.keys(create?.responses ?? {}))
console.log("POST /users body:", JSON.stringify(create?.requestBody?.content["application/json"]?.schema))
console.log("components:", Object.keys(spec.components.schemas))

// The same endpoint with a numeric id, to see how Schema.Int is documented.
const IntApi = HttpApi.make("int").add(
  HttpApiGroup.make("users").add(
    HttpApiEndpoint.get("get", "/users/:id", { params: { id: Schema.Int } }),
  ),
)
const param = OpenApi.fromApi(IntApi).paths["/users/{id}"]?.get?.parameters[0]
const pattern = (param?.schema as { pattern?: string } | undefined)?.pattern ?? ""
console.log("Int id pattern:", pattern)
console.log('pattern matches "1.5":', new RegExp(pattern).test("1.5"))
