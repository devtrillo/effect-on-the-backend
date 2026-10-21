# Effect on the Backend

The code for the [Effect on the Backend](https://github.com/devtrillo/blog/issues/342) blog series: one backend server on Node, built with [Effect](https://effect.website) 4, one part at a time.

Each part of the series is a tag (`part-1`, `part-2`, …), so you can check out the code as it was at the end of any post.

```sh
npm install
npm run check
cp .env.example .env
npm start
```

Requires Node 24+. Node runs the `.ts` files directly (type stripping), so there is no build step: imports use `.ts` extensions and the code sticks to erasable TypeScript syntax. Pinned to `effect` 4.0.5.
