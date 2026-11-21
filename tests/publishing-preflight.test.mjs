import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkPublication, imageKey, parseFrontMatter } from '../site/publishing-preflight.mjs';

const COVER='/assets/articles/test-cover-v1-1440.webp';
const INNER='/assets/articles/test-inner-v1-960.webp';
const HASH='a'.repeat(64);

function fixture() {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'phungha-preflight-'));
  const put=(p,s)=>{const f=path.join(root,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s)};
  const article=[
    '---', 'title: Test title', 'description: A descriptive summary',
    'date: 2026-11-21', 'category: Skin care', 'cover: '+COVER,
    'coverAlt: Portrait and skincare', '---', '', '## Practical tips', '',
    'A note with [evidence](https://example.com/guide).', '',
    '![A safe illustration]('+INNER+')', '', 'Read [more](/my-pham/).', ''
  ].join('\n');
  put('content/articles/test-post.md', article);
  put('public/sitemap.xml', '<urlset><url><loc>https://phunghakorea.com/kien-thuc/test-post/</loc></url></urlset>');
  put('infra/media-manifest.json', JSON.stringify({[COVER]:{size:1000,sha256:HASH,contentType:'image/webp'},[INNER]:{size:800,sha256:HASH,contentType:'image/webp'}}));
  put('my-pham/index.html','<h1>Shop</h1>');
  return { root,put,article, cleanup:()=>fs.rmSync(root,{recursive:true,force:true}) };
}

test('parses front matter and accepts CDN paths only',()=>{
  assert.equal(parseFrontMatter('---\ntitle: X\n---\nBody').meta.title,'X');
  assert.equal(imageKey('https://cdn.phunghakorea.com/assets/articles/one.webp'),'/assets/articles/one.webp');
  assert.equal(imageKey('https://example.com/a.webp'),null);
});

test('baseline validates generated sitemap offline',t=>{
  const f=fixture();t.after(f.cleanup);
  const r=checkPublication({root:f.root});
  assert.equal(r.ok,true,JSON.stringify(r.errors));
  assert.equal(r.articleCount,1);
});

test('candidate passes local checks but requires remote image and live verification',t=>{
  const f=fixture();t.after(f.cleanup);
  const r=checkPublication({root:f.root,article:'content/articles/test-post.md',date:'2026-11-21'});
  assert.equal(r.ok,true,JSON.stringify(r.errors));
  assert.ok(r.requiresExternalVerification.some(v=>v.includes('verify_media')));
});

test('blocks second same-day article',t=>{
  const f=fixture();t.after(f.cleanup);
  f.put('content/articles/second-post.md',f.article.replace('Test title','Another title'));
  f.put('public/sitemap.xml','<urlset><url><loc>https://phunghakorea.com/kien-thuc/test-post/</loc></url><url><loc>https://phunghakorea.com/kien-thuc/second-post/</loc></url></urlset>');
  const r=checkPublication({root:f.root,article:'content/articles/test-post.md',date:'2026-11-21'});
  assert.ok(r.errors.some(x=>x.includes('daily limit')));
});

test('blocks non-CDN images and missing manifest',t=>{
  const f=fixture();t.after(f.cleanup);
  f.put('content/articles/test-post.md',f.article.replace(INNER,'https://example.com/fake.webp'));
  const r=checkPublication({root:f.root,article:'content/articles/test-post.md',date:'2026-11-21'});
  assert.ok(r.errors.some(x=>x.includes('Non-CDN')));
  f.put('content/articles/test-post.md',f.article);
  f.put('infra/media-manifest.json','{}');
  const x=checkPublication({root:f.root,article:'content/articles/test-post.md',date:'2026-11-21'});
  assert.ok(x.errors.some(e=>e.includes('valid manifest')));
});

test('blocks missing in-body image and missing internal route',t=>{
  const f=fixture();t.after(f.cleanup);
  f.put('content/articles/test-post.md',f.article.replace('![A safe illustration]('+INNER+')',''));
  let r=checkPublication({root:f.root,article:'content/articles/test-post.md',date:'2026-11-21'});
  assert.ok(r.errors.some(e=>e.includes('Missing in-body illustration')));
  f.put('content/articles/test-post.md',f.article.replace('/my-pham/','/does-not-exist/'));
  r=checkPublication({root:f.root,article:'content/articles/test-post.md',date:'2026-11-21'});
  assert.ok(r.errors.some(e=>e.includes('Broken internal link')));
});

test('blocks invalid date and stale sitemap',t=>{
  const f=fixture();t.after(f.cleanup);
  let r=checkPublication({root:f.root,article:'content/articles/test-post.md',date:'2026-11-22'});
  assert.ok(r.errors.some(e=>e.includes('does not match publish date')));
  f.put('public/sitemap.xml','<urlset></urlset>');
  r=checkPublication({root:f.root});
  assert.ok(r.errors.some(e=>e.includes('Missing article URL')));
});
