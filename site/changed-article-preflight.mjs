import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPublication } from './publishing-preflight.mjs';

export function changedArticleEntries({ root = process.cwd(), base, head = 'HEAD' }) {
  if (!/^[a-f0-9]{40,64}$/.test(base || '') || /^0+$/.test(base)) {
    throw new Error('SEO_BASE_SHA must identify the previous push or pull-request base commit');
  }
  if (head !== 'HEAD' && !/^[a-f0-9]{40,64}$/.test(head)) throw new Error('Invalid head commit');
  const changed = execFileSync('git', ['diff', '--name-status', '--diff-filter=AMR', '-z', base, head, '--', 'content/articles/'], { cwd: root, encoding: 'utf8' }).split('\0');
  const articles = [];
  for (let index = 0; index < changed.length - 1;) {
    const status = changed[index++];
    let file = changed[index++];
    if (status.startsWith('R')) file = changed[index++];
    if (/^content\/articles\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(file)) articles.push({ article: file, mode: status === 'A' ? 'publish' : 'update' });
  }
  return articles;
}

export function changedArticlePaths(options) { return changedArticleEntries(options).map(entry => entry.article); }

export function checkChangedArticles(options) {
  const articles = changedArticleEntries(options);
  const inventory = checkPublication({ root: options.root });
  const candidates = articles.map(({ article, mode }) => ({ article, mode, ...checkPublication({ root: options.root, article, mode }) }));
  return { ok: inventory.ok && candidates.every(result => result.ok), inventory, candidates };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = checkChangedArticles({ root: process.cwd(), base: process.env.SEO_BASE_SHA });
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
