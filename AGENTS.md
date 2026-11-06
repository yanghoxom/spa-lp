# PhungHaKorea

## Images and CDN

- Store every image and icon on Cloudflare CDN at `https://cdn.phunghakorea.com`. Never commit image files or base64 image payloads to GitHub.
- Cloudflare Worker `phungha-media` serves the dedicated public-media KV namespace `f9b9b8a418bd440ca0f6841852292a82`. Upload binary files through Cloudflare KV API with contentType and etag metadata.
- Add the uploaded image path, byte size, MIME type and SHA-256 to `infra/media-manifest.json`, then reference its CDN URL. Use versioned filenames; verify delivery before publishing.
- Keep image creation references and temporary image files outside the repository. No fallback to GitHub or website static assets.
- Website source lives in `yanghoxom/spa-lp`; main deploys via Cloudflare Workers Builds. Preserve article text during UI-only changes.
