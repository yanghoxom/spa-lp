# Phùng Hà KOREA - Landing Page

Landing page tĩnh cho phễu tư vấn chăm sóc da và mỹ phẩm Hàn Quốc của fanpage Phùng Hà KOREA.

## Production (Cloudflare Workers)

- Website: https://phunghakorea.com/
- Alias: https://www.phunghakorea.com/
- Worker: `phungha-korea`
- Cloudflare plan: Workers Free, Static Assets (no paid services or database)
- GitHub source: `yanghoxom/spa-lp`, branch `main`
- Automatic deployments: Cloudflare Workers Builds, on pushes to `main`
- Cloudflare build command: `npm ci && npm run test && npm run build`
- Deploy command: `npx --yes wrangler@4 deploy`
- Build output: `dist/`
- Configuration: `wrangler.jsonc`

The Vite base URL is relative (`./`) to work both at the domain root and under a subpath.
The site is static: quiz answers are processed in the browser and the user is directed to Messenger; there is no server-side lead database.

## Local development

```sh
npm ci
npm run dev
```

## Tests and build

```sh
npm run test
npm run build
```

A pre-existing GitHub Pages workflow remains in `.github/workflows/deploy.yml`. Cloudflare is the primary deployment target.
