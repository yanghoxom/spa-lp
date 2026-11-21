# PhungHaKorea

## Images and CDN

- Store every image and icon on Cloudflare CDN at `https://cdn.phunghakorea.com`. Never commit image files or base64 image payloads to GitHub.
- Cloudflare Worker `phungha-media` serves the dedicated public-media KV namespace `f9b9b8a418bd440ca0f6841852292a82`. Upload binary files through Cloudflare KV API with contentType and etag metadata.
- Add the uploaded image path, byte size, MIME type and SHA-256 to `infra/media-manifest.json`, then reference its CDN URL. Use versioned filenames; verify delivery before publishing.
- Keep image creation references and temporary image files outside the repository. No fallback to GitHub or website static assets.
- Website source lives in `yanghoxom/spa-lp`; main deploys via Cloudflare Workers Builds. Preserve article text during UI-only changes.

## Daily SEO publishing / failure recovery

Follow [the durable publishing runbook](docs/daily-seo-publishing.md) for every daily SEO publication. GitHub `content/articles/` is the primary inventory; `public/sitemap.xml` is generated locally, while an independent public check verifies live status. A DNS/proxy error inside an agent environment must not be misreported as a site outage.

Run `npm run generate`, `npm run publish:preflight -- --article content/articles/<slug>.md --date YYYY-MM-DD`, `npm test` and `npm run build` before any publication. The script validates local structure; the Agent must additionally use Media Manager `verify_media` for every new image, review factual safety, and confirm the live Cloudflare deployment. Never publish with an unverified mandatory gate.

Do not try to reconfigure the private Media Manager app when `verify_media` is available. Do not create duplicate daily schedules. Repo instructions do not replace updating the actual saved agent schedule.
