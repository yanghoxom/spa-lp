import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const CDN = 'https://cdn.phunghakorea.com';
const SITE = 'https://phunghakorea.com';

export function checkPrivateState(root) {
  const errors = [];
  const privatePath = value => /(^|\/)(seo(?:\/|$)|phunghakorea-seo-checkpoint\.json$)/i.test(value);
  if (fs.existsSync(path.join(root, '.git'))) {
    const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0');
    for (const file of tracked.filter(privatePath)) errors.push('Private SEO state must not be tracked: ' + file);
  }
  function walk(dir) {
    if (!fs.existsSync(path.join(root, dir))) return;
    if (fs.lstatSync(path.join(root, dir)).isSymbolicLink()) { errors.push('Symlinks must not be copied into public output: ' + dir); return; }
    for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = path.posix.join(dir, entry.name);
      if (entry.isSymbolicLink()) errors.push('Symlinks must not be copied into public output: ' + rel);
      else if (privatePath(rel)) errors.push('Private SEO state must not be published: ' + rel);
      else if (entry.isDirectory()) walk(rel);
    }
  }
  walk('public');
  walk('dist');
  return errors;
}

export function parseFrontMatter(raw, name = 'article') {
  const m = raw.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) throw Error('Missing front matter: ' + name);
  const meta = {};
  for (const line of m[1].split('\n')) {
    const p = line.match(/^([A-Za-z][A-Za-z0-9]*):\s*(.*)$/);
    if (p) meta[p[1]] = p[2].trim().replace(/^(["'])(.*)\1$/, '$2');
  }
  return { meta, body: raw.slice(m[0].length) };
}

export function imageKey(value) {
  if (typeof value !== 'string') return null;
  const key = value.startsWith(CDN + '/') ? value.slice(CDN.length) : value;
  return /^\/assets\/[a-zA-Z0-9/_-]+\.(?:webp|png|jpe?g|avif)$/.test(key) ? key : null;
}

export function checkPublication({ root = process.cwd(), article, date, mode = 'publish' } = {}) {
  const errors = checkPrivateState(root);
  const add = s => errors.push(s);
  if (!['publish', 'update'].includes(mode)) add('Unknown publication mode: ' + mode);
  const dir = path.join(root, 'content/articles');
  if (!fs.existsSync(dir)) return { ok: false, articleCount: 0, errors: ['Missing content/articles'] };
  const records = [];
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.md'))) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(f)) add('Invalid article filename: ' + f);
    try { records.push({ file: f, slug: f.slice(0, -3), ...parseFrontMatter(fs.readFileSync(path.join(dir, f), 'utf8'), f) }); }
    catch(e) { add(e.message); }
  }
  const sitemap = path.join(root, 'public/sitemap.xml');
  if (!fs.existsSync(sitemap)) add('Missing generated public/sitemap.xml; run npm run generate first');
  else {
    const xml = fs.readFileSync(sitemap, 'utf8');
    if (!/<urlset\b/.test(xml) || !/<\/urlset>/.test(xml)) add('Invalid sitemap urlset');
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
    if (new Set(locs).size !== locs.length) add('Duplicate sitemap loc');
    for (const r of records) if (!locs.includes(SITE + '/kien-thuc/' + r.slug + '/')) add('Missing article URL in sitemap: ' + r.slug);
  }
  const result = { ok: false, errors, articleCount: records.length, candidate: null, requiresExternalVerification: [] };
  if (article) {
    const name = path.relative(dir, path.resolve(root, article)).split(path.sep).join('/');
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(name)) add('Candidate must be directly under content/articles');
    else {
      const r = records.find(x => x.file === name);
      if (!r) add('Candidate not found: ' + name);
      else {
        result.candidate = r.slug;
        for (const k of ['title','description','date','category','cover','coverAlt']) if (!r.meta[k]) add('Missing front matter: ' + k);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(r.meta.date || '')) add('Invalid candidate date');
        if (r.meta.updated && (!/^\d{4}-\d{2}-\d{2}$/.test(r.meta.updated) || r.meta.updated < r.meta.date)) add('Invalid candidate updated date');
        const expectedDate = mode === 'update' ? r.meta.updated : r.meta.date;
        if (date && date !== expectedDate) add('Candidate date does not match ' + (mode === 'update' ? 'update' : 'publish') + ' date: ' + date);
        if (mode === 'publish' && records.filter(x => x.meta.date === r.meta.date).length > 1) add('daily limit: more than one article with date ' + r.meta.date);
        if (records.some(x => x.file !== r.file && x.meta.title?.toLocaleLowerCase('vi') === r.meta.title?.toLocaleLowerCase('vi'))) add('Duplicate exact title');
        if (!/^##\s+\S/m.test(r.body)) add('Missing H2 section');
        if (!/\]\(https?:\/\/(?!phunghakorea\.com|cdn\.phunghakorea\.com)[^)]+\)/.test(r.body)) add('Missing external source');
        const pics = [...r.body.matchAll(/!\[([^\]]*)\]\(([^)\s]+)\)/g)];
        if (!pics.length) add('Missing in-body illustration');
        let manifest = {};
        try { manifest = JSON.parse(fs.readFileSync(path.join(root,'infra/media-manifest.json'), 'utf8')); }
        catch(e) { add('Cannot read media manifest: ' + e.message); }
        const keys = [r.meta.cover, ...pics.map(m => m[2])];
        const seen = new Set();
        for (const value of keys) {
          const key = imageKey(value);
          if (!key) { add('Non-CDN image: ' + value); continue; }
          if (seen.has(key)) add('Cover and in-body illustrations must be distinct: ' + key);
          seen.add(key);
          const meta = manifest[key];
          const mime = ({webp:'image/webp',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',avif:'image/avif'})[path.extname(key).slice(1)];
          if (!meta || !(meta.size > 0) || !/^[a-f0-9]{64}$/.test(meta.sha256 || '') || meta.contentType !== mime) add('Image missing valid manifest entry: ' + key);
        }
        for (const p of pics) if (!p[1].trim()) add('Missing image alt: ' + p[2]);
        for (const m of r.body.matchAll(/(?<!!)\[[^\]]+\]\((\/(?!\/)[^)#?\s]+)(?:[?#][^)]*)?\)/g)) {
          const link = m[1];
          if (link.startsWith('/assets/')) continue;
          const loc = link === '/' ? 'index.html' : link.replace(/^\/+|\/+$/g, '') + '/index.html';
          if (!fs.existsSync(path.join(root, loc))) add('Broken internal link: ' + link);
        }
        result.requiresExternalVerification = [
          'Verify semantic uniqueness and health/source claims',
          ...[...seen].map(key => 'verify_media ' + key + ': exists, publicly_available, integrity_ok, sha256, MIME and size must match manifest'),
          'Before publishing, obtain confirmed Cloudflare deploy and check live article HTTP 200, canonical, images and links'
        ];
      }
    }
  }
  result.ok = !errors.length;
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const opts = {};
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--article') opts.article = process.argv[++i];
    else if (process.argv[i] === '--date') opts.date = process.argv[++i];
    else if (process.argv[i] === '--update') opts.mode = 'update';
    else if (process.argv[i] === '--root') opts.root = path.resolve(process.argv[++i]);
    else { console.error('Unknown argument: ' + process.argv[i]); process.exit(2); }
  }
  const result = checkPublication(opts);
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ok ? 0 : 1;
}
