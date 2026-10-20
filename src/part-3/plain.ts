// The same two routes with plain node:http and no Effect, for comparison.
// Run: node src/part-3/plain.ts
import { createServer } from "node:http"

const users = new Map([["1", { id: "1", name: "Ada" }]])

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost")
  const match = url.pathname.match(/^\/users\/([^/]+)$/)
  const user = match && users.get(match[1]!)
  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(200, { "content-type": "text/plain" }).end("ok")
  } else if (req.method === "GET" && user) {
    res.writeHead(200, { "content-type": "application/json" })
    res.end(JSON.stringify(user))
  } else {
    res.writeHead(404).end()
  }
})

server.listen(3000, () => console.log("Listening on http://localhost:3000"))

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)))
}
