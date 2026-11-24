# Daily SEO publishing: reliable and fail-closed workflow

Source of truth: GitHub `yanghoxom/spa-lp` on `main`; generated pages and sitemap come from `site/build.mjs`. Media lives only at `https://cdn.phunghakorea.com` and is recorded in `infra/media-manifest.json`.

## 1. Intake and no-duplicate gate
- Each daily run may create at most **one** new article, with the local date in `Asia/Ho_Chi_Minh`. Do not publish make-up articles automatically.
- Read the **complete** `content/articles/` listing and front matter on latest GitHub `main` before choosing a topic. Check exact slug/title and semantically overlapping intents. If a candidate already exists in `main`, report `ALREADY_PUBLISHED` without republishing.
- A sitemap HTTP failure is **not** proof that the site is down or that content is missing. Do not choose a duplicate topic because a sitemap fetch failed.
- Site sitemap and RSS are generated at build time. Run `npm run generate` and validate `public/sitemap.xml` locally. Treat GitHub Markdown as the primary pre-publication inventory.

## 2. Network and sitemap fallback
- Try a normal HTTPS GET for `https://phunghakorea.com/sitemap.xml` and `robots.txt`. Inspect actual HTTP status and MIME, not only whether a browser displayed the page.
- On DNS, proxy 403, timeout or sandbox egress failures, switch to the connected Cloudflare Browser Run / Browser Rendering content endpoint, one URL at a time. Require `meta.status == 200`, `meta.headers['content-type']` compatible with XML and evidence of `urlset`; its Chromium XML viewer can wrap the raw XML in HTML, so do not parse that HTML as XML.
- Treat `429` as throttling; honor Retry-After when available, then bounded backoff (e.g. 10, 20, 40 seconds; at most 3 retries). Do not launch parallel browser requests.
- If the alternative public check still fails, continue **research and offline preflight** from GitHub; hold production release if required live/post-deploy verification cannot be completed. Never assert that the website is live solely because local build succeeded.
- Do not modify DNS, disable WAF, whitelist all bots or reduce website security to work around a tool/proxy failure.

## 3. One article and two real CDN images
- Produce one useful Vietnamese article for women 30-50; provide clear headings, explicit answer, accurate sources, readable explanations, truthful medical cautions, helpful internal links, accurate alt text and structured metadata. Do not invent medical evidence, product labels, product stock, or the owner's face.
- Use authorized original face/product references whenever a real person or real product is depicted. Generate **one cover** and **at least one distinct in-body image**; do not use the existing article illustration as an identity reference.
- Upload binary to the Media Manager tool under unique versioned `/assets/` keys, never into GitHub. Write for each key its `size`, `sha256`, and `contentType` into `infra/media-manifest.json`.
- Measure the actual width and height from the image bytes and register each variant with its SHA-256 in `site/image-metadata.json`. Do not infer dimensions or assume all images have the same crop. The renderer uses only matching-ratio verified variants for responsive images and reserves the measured aspect ratio.
- Call the existing `verify_media` tool **for every new image**. Require `exists === true`, `publicly_available === true`, `integrity_ok === true` and exact MIME, SHA-256 and byte-size agreement with the manifest. `verify_media` reads KV and performs public HEAD/GET and is an acceptable byte-integrity read-back. Use `download_media` for original binary/visual inspection if it is exposed to this agent. If download is not exposed but verify is, do not try to edit the private app and do not claim download succeeded. If neither verification path is available, **do not publish**.
- Capture the verification results in the run report. Never include binary/base64 in GitHub, logs or the report.

## 4. Before changing main
- Put one new file under `content/articles/<slug>.md`, update `infra/media-manifest.json`, and include valid internal links to existing pages.
- From the project root, run: `npm run generate`, then `npm run publish:preflight -- --article content/articles/<slug>.md --date YYYY-MM-DD`, then `npm test`, then `npm run build`.
- `publish:preflight` is a **local structural gate only**. Its success does not replace source/medical review, live CDN verification or the post-deployment check. Read its `requiresExternalVerification` output and complete every item.
- Before committing, re-read the latest `main` and confirm another agent has not already published today's article. Use one atomic main commit for the Markdown and manifest if possible; never overwrite unrelated changes.
- For an update, preserve the original `date`, set `updated` for the meaningful change, and run `npm run publish:preflight -- --article content/articles/<slug>.md --update --date YYYY-MM-DD` using the update date. The daily new-article limit must not reject a historical publication date. CI distinguishes added from modified articles using the actual push/PR diff; never pin the workflow to one slug or date.
- Any safety, content rights, image integrity, duplicate, route, test or build failure: stop before committing. Do not silently downgrade a required check.

## 5. Deploy and truthful result
- Push to `main`, then inspect the associated Cloudflare Workers Builds / deployment. Confirm the `phungha-korea` deployment corresponds to the expected source commit.
- Fetch the exact final article URL. Require HTTP 200, correct canonical/title/body, two resolved CDN images, working internal links and updated sitemap. If normal HTTP is blocked by this agent's network, use an independent Cloudflare browser connection for the page and the Media Manager for image integrity.
- If post-deploy checks cannot complete, report `DEPLOYED_BUT_LIVE_UNVERIFIED` rather than `LIVE`. Do not automatically revert a deployment that could include other people's changes.
- Report: date, article URL (only if deployed), keyword and intent, source references, CDN keys with checksums, internal links, Git commit, deployment timestamp/id, validation results and precise remaining blockers.

## 6. Safe dry-run and ownership
- For a no-publish rehearsal: `npm ci && npm run generate && npm run publish:preflight && npm test && npm run build`. Confirm existing content matches the locally generated sitemap. Separately verify one known CDN image and check the public sitemap through the Cloudflare fallback.
- When fixing the pipeline, do **not** publish an article, add a second schedule, or silently change the cadence. This file cannot update a ChatGPT agent's separately owned saved schedule; the schedule owner must update that existing task's prompt to follow this runbook.
- If the agent cannot view or edit its saved schedule, report that as a **separate** permissions/ownership blocker. Do not declare the scheduling fix complete from a GitHub commit alone.

## 7. Private continuity for autonomous SEO
- Restore `phunghakorea-seo-checkpoint.json` from the owner's private files at the start of a new run and materialize its strategy, inventory, keyword map, backlog, logs and agent state under the gitignored local `seo/` directory. The public GitHub repository holds the application and generic runbook only.
- Save the updated private checkpoint after each verified cycle. Record the commit, Cloudflare build/deployment, checks performed, observations, unresolved issues, and next valuable task. Never copy operational state into `public/`, `dist/`, GitHub, analytics events or public reports.
- Choose work based on evidence and expected user value. Reuse existing intent owners; prefer improving weak existing pages before publishing overlapping articles. At most one new article per local calendar day remains the default publishing pace; useful repairs and substantive updates are not limited to one.
- Read the current recurring-task configuration before changing scheduling. Do not create a second task for the same workflow. If another cycle is still actively publishing, defer overlapping mutations and retain the evidence for the next run.

## Blocker classification
- `NETWORK_PRIMARY_FAILED`: retry/fallback; not a content block on its own.
- `RATE_LIMIT_429`: sequential bounded retry; not evidence the website is down.
- `DUPLICATE_DATE_OR_INTENT`: do not publish; return the existing article.
- `CONTENT_SAFETY_FAILED`, `CDN_INTEGRITY_FAILED`, `MANIFEST_FAILED`, `BUILD_FAILED`: do not commit.
- `DEPLOYED_BUT_LIVE_UNVERIFIED`: report deployment only, not live publication.
