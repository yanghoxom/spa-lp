import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { changedArticlePaths, checkChangedArticles } from '../site/changed-article-preflight.mjs';

function repository(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'phungha-changed-preflight-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const put = (name, value) => { fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true }); fs.writeFileSync(path.join(root, name), value); };
  git('init', '-q'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.test');
  put('content/articles/existing.md', '---\ntitle: Existing\ndate: 2026-11-01\n---\n\n## Existing\n');
  put('public/sitemap.xml', '<urlset><url><loc>https://phunghakorea.com/kien-thuc/existing/</loc></url></urlset>');
  git('add', '.'); git('commit', '-qm', 'Baseline');
  return { root, git, put, base: git('rev-parse', 'HEAD') };
}

test('checks actual added and modified articles rather than a previous fixed slug', t => {
  const f = repository(t);
  f.put('content/articles/existing.md', '---\ntitle: Updated\ndate: 2026-11-01\n---\n\n## Updated\n');
  f.put('content/articles/new-guide.md', '---\ntitle: New\ndate: 2026-11-24\n---\n\n## New\n');
  f.put('README.md', 'Unrelated documentation');
  f.git('add', '.'); f.git('commit', '-qm', 'Content update');
  assert.deepEqual(changedArticlePaths(f).sort(), ['content/articles/existing.md', 'content/articles/new-guide.md']);
  const result = checkChangedArticles(f);
  assert.equal(result.ok, false);
  assert.equal(result.candidates.length, 2);
  assert.equal(result.candidates.find(candidate => candidate.article.endsWith('existing.md')).mode, 'update');
  assert.equal(result.candidates.find(candidate => candidate.article.endsWith('new-guide.md')).mode, 'publish');
  assert.ok(result.candidates.every(candidate => candidate.errors.some(error => error.includes('Missing in-body'))));
});

test('technical-only commit still validates inventory without selecting an unrelated article', t => {
  const f = repository(t);
  f.put('README.md', 'Technical change'); f.git('add', '.'); f.git('commit', '-qm', 'Technical');
  const result = checkChangedArticles(f);
  assert.equal(result.ok, true);
  assert.deepEqual(result.candidates, []);
});

test('invalid or unavailable comparison base fails closed', t => {
  const f = repository(t);
  assert.throws(() => changedArticlePaths({ ...f, base: '' }), /SEO_BASE_SHA/);
  assert.throws(() => changedArticlePaths({ ...f, base: '0'.repeat(40) }), /SEO_BASE_SHA/);
  assert.throws(() => changedArticlePaths({ ...f, base: '--all' }), /SEO_BASE_SHA/);
  assert.throws(() => changedArticlePaths({ ...f, base: 'f'.repeat(40) }));
});
