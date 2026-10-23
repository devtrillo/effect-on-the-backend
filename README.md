# Effect on the Backend

The code for the [Effect on the Backend](https://github.com/devtrillo/blog/issues/342) blog series: one backend server on Node, built with [Effect](https://effect.website) 4, one part at a time.

Each part of the series is a tag (`part-1`, `part-2`, …), so you can check out the code as it was at the end of any post.

```sh
npm install
npm run check
npm test
docker compose up -d --wait
cp .env.example .env
npm start
```

Requires Node 24+. Node runs the `.ts` files directly (type stripping), so there is no build step: imports use `.ts` extensions and the code sticks to erasable TypeScript syntax. Pinned to `effect` 4.0.5. From part 9 the server needs Postgres: `compose.yaml` runs one on port 5432, and migrations in `src/migrations` run at startup.

From part 11, `POST /users` needs a bearer token. `npm run -s token -- 1` prints a new one for user 1 (Ada):

```sh
TOKEN=$(npm run -s token -- 1)
curl -X POST localhost:3000/users -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{"name":"Grace","email":"grace@example.com"}'
```

From part 12, `npm test` runs the handlers in memory with `@effect/vitest`: no Postgres, no port.
