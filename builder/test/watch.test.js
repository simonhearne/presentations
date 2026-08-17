import { test } from 'node:test';
import assert from 'node:assert/strict';
import { injectReloadClient, contentTypeFor, isIgnoredPath } from '../bin/watch.js';

test('injectReloadClient: inserts SSE client before </body>', () => {
  const out = injectReloadClient('<html><body><p>hi</p></body></html>');
  assert.match(out, /EventSource\('\/__livereload'\)/);
  assert.match(out, /<script>[\s\S]*<\/script>\n<\/body>/);
});

test('injectReloadClient: appends when no </body> exists', () => {
  const out = injectReloadClient('<p>fragment</p>');
  assert.match(out, /^<p>fragment<\/p><script>/);
});

test('contentTypeFor: maps known extensions', () => {
  assert.equal(contentTypeFor('/a/index.html'), 'text/html; charset=utf-8');
  assert.equal(contentTypeFor('deck.css'), 'text/css; charset=utf-8');
  assert.equal(contentTypeFor('deck.js'), 'text/javascript; charset=utf-8');
  assert.equal(contentTypeFor('logo.svg'), 'image/svg+xml');
  assert.equal(contentTypeFor('spec.json'), 'application/json');
});

test('contentTypeFor: is case-insensitive and has a fallback', () => {
  assert.equal(contentTypeFor('photo.PNG'), 'image/png');
  assert.equal(contentTypeFor('archive.tar.gz'), 'application/octet-stream');
  assert.equal(contentTypeFor('noext'), 'application/octet-stream');
});

test('isIgnoredPath: ignores dist output, dotfiles, backups', () => {
  assert.equal(isIgnoredPath('dist/index.html'), true);
  assert.equal(isIgnoredPath('dist\\index.html'), true);
  assert.equal(isIgnoredPath('.DS_Store'), true);
  assert.equal(isIgnoredPath('img/.tmp123'), true);
  assert.equal(isIgnoredPath('slides.md~'), true);
});

test('isIgnoredPath: keeps real sources', () => {
  assert.equal(isIgnoredPath('slides.md'), false);
  assert.equal(isIgnoredPath('img/photo.jpg'), false);
  assert.equal(isIgnoredPath('deck.css'), false);
});
