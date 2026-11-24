# PhungHaKorea

## Images and CDN

- Store every standalone image and icon asset on Cloudflare CDN at `https://cdn.phunghakorea.com`. Never commit image files or base64 image payloads to GitHub.
- Cloudflare Worker `phungha-media` serves the dedicated public-media KV namespace `f9b9b8a418bd440ca0f6841852292a82`. Upload binary files through Cloudflare KV API with contentType and etag metadata.
- Add the uploaded image path, byte size, MIME type and SHA-256 to `infra/media-manifest.json`, then reference its CDN URL. Use versioned filenames; verify delivery before publishing.
- Keep image creation references and temporary image files outside the repository. No fallback to GitHub or website static assets.
- Interface controls and decorative link symbols use the shared inline SVG helper in `site/ui-icons.mjs` and `.ui-icon` styles; never use Unicode emoji or icon fonts for UI icons. Inline vector markup is source code, not a standalone media file. Existing brand/favicon and image assets remain on the CDN.
- Website source lives in `yanghoxom/spa-lp`; main deploys via Cloudflare Workers Builds. Preserve article text during UI-only changes.

## Daily SEO publishing / failure recovery

Follow [the durable publishing runbook](docs/daily-seo-publishing.md) for every daily SEO publication. GitHub `content/articles/` is the primary inventory; `public/sitemap.xml` is generated locally, while an independent public check verifies live status. A DNS/proxy error inside an agent environment must not be misreported as a site outage.

Run `npm run generate`, `npm run publish:preflight -- --article content/articles/<slug>.md --date YYYY-MM-DD`, `npm test` and `npm run build` before any publication. The script validates local structure; the Agent must additionally use Media Manager `verify_media` for every new image, review factual safety, and confirm the live Cloudflare deployment. Never publish with an unverified mandatory gate.

Do not try to reconfigure the private Media Manager app when `verify_media` is available. Do not create duplicate daily schedules. Repo instructions do not replace updating the actual saved agent schedule.

## Autonomous SEO operations and private state

- The owner authorizes routine SEO research, article improvements, publication, code fixes, commits, pushes and production deployment without a second approval. Continue from the latest checkpoint and select useful work autonomously. Do not promise a ranking or invent traffic/volume data.
- This repository is public. Keep operational strategy, keyword maps, backlog, audit logs and agent state in the gitignored local `seo/` directory. Persist the complete checkpoint privately as `phunghakorea-seo-checkpoint.json`; restore it on subsequent runs. Never commit it or put it under `public/` or `dist/`. Do not store credentials or customer data in checkpoints.
- A recurring run is a bounded work cycle, not proof of a permanently running process. Read the saved automation/checkpoint before creating schedules, avoid overlap, and update the actual saved task when the runbook changes.
- Keep publication dates stable when updating articles; set `updated` only for a substantive editorial change. Preserve URLs unless a checked redirect is included. Run preflight for each changed article, not a hardcoded previous article. The CI workflow derives these paths from the actual Git diff.
- Record unmeasured KPIs as unknown. Crawlability and HTTP 200 do not prove Google indexing, ranking, Core Web Vitals or conversions. Retain evidence and revisit outcomes when enough new data is available.
